// cart-pricing — sepet kalemlerini VERİTABANI FİYATLARIYLA fiyatlar.
//
// NEDEN AYRI MODÜL: bu hesabın iki çağıranı var ve ikisi de müşteriye para
// gösteriyor — order-draft (ödeme tutarı) ve validate-coupon (kupon
// önizlemesi). İkinci bir kopya yazmak, önizlemede görülen indirimin ödemede
// tahsil edilenden farklı olması demekti. Bu projede aynı hata iki kez oldu:
// buy_x_get_y hedeflemesi web kopyasında eksikti ve vergi yuvarlaması sunucu
// ile istemcide ayrışmıştı.
//
// İstemciden gelen HİÇBİR fiyata güvenilmez; yalnızca product_id, quantity ve
// option_ids okunur.

export const round2 = (n: number) => Number(n.toFixed(2));

export const MAX_ITEMS = 50;
export const MAX_QTY_PER_ITEM = 20;

export interface PricingItem {
  product_id: string;
  quantity: number;
  option_ids?: string[];
  special_instructions?: string | null;
}

export interface PricedLine {
  product_id: string;
  product_name: string;
  category_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  option_ids: string[];
  special_instructions: string | null;
}

export interface PricedOption {
  id: string;
  name: string;
  name_en: string | null;
  price: number;
}

export type PricingResult =
  | { ok: true; lines: PricedLine[]; options: PricedOption[]; subtotal: number }
  | { ok: false; error: string; status: number };

const bad = (error: string, status = 400): PricingResult => ({ ok: false, error, status });

interface PricingClient {
  from(table: string): any;
}

/** Sepetin biçimsel geçerliliği — fiyatlamadan önce. */
export function validateCartShape(items: unknown): PricingResult | null {
  if (!Array.isArray(items) || items.length === 0) return bad('items is required');
  if (items.length > MAX_ITEMS) return bad('too many items');
  for (const item of items as PricingItem[]) {
    if (!item?.product_id) return bad('each item needs product_id');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QTY_PER_ITEM) {
      return bad('invalid quantity');
    }
  }
  return null;
}

export async function priceCartLines(
  admin: PricingClient,
  items: PricingItem[]
): Promise<PricingResult> {
  // ── Ürünler ve fiyatlar: DB'den ────────────────────────────────────────
  const productIds = [...new Set(items.map((i) => i.product_id))];
  const { data: products, error: productError } = await admin
    .from('products')
    .select('id, name, price, category_id, is_active, stock_status')
    .in('id', productIds);
  if (productError) return bad('could not load products', 500);

  const productById = new Map<string, any>((products ?? []).map((p: any) => [p.id, p]));
  for (const id of productIds) {
    const p = productById.get(id);
    if (!p) return bad(`unknown product: ${id}`);
    if (!p.is_active) return bad(`product is not available: ${p.name}`);
    // stock_status'a burada da uyuluyor. Uygulamada bir süre yok sayılmış ve
    // tükenen ürünler sipariş edilebilmişti; sunucu tarafı son savunma.
    if (p.stock_status === 'out_of_stock') return bad(`sold out: ${p.name}`);
  }

  // ── Ek malzeme fiyatları: DB'den ───────────────────────────────────────
  const optionIds = [...new Set(items.flatMap((i) => i.option_ids ?? []))];
  const optionById = new Map<string, PricedOption>();
  if (optionIds.length > 0) {
    const { data: options, error: optionError } = await admin
      .from('product_options')
      .select('id, name, name_en, price, is_active')
      .in('id', optionIds);
    if (optionError) {
      // 22P02 = geçersiz girdi sözdizimi: gelen kimlik UUID değil. Bu bozuk
      // bir sepet (ör. eski localStorage içeriği), sunucu hatası değil —
      // 500 "could not load options" demek müşteriye de bize de yardım etmiyor.
      if (optionError.code === '22P02') {
        return bad('your cart contains an invalid item — please clear it and add again', 400);
      }
      console.error('[cart-pricing] options load failed', optionError);
      return bad('could not load options', 500);
    }
    for (const o of (options ?? []) as any[]) {
      if (!o.is_active) return bad(`option is not available: ${o.name}`);
      optionById.set(o.id, { id: o.id, name: o.name, name_en: o.name_en, price: Number(o.price ?? 0) });
    }
    for (const id of optionIds) {
      if (!optionById.has(id)) return bad(`unknown option: ${id}`);
    }
  }

  // ── Ara toplam ─────────────────────────────────────────────────────────
  // Kalem fiyatı = ürün fiyatı + seçilen ek malzemelerin toplamı.
  // Uygulamadaki davranışla aynı: ekstralar kalem fiyatının İÇİNDE.
  const lines: PricedLine[] = items.map((item) => {
    const product = productById.get(item.product_id)!;
    const extras = (item.option_ids ?? []).reduce(
      (sum, id) => sum + Number(optionById.get(id)!.price ?? 0),
      0
    );
    const unitPrice = round2(Number(product.price) + extras);
    return {
      product_id: product.id,
      product_name: product.name,
      category_id: (product.category_id as string | null) ?? null,
      quantity: item.quantity,
      unit_price: unitPrice,
      subtotal: round2(unitPrice * item.quantity),
      option_ids: item.option_ids ?? [],
      special_instructions: item.special_instructions ?? null,
    };
  });

  return {
    ok: true,
    lines,
    options: [...optionById.values()],
    subtotal: round2(lines.reduce((sum, l) => sum + l.subtotal, 0)),
  };
}

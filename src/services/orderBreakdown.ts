// Sipariş tutar kırılımı (Order price breakdown)
//
// Fişte ve admin sipariş detayında yalnızca TOPLAM yazıyordu; ilk sipariş
// indirimi ya da eklenen ek malzemeler görünmediği için tutarın neden arttığı /
// azaldığı anlaşılmıyordu. Bu modül kırılımı tek yerden üretir ki admin ekranı,
// termal fiş ve PDF fişi birebir aynı sayıları göstersin.
//
// ── Teslimat ücreti neden türetiliyor? ──────────────────────────────────────
// orders.delivery_fee kolonu GÜVENİLİR DEĞİL: Uber teslimatı oluşturulduğunda
// uber-create-delivery edge function'ı bu alanın üzerine Uber'in kendi ücretini
// yazıyor (delivery.fee / 100). Yani kolon başta müşteriden tahsil edilen
// ücreti, sonra restoranın Uber'e ödediği ücreti tutuyor. Fişe Uber maliyetini
// yazmak müşterinin ödemediği bir tutarı göstermek olurdu.
//
// Ödeme anındaki formül (PaymentScreen):
//   total_amount = max(0, kalemToplam - indirim - puan) + teslimat + bahşiş
// Buradan tahsil edilen teslimat ücreti tam olarak çıkarılabiliyor; böylece
// kırılım her zaman TOPLAM'a eşitleniyor, uydurma bir "fark" satırı gerekmiyor.

import { Order } from '../types/database.types';

export interface OrderBreakdownLine {
  /** i18n anahtarı */
  key: string;
  amount: number;
  /** true ise tutar eksi olarak gösterilir */
  negative?: boolean;
  /** Sadece bilgi amaçlı (üstteki satırın içinde zaten var) */
  informational?: boolean;
  /** Kampanya adı gibi ek metin */
  note?: string;
}

export interface OrderBreakdown {
  itemsTotal: number;
  extrasTotal: number;
  discount: number;
  pointsUsed: number;
  deliveryCharged: number;
  tax: number;
  tip: number;
  total: number;
  lines: OrderBreakdownLine[];
  /** Kırılımda gösterilecek bir şey var mı (hepsi sıfırsa satır basmaya değmez) */
  hasDetail: boolean;
}

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function buildOrderBreakdown(
  order: Order,
  campaignName?: string | null
): OrderBreakdown {
  const items = order.order_items ?? [];
  const customizations = order.order_item_customizations ?? [];

  const itemsTotal = items.reduce((sum, it: any) => sum + num(it.subtotal), 0);
  // Ek malzeme fiyatları kalem fiyatının İÇİNDE (cartStore item.price'a ekliyor),
  // bu yüzden toplama dahil edilmez; yalnızca "şu kadarı ek malzeme" bilgisi.
  const extrasTotal = customizations.reduce(
    (sum, c: any) => sum + num(c.option_price) * num(c.quantity || 1),
    0
  );

  const discount = num(order.discount_amount);
  const pointsUsed = num(order.points_used);
  const tip = num(order.tip_amount);
  // Vergi öncesi dönemde verilen siparişlerde 0 → o siparişlerin dökümü aynen
  // tutmaya devam eder, geriye dönük bir bozulma olmaz.
  const tax = num((order as any).tax_amount);
  const total = num(order.total_amount);

  const afterDiscount = Math.max(0, itemsTotal - discount - pointsUsed);
  // Pickup'ta teslimat ücreti yok; teslimatta ödeme anındaki formülden türetilir.
  // Vergi de toplamın içinde olduğu için türetmeden düşülmeli; yoksa teslimat
  // ücreti verginin kadar şişmiş görünür.
  const deliveryCharged =
    order.delivery_method === 'pickup'
      ? 0
      : Math.max(0, Number((total - afterDiscount - tax - tip).toFixed(2)));

  const lines: OrderBreakdownLine[] = [];
  lines.push({ key: 'subtotal', amount: itemsTotal });
  if (extrasTotal > 0) {
    lines.push({ key: 'extras', amount: extrasTotal, informational: true });
  }
  if (discount > 0) {
    lines.push({ key: 'discount', amount: discount, negative: true, note: campaignName ?? undefined });
  }
  if (pointsUsed > 0) {
    lines.push({ key: 'pointsUsed', amount: pointsUsed, negative: true });
  }
  if (deliveryCharged > 0) {
    lines.push({ key: 'deliveryFee', amount: deliveryCharged });
  }
  if (tax > 0) {
    lines.push({ key: 'tax', amount: tax });
  }
  if (tip > 0) {
    lines.push({ key: 'tip', amount: tip });
  }

  return {
    itemsTotal,
    extrasTotal,
    discount,
    pointsUsed,
    deliveryCharged,
    tax,
    tip,
    total,
    lines,
    // Yalnızca "ara toplam" varsa kırılım anlatacak bir şey yok demektir
    hasDetail: lines.length > 1,
  };
}

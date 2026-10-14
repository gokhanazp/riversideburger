// Sipariş satırı ↔ özelleştirme eşleştirmesi.
//
// Yeni siparişlerde her satır ve her özelleştirme aynı line_id'yi taşıyor;
// eşleştirme ona göre. Eski siparişlerde (line_id yok) ürün kimliğine düşülür —
// o siparişlerde aynı üründen iki satır varsa ayrım yapılamaz, bilinen sınır.
export interface LineLike {
  line_id?: string | null;
  product_id?: string | null;
}
export interface CustomizationLike {
  line_id?: string | null;
  product_id?: string | null;
}

export function customizationsForItem<C extends CustomizationLike>(customizations: readonly C[] | null | undefined, item: LineLike): C[] {
  const all = customizations ?? [];
  if (item.line_id) return all.filter((c) => c.line_id === item.line_id);
  return all.filter((c) => !c.line_id && c.product_id === item.product_id);
}

export const newLineId = (productId: string) =>
  `${productId}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

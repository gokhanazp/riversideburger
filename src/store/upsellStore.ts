import { create } from 'zustand';

// "Goes well with" paneli için küçük global durum. Sepete ekleyen her yer
// (menü artısı, favoriler, ana sayfa, ürün detayı) open(productId) der;
// paneli kök seviyedeki UpsellSheetHost çizer. Böylece ekran kapansa da
// (ürün detayından geri dönülse de) panel üstte kalır.
interface UpsellStore {
  productId: string | null;
  open: (productId: string) => void;
  close: () => void;
}

export const useUpsellStore = create<UpsellStore>((set) => ({
  productId: null,
  open: (productId) => set({ productId }),
  close: () => set({ productId: null }),
}));

export const openUpsell = (productId: string) => useUpsellStore.getState().open(productId);

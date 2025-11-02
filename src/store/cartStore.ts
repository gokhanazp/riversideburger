import { create } from 'zustand';
import { CartItem, MenuItem } from '../types';

// Sepet store'u için interface tanımı (Cart store interface definition)
interface CartStore {
  items: CartItem[]; // Sepetteki ürünler (Items in cart)
  addItem: (item: MenuItem, customizations?: Array<{option_id: string; option_name: string; option_price: number}>, specialInstructions?: string) => void; // Sepete ürün ekle (Add item to cart)
  removeItem: (itemId: string) => void; // Sepetten ürün çıkar (Remove item from cart)
  updateQuantity: (itemId: string, quantity: number) => void; // Ürün miktarını güncelle (Update item quantity)
  clearCart: () => void; // Sepeti temizle (Clear cart)
  getTotalPrice: () => number; // Toplam fiyatı hesapla (Calculate total price)
  getTotalItems: () => number; // Toplam ürün sayısını hesapla (Calculate total items)
}

// Zustand store oluşturma (Create Zustand store)
export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  // Sepete ürün ekleme fonksiyonu (Add item to cart function)
  addItem: (item: MenuItem, customizations?: Array<{option_id: string; option_name: string; option_price: number}>, specialInstructions?: string) => {
    const currentItems = get().items;

    // Özelleştirmeli ürünler her zaman yeni item olarak eklenir
    // (Items with customizations are always added as new items)
    if (customizations && customizations.length > 0) {
      // Özelleştirme varsa, her zaman yeni item ekle
      // (If there are customizations, always add as new item)
      const customizationsTotal = customizations.reduce((sum, c) => sum + c.option_price, 0);
      set({
        items: [...currentItems, {
          ...item,
          quantity: 1,
          price: item.price + customizationsTotal, // Özelleştirme fiyatlarını ekle (Add customization prices)
          customizations,
          specialInstructions,
        }],
      });
    } else {
      // Özelleştirme yoksa, eski mantık (No customizations, old logic)
      const existingItem = currentItems.find((i) => i.id === item.id && !i.customizations);

      if (existingItem) {
        // Eğer ürün zaten sepette varsa, miktarını artır (If item exists, increase quantity)
        set({
          items: currentItems.map((i) =>
            i.id === item.id && !i.customizations ? { ...i, quantity: i.quantity + 1 } : i
          ),
        });
      } else {
        // Yeni ürün ekle (Add new item)
        set({
          items: [...currentItems, { ...item, quantity: 1 }],
        });
      }
    }
  },

  // Sepetten ürün çıkarma fonksiyonu (Remove item from cart function)
  removeItem: (itemId: string) => {
    set({
      items: get().items.filter((item) => item.id !== itemId),
    });
  },

  // Ürün miktarını güncelleme fonksiyonu (Update item quantity function)
  updateQuantity: (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      // Miktar 0 veya daha azsa, ürünü sepetten çıkar (If quantity is 0 or less, remove item)
      get().removeItem(itemId);
    } else {
      set({
        items: get().items.map((item) =>
          item.id === itemId ? { ...item, quantity } : item
        ),
      });
    }
  },

  // Sepeti temizleme fonksiyonu (Clear cart function)
  clearCart: () => {
    set({ items: [] });
  },

  // Toplam fiyatı hesaplama fonksiyonu (Calculate total price function)
  getTotalPrice: () => {
    return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
  },

  // Toplam ürün sayısını hesaplama fonksiyonu (Calculate total items function)
  getTotalItems: () => {
    return get().items.reduce((total, item) => total + item.quantity, 0);
  },
}));


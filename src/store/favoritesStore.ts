import { create } from 'zustand';
import { MenuItem } from '../types';

// Favoriler store tipi (Favorites store type)
interface FavoritesStore {
  favorites: MenuItem[]; // Favori ürünler listesi (Favorite items list)
  addFavorite: (item: MenuItem) => void; // Favorilere ekle (Add to favorites)
  removeFavorite: (itemId: string) => void; // Favorilerden çıkar (Remove from favorites)
  isFavorite: (itemId: string) => boolean; // Favori mi kontrol et (Check if favorite)
  toggleFavorite: (item: MenuItem) => void; // Favori durumunu değiştir (Toggle favorite)
}

// Favoriler store'u oluştur (Create favorites store)
export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  favorites: [],

  // Favorilere ekle (Add to favorites)
  addFavorite: (item) =>
    set((state) => {
      // Zaten favorilerde mi kontrol et (Check if already in favorites)
      if (state.favorites.some((fav) => fav.id === item.id)) {
        return state;
      }
      return { favorites: [...state.favorites, item] };
    }),

  // Favorilerden çıkar (Remove from favorites)
  removeFavorite: (itemId) =>
    set((state) => ({
      favorites: state.favorites.filter((item) => item.id !== itemId),
    })),

  // Favori mi kontrol et (Check if favorite)
  isFavorite: (itemId) => {
    return get().favorites.some((item) => item.id === itemId);
  },

  // Favori durumunu değiştir (Toggle favorite)
  toggleFavorite: (item) => {
    const { isFavorite, addFavorite, removeFavorite } = get();
    if (isFavorite(item.id)) {
      removeFavorite(item.id);
    } else {
      addFavorite(item);
    }
  },
}));


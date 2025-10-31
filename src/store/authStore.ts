import { create } from 'zustand';
import { User } from '../types/database.types';
import { signIn, signUp, signOut, getCurrentUser, onAuthStateChange } from '../services/authService';

// Auth Store State (Auth Store Durumu)
interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions (İşlemler)
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  setUser: (user: User | null) => void;
}

// Auth Store oluştur (Create Auth Store)
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  // Giriş yap (Login)
  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true });
      const { user } = await signIn(email, password);
      set({ 
        user, 
        isAuthenticated: true, 
        isLoading: false 
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // Kayıt ol (Register)
  register: async (email: string, password: string, fullName: string, phone: string) => {
    try {
      set({ isLoading: true });
      const { user } = await signUp(email, password, fullName, phone);
      set({ 
        user, 
        isAuthenticated: true, 
        isLoading: false 
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // Çıkış yap (Logout)
  logout: async () => {
    try {
      await signOut();
      set({ 
        user: null, 
        isAuthenticated: false 
      });
    } catch (error) {
      throw error;
    }
  },

  // Başlangıçta kullanıcıyı kontrol et (Initialize - check user on app start)
  initialize: async () => {
    try {
      set({ isLoading: true });
      const user = await getCurrentUser();
      
      if (user) {
        set({ 
          user, 
          isAuthenticated: true, 
          isLoading: false 
        });
      } else {
        set({ 
          user: null, 
          isAuthenticated: false, 
          isLoading: false 
        });
      }

      // Auth değişikliklerini dinle (Listen to auth changes)
      onAuthStateChange((user) => {
        set({ 
          user, 
          isAuthenticated: !!user 
        });
      });
    } catch (error) {
      console.error('Initialize error:', error);
      set({ 
        user: null, 
        isAuthenticated: false, 
        isLoading: false 
      });
    }
  },

  // Kullanıcıyı manuel olarak ayarla (Set user manually)
  setUser: (user: User | null) => {
    set({ 
      user, 
      isAuthenticated: !!user 
    });
  },
}));


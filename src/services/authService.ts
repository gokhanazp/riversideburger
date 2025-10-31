import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types/database.types';

// Kayıt olma (Sign up)
export const signUp = async (
  email: string,
  password: string,
  fullName: string,
  phone: string,
  role: UserRole = 'customer'
) => {
  try {
    // 1. Auth kullanıcısı oluştur (Create auth user with metadata)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
          role: role,
        }
      }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Kullanıcı oluşturulamadı');

    // Trigger otomatik users tablosuna ekleyecek
    // Biraz bekleyelim (Wait a bit for trigger to complete)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // User bilgilerini al (Get user info)
    const userData = {
      id: authData.user.id,
      email: authData.user.email || email,
      role: role,
      full_name: fullName,
      phone: phone,
      created_at: authData.user.created_at,
    };

    return { user: userData as User, session: authData.session };
  } catch (error: any) {
    console.error('Sign up error:', error);
    throw error;
  }
};

// Giriş yapma (Sign in)
export const signIn = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Giriş başarısız');

    // Kullanıcı bilgilerini metadata'dan al (Get user info from metadata)
    const userData: User = {
      id: data.user.id,
      email: data.user.email || email,
      role: (data.user.user_metadata?.role as UserRole) || 'customer',
      full_name: data.user.user_metadata?.full_name || '',
      phone: data.user.user_metadata?.phone || '',
      created_at: data.user.created_at,
    };

    return { user: userData, session: data.session };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  }
};

// Çıkış yapma (Sign out)
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error: any) {
    console.error('Sign out error:', error);
    throw error;
  }
};

// Mevcut kullanıcıyı al (Get current user)
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) return null;

    // Kullanıcı bilgilerini metadata'dan al (Get user info from metadata)
    const userData: User = {
      id: authUser.id,
      email: authUser.email || '',
      role: (authUser.user_metadata?.role as UserRole) || 'customer',
      full_name: authUser.user_metadata?.full_name || '',
      phone: authUser.user_metadata?.phone || '',
      created_at: authUser.created_at,
    };

    return userData;
  } catch (error: any) {
    console.error('Get current user error:', error);
    return null;
  }
};

// Session değişikliklerini dinle (Listen to auth changes)
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const userData: User = {
        id: session.user.id,
        email: session.user.email || '',
        role: (session.user.user_metadata?.role as UserRole) || 'customer',
        full_name: session.user.user_metadata?.full_name || '',
        phone: session.user.user_metadata?.phone || '',
        created_at: session.user.created_at,
      };

      callback(userData);
    } else {
      callback(null);
    }
  });
};

// Şifre sıfırlama (Reset password)
export const resetPassword = async (email: string) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  } catch (error: any) {
    console.error('Reset password error:', error);
    throw error;
  }
};

// Şifre güncelleme (Update password)
export const updatePassword = async (newPassword: string) => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  } catch (error: any) {
    console.error('Update password error:', error);
    throw error;
  }
};


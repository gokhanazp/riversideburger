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

    // Kullanıcı bilgilerini users tablosundan al (Get user info from users table)
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (dbError) {
      console.error('Database user fetch error:', dbError);
      // Fallback to metadata if database fetch fails
      const userData: User = {
        id: data.user.id,
        email: data.user.email || email,
        role: (data.user.user_metadata?.role as UserRole) || 'customer',
        full_name: data.user.user_metadata?.full_name || '',
        phone: data.user.user_metadata?.phone || '',
        points: 0,
        created_at: data.user.created_at,
      };
      return { user: userData, session: data.session };
    }

    // Database'den gelen kullanıcı bilgilerini kullan (Use user info from database)
    const userData: User = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role as UserRole,
      full_name: dbUser.full_name || '',
      phone: dbUser.phone || '',
      points: dbUser.points || 0,
      created_at: dbUser.created_at,
      updated_at: dbUser.updated_at,
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
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    // Refresh token hatası varsa session'ı temizle (Clear session if refresh token error)
    if (authError) {
      console.error('Auth error:', authError);
      if (authError.message?.includes('refresh_token_not_found') ||
          authError.message?.includes('Invalid Refresh Token')) {
        console.log('🔄 Invalid session detected, clearing...');
        await supabase.auth.signOut();
        return null;
      }
    }

    if (!authUser) return null;

    // Kullanıcı bilgilerini users tablosundan al (Get user info from users table)
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (dbError) {
      console.error('Database user fetch error:', dbError);
      // Fallback to metadata if database fetch fails
      const userData: User = {
        id: authUser.id,
        email: authUser.email || '',
        role: (authUser.user_metadata?.role as UserRole) || 'customer',
        full_name: authUser.user_metadata?.full_name || '',
        phone: authUser.user_metadata?.phone || '',
        points: 0,
        created_at: authUser.created_at,
      };
      return userData;
    }

    // Database'den gelen kullanıcı bilgilerini kullan (Use user info from database)
    const userData: User = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role as UserRole,
      full_name: dbUser.full_name || '',
      phone: dbUser.phone || '',
      points: dbUser.points || 0,
      created_at: dbUser.created_at,
      updated_at: dbUser.updated_at,
    };

    return userData;
  } catch (error: any) {
    console.error('Get current user error:', error);
    // Refresh token hatası varsa session'ı temizle (Clear session if refresh token error)
    if (error.message?.includes('refresh_token_not_found') ||
        error.message?.includes('Invalid Refresh Token')) {
      console.log('🔄 Invalid session detected in catch, clearing...');
      await supabase.auth.signOut();
    }
    return null;
  }
};

// Session değişikliklerini dinle (Listen to auth changes)
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    // Token expire olduğunda otomatik logout (Auto logout on token expiry)
    if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
      console.log('🔄 Auth event:', event);
    }

    if (session?.user) {
      try {
        // Kullanıcı bilgilerini users tablosundan al (Get user info from users table)
        const { data: dbUser, error: dbError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (dbError) {
          console.error('Database user fetch error:', dbError);
          // Fallback to metadata if database fetch fails
          const userData: User = {
            id: session.user.id,
            email: session.user.email || '',
            role: (session.user.user_metadata?.role as UserRole) || 'customer',
            full_name: session.user.user_metadata?.full_name || '',
            phone: session.user.user_metadata?.phone || '',
            points: 0,
            created_at: session.user.created_at,
          };
          callback(userData);
          return;
        }

        // Database'den gelen kullanıcı bilgilerini kullan (Use user info from database)
        const userData: User = {
          id: dbUser.id,
          email: dbUser.email,
          role: dbUser.role as UserRole,
          full_name: dbUser.full_name || '',
          phone: dbUser.phone || '',
          points: dbUser.points || 0,
          created_at: dbUser.created_at,
          updated_at: dbUser.updated_at,
        };

        callback(userData);
      } catch (error: any) {
        console.error('Auth state change error:', error);
        // Hata durumunda null döndür (Return null on error)
        callback(null);
      }
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


import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types/database.types';
import i18n from '../i18n';

// Kayıt olma (Sign up)
export const signUp = async (
  email: string,
  password: string,
  fullName: string,
  phone: string,
  role: UserRole = 'customer'
) => {
  try {
    console.log('🔐 Starting signup process for:', email);

    // 1. Auth kullanıcısı oluştur (Create auth user with metadata)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined, // Email confirmation'ı devre dışı bırak (Disable email confirmation)
        data: {
          full_name: fullName,
          phone: phone,
          role: role,
        }
      }
    });

    console.log('📧 Signup response:', {
      user: authData.user?.id,
      session: !!authData.session,
      error: authError
    });

    if (authError) {
      console.error('❌ Auth error:', authError);
      console.error('❌ Auth error details:', JSON.stringify(authError, null, 2));
      console.error('❌ Auth error message:', authError.message);
      console.error('❌ Auth error status:', authError.status);

      // Database error durumunda daha açıklayıcı mesaj (More descriptive message for database errors)
      if (authError.message?.includes('Database error')) {
        throw new Error('Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin veya farklı bir email kullanın.');
      }

      throw authError;
    }

    if (!authData.user) {
      console.error('❌ No user returned');
      throw new Error(i18n.t('auth.registerFailed'));
    }

    // Email confirmation gerekiyorsa kullanıcıyı bilgilendir (Inform user if email confirmation required)
    if (authData.user && !authData.session) {
      console.log('📧 Email confirmation required');
      throw new Error(i18n.t('auth.pleaseConfirmEmail'));
    }

    // Direkt manuel olarak kullanıcı oluştur (Create user manually - trigger'a güvenme)
    console.log('📝 Creating user in database manually...');

    let dbUser = null;

    try {
      // Önce var mı kontrol et (Check if user already exists)
      // NOT: .single() kullanmıyoruz çünkü yoksa hata veriyor
      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id);

      // Hata varsa ama "no rows" hatası değilse logla
      if (checkError && checkError.code !== 'PGRST116') {
        console.warn('⚠️ Error checking existing user:', checkError);
      }

      if (existingUsers && existingUsers.length > 0) {
        console.log('✅ User already exists in database!');
        dbUser = existingUsers[0];
      } else {
        // Yoksa oluştur (Create if doesn't exist)
        console.log('📝 Inserting user into database...');
        const { data: insertedUser, error: insertError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: authData.user.email || email,
            role: role,
            full_name: fullName,
            phone: phone,
            points: 0,
            created_at: authData.user.created_at,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ Manual insert failed:', insertError);
          console.error('   Error details:', JSON.stringify(insertError, null, 2));

          // Son bir deneme daha - upsert kullan (Last try - use upsert)
          console.log('🔄 Trying upsert...');
          const { data: upsertedUser, error: upsertError } = await supabase
            .from('users')
            .upsert({
              id: authData.user.id,
              email: authData.user.email || email,
              role: role,
              full_name: fullName,
              phone: phone,
              points: 0,
              created_at: authData.user.created_at,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'id'
            })
            .select()
            .single();

          if (upsertError) {
            console.error('❌ Upsert also failed:', upsertError);
            // Fallback to metadata
            const userData: User = {
              id: authData.user.id,
              email: authData.user.email || email,
              role: role,
              full_name: fullName,
              phone: phone,
              points: 0,
              created_at: authData.user.created_at,
            };
            console.log('✅ Using metadata fallback');
            return { user: userData, session: authData.session };
          }

          dbUser = upsertedUser;
          console.log('✅ User created via upsert!');
        } else {
          dbUser = insertedUser;
          console.log('✅ User manually created in database!');
        }
      }
    } catch (err: any) {
      console.error('❌ Database operation exception:', err);
      console.error('   Exception details:', JSON.stringify(err, null, 2));

      // Fallback to metadata
      const userData: User = {
        id: authData.user.id,
        email: authData.user.email || email,
        role: role,
        full_name: fullName,
        phone: phone,
        points: 0,
        created_at: authData.user.created_at,
      };
      console.log('✅ Using metadata fallback after exception');
      return { user: userData, session: authData.session };
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

    console.log('✅ Signup successful:', userData.email);
    return { user: userData, session: authData.session };
  } catch (error: any) {
    console.error('❌ Sign up error:', error);

    // Kullanıcı dostu hata mesajları (User-friendly error messages)
    if (error.message?.includes('already registered') || error.message?.includes('User already registered')) {
      throw new Error(i18n.t('auth.emailAlreadyRegistered'));
    }
    if (error.message?.includes('Invalid email')) {
      throw new Error(i18n.t('auth.invalidEmail'));
    }
    if (error.message?.includes('Password')) {
      throw new Error(i18n.t('auth.passwordRequirement'));
    }
    if (error.message?.includes('Database error')) {
      throw new Error('Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.');
    }

    throw error;
  }
};

// Giriş yapma (Sign in)
export const signIn = async (email: string, password: string) => {
  try {
    console.log('🔐 Starting login process for:', email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('📧 Login response:', {
      user: data.user?.id,
      session: !!data.session,
      error: error
    });

    if (error) {
      console.error('❌ Auth error:', error);
      throw error;
    }

    if (!data.user) {
      console.error('❌ No user returned');
      throw new Error(i18n.t('auth.loginFailed'));
    }

    // Kullanıcı bilgilerini users tablosundan al (Get user info from users table)
    console.log('📊 Fetching user from database...');
    const { data: dbUsers, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id);

    // Hata varsa ama "no rows" hatası değilse logla
    if (dbError && dbError.code !== 'PGRST116') {
      console.warn('⚠️ Error fetching user:', dbError);
    }

    const dbUser = dbUsers && dbUsers.length > 0 ? dbUsers[0] : null;

    if (!dbUser) {
      console.warn('⚠️ User not found in database, creating now...');

      // Users tablosunda yoksa, şimdi oluştur (Create if not exists)
      try {
        const { data: insertedUser, error: insertError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: data.user.email || email,
            role: (data.user.user_metadata?.role as UserRole) || 'customer',
            full_name: data.user.user_metadata?.full_name || '',
            phone: data.user.user_metadata?.phone || '',
            points: 0,
            created_at: data.user.created_at,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ Failed to create user in database:', insertError);
          // Fallback to metadata
          const userData: User = {
            id: data.user.id,
            email: data.user.email || email,
            role: (data.user.user_metadata?.role as UserRole) || 'customer',
            full_name: data.user.user_metadata?.full_name || '',
            phone: data.user.user_metadata?.phone || '',
            points: 0,
            created_at: data.user.created_at,
          };
          console.log('✅ Using metadata fallback');
          return { user: userData, session: data.session };
        }

        console.log('✅ User created in database during login!');

        // Yeni oluşturulan kullanıcıyı kullan (Use newly created user)
        const userData: User = {
          id: insertedUser.id,
          email: insertedUser.email,
          role: insertedUser.role as UserRole,
          full_name: insertedUser.full_name || '',
          phone: insertedUser.phone || '',
          points: insertedUser.points || 0,
          created_at: insertedUser.created_at,
          updated_at: insertedUser.updated_at,
        };

        return { user: userData, session: data.session };

      } catch (err) {
        console.error('❌ Exception creating user:', err);
        // Fallback to metadata
        const userData: User = {
          id: data.user.id,
          email: data.user.email || email,
          role: (data.user.user_metadata?.role as UserRole) || 'customer',
          full_name: data.user.user_metadata?.full_name || '',
          phone: data.user.user_metadata?.phone || '',
          points: 0,
          created_at: data.user.created_at,
        };
        console.log('✅ Using metadata fallback after exception');
        return { user: userData, session: data.session };
      }
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

    console.log('✅ Login successful:', userData.email);
    return { user: userData, session: data.session };
  } catch (error: any) {
    console.error('❌ Sign in error:', error);

    // Kullanıcı dostu hata mesajları (User-friendly error messages)
    if (error.message?.includes('Invalid login credentials')) {
      throw new Error(i18n.t('auth.emailOrPasswordWrong'));
    }
    if (error.message?.includes('Email not confirmed')) {
      throw new Error(i18n.t('auth.pleaseConfirmEmail'));
    }

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
    const { data: dbUsers, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id);

    // Hata varsa ama "no rows" hatası değilse logla
    if (dbError && dbError.code !== 'PGRST116') {
      console.warn('⚠️ Error fetching user (getCurrentUser):', dbError);
    }

    const dbUser = dbUsers && dbUsers.length > 0 ? dbUsers[0] : null;

    if (!dbUser) {
      console.warn('⚠️ User not found in database (getCurrentUser), creating now...');

      // Users tablosunda yoksa, şimdi oluştur (Create if not exists)
      try {
        const { data: insertedUser, error: insertError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email || '',
            role: (authUser.user_metadata?.role as UserRole) || 'customer',
            full_name: authUser.user_metadata?.full_name || '',
            phone: authUser.user_metadata?.phone || '',
            points: 0,
            created_at: authUser.created_at,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ Failed to create user in database (getCurrentUser):', insertError);
          // Fallback to metadata
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

        console.log('✅ User created in database (getCurrentUser)!');

        // Yeni oluşturulan kullanıcıyı kullan (Use newly created user)
        const userData: User = {
          id: insertedUser.id,
          email: insertedUser.email,
          role: insertedUser.role as UserRole,
          full_name: insertedUser.full_name || '',
          phone: insertedUser.phone || '',
          points: insertedUser.points || 0,
          created_at: insertedUser.created_at,
          updated_at: insertedUser.updated_at,
        };

        return userData;

      } catch (err) {
        console.error('❌ Exception creating user (getCurrentUser):', err);
        // Fallback to metadata
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
        const { data: dbUsers, error: dbError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id);

        // Hata varsa ama "no rows" hatası değilse logla
        if (dbError && dbError.code !== 'PGRST116') {
          console.error('Database user fetch error:', dbError);
        }

        const dbUser = dbUsers && dbUsers.length > 0 ? dbUsers[0] : null;

        if (!dbUser) {
          // Users tablosunda yoksa, şimdi oluştur (Create if not exists)
          console.warn('⚠️ User not found in database (onAuthStateChange), creating now...');

          try {
            const { data: insertedUser, error: insertError } = await supabase
              .from('users')
              .insert({
                id: session.user.id,
                email: session.user.email || '',
                role: (session.user.user_metadata?.role as UserRole) || 'customer',
                full_name: session.user.user_metadata?.full_name || '',
                phone: session.user.user_metadata?.phone || '',
                points: 0,
                created_at: session.user.created_at,
                updated_at: new Date().toISOString(),
              })
              .select();

            if (insertError || !insertedUser || insertedUser.length === 0) {
              console.error('❌ Failed to create user in database (onAuthStateChange):', insertError);
              // Fallback to metadata
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

            console.log('✅ User created in database (onAuthStateChange)!');

            // Yeni oluşturulan kullanıcıyı kullan (Use newly created user)
            const userData: User = {
              id: insertedUser[0].id,
              email: insertedUser[0].email,
              role: insertedUser[0].role as UserRole,
              full_name: insertedUser[0].full_name || '',
              phone: insertedUser[0].phone || '',
              points: insertedUser[0].points || 0,
              created_at: insertedUser[0].created_at,
              updated_at: insertedUser[0].updated_at,
            };

            callback(userData);
            return;

          } catch (err) {
            console.error('❌ Exception creating user (onAuthStateChange):', err);
            // Fallback to metadata
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

// Hesabı sil (Delete account)
export const deleteAccount = async () => {
  try {
    console.log('🗑️ Deleting user account...');
    
    // 1. Önce RPC fonksiyonunu dene (tercih edilen yöntem)
    const { error: rpcError } = await supabase.rpc('delete_user');
    
    if (!rpcError) {
      console.log('✅ User deleted via RPC');
      await supabase.auth.signOut();
      return;
    }

    console.warn('⚠️ RPC delete_user failed or not found, trying manual cleanup:', rpcError);

    // 2. RPC yoksa manuel temizlik (Sadece public verileri silebilir)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Public users tablosundan sil
      const { error: dbError } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);
        
      if (dbError) {
        console.error('❌ Failed to delete from public.users:', dbError);
        // Devam et, auth logout yapacağız
      }
      
      // Auth'dan çıkış yap
      await supabase.auth.signOut();
      
      // Not: Auth kullanıcısı Supabase panelinden manuel silinmeli
      // çünkü client-side'dan auth.users tablosuna erişim yok
      throw new Error('Hesabınızın verileri temizlendi. Tam silinme için yöneticinizle iletişime geçin veya "delete_user" RPC fonksiyonunu kurun.');
    }
  } catch (error: any) {
    console.error('Delete account error:', error);
    throw error;
  }
};


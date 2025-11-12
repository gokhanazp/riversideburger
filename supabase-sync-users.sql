-- ============================================
-- AUTH VE USERS TABLOSUNU SENKRONIZE ET
-- ============================================

-- 1. Eksik kullanıcıları kontrol et
SELECT 
  au.id,
  au.email as auth_email,
  au.created_at,
  u.email as user_email,
  CASE 
    WHEN u.id IS NULL THEN '❌ Users tablosunda YOK'
    ELSE '✅ Users tablosunda VAR'
  END as status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
ORDER BY au.created_at DESC;

-- 2. Eksik kullanıcıları otomatik ekle
INSERT INTO public.users (id, email, role, full_name, phone, points, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'role', 'customer'),
  COALESCE(au.raw_user_meta_data->>'full_name', ''),
  COALESCE(au.raw_user_meta_data->>'phone', ''),
  0,
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Sonuç kontrol
SELECT 
  (SELECT COUNT(*) FROM auth.users) as auth_users_count,
  (SELECT COUNT(*) FROM public.users) as users_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users) = (SELECT COUNT(*) FROM public.users) 
    THEN '✅ SENKRONIZE'
    ELSE '❌ FARKLI'
  END as sync_status;

-- 4. Son kullanıcıları göster
SELECT 
  au.email as auth_email,
  u.email as user_email,
  u.full_name,
  u.phone,
  u.role,
  u.points,
  CASE 
    WHEN u.id IS NULL THEN '❌ YOK'
    ELSE '✅ VAR'
  END as status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
ORDER BY au.created_at DESC
LIMIT 10;


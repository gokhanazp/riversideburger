-- Supabase Linter Hatalarını Giderme Migrasyonu
-- Creation Date: 2025-12-17

-- 1. FIX: security_definer_view
-- View `public.product_options_grouped` is defined with the SECURITY DEFINER property.
-- This forces the view to run with the privileges of the creator (likely postgres/admin)
-- rather than the querying user, bypassing RLS.
-- Solution: Set security_invoker = true to enforce permissions of the caller.
ALTER VIEW public.product_options_grouped SET (security_invoker = true);


-- 2. FIX: rls_disabled_in_public (public.users)
-- Table `public.users` is public, but RLS has not been enabled.
-- Solution: Enable RLS.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Ensure essential policies exist for users table if they don't already
-- (Using DO block to avoid errors if policies exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can view own data'
    ) THEN
        CREATE POLICY "Users can view own data" ON public.users FOR SELECT USING (auth.uid() = id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can update own data'
    ) THEN
        CREATE POLICY "Users can update own data" ON public.users FOR UPDATE USING (auth.uid() = id);
    END IF;
END
$$;


-- 3. FIX: rls_disabled_in_public (public.addresses_backup)
-- Table `public.addresses_backup` is public, but RLS has not been enabled.
-- Solution: Enable RLS. Since it's likely a backup, we default to deny all (no policies added = deny all).
ALTER TABLE IF EXISTS public.addresses_backup ENABLE ROW LEVEL SECURITY;


-- 4. FIX: rls_references_user_metadata (public.notifications)
-- RLS policies on `notifications` reference `auth.jwt() -> user_metadata`, which is insecure.
-- Solution: Reference `public.users.role` instead.

-- Drop insecure policies
DROP POLICY IF EXISTS "Admins can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;

-- Recreate policies using secure lookup
-- Admin Check Helper: EXISTS(SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')

-- Policy: Admins can create notifications
CREATE POLICY "Admins can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE public.users.id = auth.uid()
    AND public.users.role = 'admin'
  )
);

-- Policy: Admins can view all notifications
CREATE POLICY "Admins can view all notifications"
ON public.notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE public.users.id = auth.uid()
    AND public.users.role = 'admin'
  )
);

-- Policy: Admins can delete notifications
CREATE POLICY "Admins can delete notifications"
ON public.notifications
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE public.users.id = auth.uid()
    AND public.users.role = 'admin'
  )
);

-- Drop existing policies if they conflict
DROP POLICY IF EXISTS "Enable read access for all users" ON public.app_settings;
DROP POLICY IF EXISTS "Enable update for admins" ON public.app_settings;
DROP POLICY IF EXISTS "Enable insert for admins" ON public.app_settings;

-- Create comprehensive policies for app_settings table

-- 1. READ: Allow everyone to read settings (anonymous and authenticated)
CREATE POLICY "Enable read access for all users" 
ON public.app_settings FOR SELECT 
USING (true);

-- 2. UPDATE: Allow admins to update settings
CREATE POLICY "Enable update for admins" 
ON public.app_settings FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'admin'
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'admin'
  )
);

-- 3. INSERT: Allow admins to insert new settings (Crucial fix for your error)
CREATE POLICY "Enable insert for admins" 
ON public.app_settings FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'admin'
  )
);

-- Enable RLS on the table
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

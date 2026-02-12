CREATE POLICY "Allow admin insert" ON public.app_settings FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

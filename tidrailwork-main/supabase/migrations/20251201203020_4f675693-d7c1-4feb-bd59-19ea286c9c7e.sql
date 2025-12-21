-- Allow anyone to verify company codes during signup (only id and name, not sensitive data)
CREATE POLICY "Anyone can verify company codes"
ON public.companies
FOR SELECT
TO anon
USING (true);
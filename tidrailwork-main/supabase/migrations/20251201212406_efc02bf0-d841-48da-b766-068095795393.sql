
-- Allow super admins to delete companies
DROP POLICY IF EXISTS "Super admins can delete companies" ON public.companies;
CREATE POLICY "Super admins can delete companies" 
ON public.companies 
FOR DELETE 
USING (is_super_admin(auth.uid()));

-- Allow super admins to insert companies
DROP POLICY IF EXISTS "Super admins can create companies" ON public.companies;
CREATE POLICY "Super admins can create companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (is_super_admin(auth.uid()));

-- Allow super admins to update companies
DROP POLICY IF EXISTS "Super admins can update all companies" ON public.companies;
CREATE POLICY "Super admins can update all companies" 
ON public.companies 
FOR UPDATE 
USING (is_super_admin(auth.uid()));

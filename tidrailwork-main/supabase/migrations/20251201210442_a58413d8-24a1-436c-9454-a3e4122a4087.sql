-- Update user_roles policies to be company-scoped
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Admins can only manage roles for users in their company
CREATE POLICY "Admins can manage company user roles" ON public.user_roles
FOR ALL USING (
  has_role(auth.uid(), 'admin') AND 
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = user_roles.user_id 
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

-- Admins can only view roles for users in their company
CREATE POLICY "Admins can view company user roles" ON public.user_roles
FOR SELECT USING (
  has_role(auth.uid(), 'admin') AND 
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = user_roles.user_id 
    AND p.company_id = get_user_company_id(auth.uid())
  )
);
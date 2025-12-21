
-- Fix job_roles: restrict to same company
DROP POLICY IF EXISTS "Everyone can view active job roles" ON public.job_roles;
CREATE POLICY "Users can view their company job roles" 
ON public.job_roles 
FOR SELECT 
USING (
  active = true 
  AND company_id = get_user_company_id(auth.uid())
);

-- Fix material_types: restrict to same company
DROP POLICY IF EXISTS "Everyone can view active material types" ON public.material_types;
CREATE POLICY "Users can view their company material types" 
ON public.material_types 
FOR SELECT 
USING (
  active = true 
  AND company_id = get_user_company_id(auth.uid())
);

-- Fix subprojects: restrict to same company
DROP POLICY IF EXISTS "Everyone can view active subprojects" ON public.subprojects;
CREATE POLICY "Users can view their company subprojects" 
ON public.subprojects 
FOR SELECT 
USING (
  active = true 
  AND company_id = get_user_company_id(auth.uid())
);

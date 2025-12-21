
-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- Update RLS policies to allow super_admin access to all companies
DROP POLICY IF EXISTS "Super admins can view all companies" ON public.companies;
CREATE POLICY "Super admins can view all companies" 
ON public.companies 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Super admin access to all profiles
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Super admin access to all time_entries
DROP POLICY IF EXISTS "Super admins can view all time entries" ON public.time_entries;
CREATE POLICY "Super admins can view all time entries" 
ON public.time_entries 
FOR SELECT 
USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can manage all time entries" ON public.time_entries;
CREATE POLICY "Super admins can manage all time entries" 
ON public.time_entries 
FOR ALL 
USING (is_super_admin(auth.uid()));

-- Super admin access to all projects
DROP POLICY IF EXISTS "Super admins can view all projects" ON public.projects;
CREATE POLICY "Super admins can view all projects" 
ON public.projects 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Super admin access to all user_roles
DROP POLICY IF EXISTS "Super admins can view all user roles" ON public.user_roles;
CREATE POLICY "Super admins can view all user roles" 
ON public.user_roles 
FOR SELECT 
USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can manage all user roles" ON public.user_roles;
CREATE POLICY "Super admins can manage all user roles" 
ON public.user_roles 
FOR ALL 
USING (is_super_admin(auth.uid()));

-- Super admin access to all deviation_reports
DROP POLICY IF EXISTS "Super admins can view all deviation reports" ON public.deviation_reports;
CREATE POLICY "Super admins can view all deviation reports" 
ON public.deviation_reports 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Super admin access to all job_roles
DROP POLICY IF EXISTS "Super admins can view all job roles" ON public.job_roles;
CREATE POLICY "Super admins can view all job roles" 
ON public.job_roles 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Super admin access to all material_types
DROP POLICY IF EXISTS "Super admins can view all material types" ON public.material_types;
CREATE POLICY "Super admins can view all material types" 
ON public.material_types 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Super admin access to all material_reports
DROP POLICY IF EXISTS "Super admins can view all material reports" ON public.material_reports;
CREATE POLICY "Super admins can view all material reports" 
ON public.material_reports 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Super admin access to all subprojects
DROP POLICY IF EXISTS "Super admins can view all subprojects" ON public.subprojects;
CREATE POLICY "Super admins can view all subprojects" 
ON public.subprojects 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Super admin access to all scheduled_assignments
DROP POLICY IF EXISTS "Super admins can view all scheduled assignments" ON public.scheduled_assignments;
CREATE POLICY "Super admins can view all scheduled assignments" 
ON public.scheduled_assignments 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Create a helper function to get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id
$$;

-- Drop existing policies that allow admins to see all data regardless of company

-- profiles policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

CREATE POLICY "Admins can view company profiles" ON public.profiles
FOR SELECT USING (
  has_role(auth.uid(), 'admin') AND 
  company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Admins can update company profiles" ON public.profiles
FOR UPDATE USING (
  has_role(auth.uid(), 'admin') AND 
  company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Admins can insert company profiles" ON public.profiles
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin') AND 
  company_id = get_user_company_id(auth.uid())
);

-- projects policies
DROP POLICY IF EXISTS "Admins can manage projects" ON public.projects;

CREATE POLICY "Admins can manage company projects" ON public.projects
FOR ALL USING (
  has_role(auth.uid(), 'admin') AND 
  company_id = get_user_company_id(auth.uid())
);

-- subprojects policies
DROP POLICY IF EXISTS "Admins can manage subprojects" ON public.subprojects;

CREATE POLICY "Admins can manage company subprojects" ON public.subprojects
FOR ALL USING (
  has_role(auth.uid(), 'admin') AND 
  company_id = get_user_company_id(auth.uid())
);

-- job_roles policies
DROP POLICY IF EXISTS "Admins can manage job roles" ON public.job_roles;

CREATE POLICY "Admins can manage company job roles" ON public.job_roles
FOR ALL USING (
  has_role(auth.uid(), 'admin') AND 
  company_id = get_user_company_id(auth.uid())
);

-- material_types policies
DROP POLICY IF EXISTS "Admins can manage material types" ON public.material_types;

CREATE POLICY "Admins can manage company material types" ON public.material_types
FOR ALL USING (
  has_role(auth.uid(), 'admin') AND 
  company_id = get_user_company_id(auth.uid())
);

-- time_entries policies
DROP POLICY IF EXISTS "Admins can manage all time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Admins can view all time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Admins can attest time entries" ON public.time_entries;

CREATE POLICY "Admins can manage company time entries" ON public.time_entries
FOR ALL USING (
  has_role(auth.uid(), 'admin') AND 
  company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Admins can view company time entries" ON public.time_entries
FOR SELECT USING (
  has_role(auth.uid(), 'admin') AND 
  company_id = get_user_company_id(auth.uid())
);

-- deviation_reports policies
DROP POLICY IF EXISTS "Admins can manage all deviation reports" ON public.deviation_reports;
DROP POLICY IF EXISTS "Admins can view all deviation reports" ON public.deviation_reports;

CREATE POLICY "Admins can manage company deviation reports" ON public.deviation_reports
FOR ALL USING (
  has_role(auth.uid(), 'admin') AND 
  company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Admins can view company deviation reports" ON public.deviation_reports
FOR SELECT USING (
  has_role(auth.uid(), 'admin') AND 
  company_id = get_user_company_id(auth.uid())
);

-- deviation_images policies
DROP POLICY IF EXISTS "Admins can manage all deviation images" ON public.deviation_images;
DROP POLICY IF EXISTS "Admins can view all deviation images" ON public.deviation_images;

CREATE POLICY "Admins can manage company deviation images" ON public.deviation_images
FOR ALL USING (
  has_role(auth.uid(), 'admin') AND 
  EXISTS (
    SELECT 1 FROM public.deviation_reports dr 
    WHERE dr.id = deviation_images.deviation_report_id 
    AND dr.company_id = get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Admins can view company deviation images" ON public.deviation_images
FOR SELECT USING (
  has_role(auth.uid(), 'admin') AND 
  EXISTS (
    SELECT 1 FROM public.deviation_reports dr 
    WHERE dr.id = deviation_images.deviation_report_id 
    AND dr.company_id = get_user_company_id(auth.uid())
  )
);

-- material_reports policies
DROP POLICY IF EXISTS "Admins can manage all material reports" ON public.material_reports;
DROP POLICY IF EXISTS "Admins can view all material reports" ON public.material_reports;

CREATE POLICY "Admins can manage company material reports" ON public.material_reports
FOR ALL USING (
  has_role(auth.uid(), 'admin') AND 
  company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Admins can view company material reports" ON public.material_reports
FOR SELECT USING (
  has_role(auth.uid(), 'admin') AND 
  company_id = get_user_company_id(auth.uid())
);

-- scheduled_assignments policies
DROP POLICY IF EXISTS "Admins can manage all assignments" ON public.scheduled_assignments;

CREATE POLICY "Admins can manage company assignments" ON public.scheduled_assignments
FOR ALL USING (
  has_role(auth.uid(), 'admin') AND 
  company_id = get_user_company_id(auth.uid())
);

-- companies policies - admins can only see their own company
DROP POLICY IF EXISTS "Admins can manage companies" ON public.companies;
DROP POLICY IF EXISTS "Admins can view all companies" ON public.companies;

CREATE POLICY "Admins can view own company" ON public.companies
FOR SELECT USING (
  has_role(auth.uid(), 'admin') AND 
  id = get_user_company_id(auth.uid())
);

CREATE POLICY "Admins can update own company" ON public.companies
FOR UPDATE USING (
  has_role(auth.uid(), 'admin') AND 
  id = get_user_company_id(auth.uid())
);
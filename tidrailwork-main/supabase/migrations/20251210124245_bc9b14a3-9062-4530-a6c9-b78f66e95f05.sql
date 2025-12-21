-- Create a security definer function that only returns necessary fields for company verification
CREATE OR REPLACE FUNCTION public.get_companies_for_login()
RETURNS TABLE (
  id uuid,
  name text,
  company_code text,
  logo_url text,
  is_active boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, company_code, logo_url, is_active
  FROM public.companies
  WHERE is_active = true
$$;

-- Create a function to verify a specific company code (returns minimal data)
CREATE OR REPLACE FUNCTION public.verify_company_code(code text)
RETURNS TABLE (
  id uuid,
  name text,
  logo_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, logo_url
  FROM public.companies
  WHERE company_code = code AND is_active = true
$$;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can verify company codes" ON public.companies;
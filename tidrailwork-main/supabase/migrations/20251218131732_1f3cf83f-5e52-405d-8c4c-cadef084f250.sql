-- Table for internal salary codes (default codes that come pre-configured)
CREATE TABLE public.fortnox_salary_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL, -- 'time', 'overtime', 'ob', 'absence', 'allowance'
  default_fortnox_code text, -- Default Fortnox code suggestion
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table for company-specific Fortnox code mappings
CREATE TABLE public.fortnox_company_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  internal_code text NOT NULL REFERENCES public.fortnox_salary_codes(code) ON DELETE CASCADE,
  fortnox_code text NOT NULL,
  fortnox_description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company_id, internal_code)
);

-- Table for tracking exported payroll periods (to prevent duplicate exports)
CREATE TABLE public.fortnox_export_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  employee_count integer NOT NULL,
  entry_count integer NOT NULL,
  exported_by uuid NOT NULL REFERENCES public.profiles(id),
  exported_at timestamp with time zone NOT NULL DEFAULT now(),
  filename text NOT NULL
);

-- Enable RLS
ALTER TABLE public.fortnox_salary_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fortnox_company_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fortnox_export_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for fortnox_salary_codes (read-only for all authenticated users)
CREATE POLICY "All authenticated users can view salary codes"
ON public.fortnox_salary_codes FOR SELECT
USING (auth.uid() IS NOT NULL);

-- RLS policies for fortnox_company_mappings
CREATE POLICY "Admins can manage company mappings"
ON public.fortnox_company_mappings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Super admins can manage all mappings"
ON public.fortnox_company_mappings FOR ALL
USING (is_super_admin(auth.uid()));

-- RLS policies for fortnox_export_logs
CREATE POLICY "Admins can manage company export logs"
ON public.fortnox_export_logs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Super admins can manage all export logs"
ON public.fortnox_export_logs FOR ALL
USING (is_super_admin(auth.uid()));

-- Insert default internal salary codes with Swedish descriptions
INSERT INTO public.fortnox_salary_codes (code, name, description, category, default_fortnox_code) VALUES
  ('ARBETE', 'Arbetad tid', 'Normal arbetad tid', 'time', '11'),
  ('OVERTID_50', 'Övertid 50%', 'Övertid med 50% tillägg (vardag)', 'overtime', '310'),
  ('OVERTID_100', 'Övertid 100%', 'Övertid med 100% tillägg (helg)', 'overtime', '320'),
  ('OB_KVALL', 'OB Kväll', 'OB-tillägg för kvällsarbete', 'ob', '530'),
  ('OB_NATT', 'OB Natt', 'OB-tillägg för nattarbete', 'ob', '540'),
  ('OB_HELG', 'OB Helg', 'OB-tillägg för helgarbete', 'ob', '550'),
  ('SJUK', 'Sjukfrånvaro', 'Sjukfrånvaro (karensdag + sjukdagar)', 'absence', '810'),
  ('SEMESTER', 'Semester', 'Semesterdagar', 'absence', '610'),
  ('RESTID', 'Restid', 'Restidsersättning', 'allowance', '430'),
  ('TRAKTAMENTE_HEL', 'Hel traktamente', 'Helt traktamente per dag', 'allowance', '710'),
  ('TRAKTAMENTE_HALV', 'Halv traktamente', 'Halvt traktamente per dag', 'allowance', '720');

-- Add trigger for updated_at on fortnox_company_mappings
CREATE TRIGGER update_fortnox_company_mappings_updated_at
  BEFORE UPDATE ON public.fortnox_company_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
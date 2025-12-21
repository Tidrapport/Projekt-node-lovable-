-- Add company_code column for unique company identification
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS company_code TEXT UNIQUE;

-- Generate unique company codes for existing companies
UPDATE public.companies 
SET company_code = UPPER(SUBSTRING(MD5(id::text) FROM 1 FOR 8))
WHERE company_code IS NULL;

-- Make company_code required for new entries
ALTER TABLE public.companies 
ALTER COLUMN company_code SET NOT NULL;

-- Add RLS policies for companies table
CREATE POLICY "Admins can view all companies"
ON public.companies
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage companies"
ON public.companies
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function to generate unique company code
CREATE OR REPLACE FUNCTION public.generate_company_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := UPPER(SUBSTRING(MD5(random()::text || clock_timestamp()::text) FROM 1 FOR 8));
    SELECT EXISTS(SELECT 1 FROM public.companies WHERE company_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$;
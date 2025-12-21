-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.generate_company_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Add RLS policies for scheduled_assignments table
CREATE POLICY "Admins can manage all assignments"
ON public.scheduled_assignments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own assignments"
ON public.scheduled_assignments
FOR SELECT
USING (auth.uid() = user_id);
-- Add org_number column to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS org_number text;

-- Create function to notify AdminHub when company is created
CREATE OR REPLACE FUNCTION public.notify_company_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call AdminHub sync-customer endpoint with register action
  PERFORM extensions.http_post(
    url := 'https://xlbasvniqinfbipsvmcv.supabase.co/functions/v1/sync-customer',
    body := json_build_object(
      'action', 'register',
      'company_name', NEW.name,
      'org_number', NEW.org_number,
      'email', NEW.billing_email,
      'user_count', 1
    )::text,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for company creation
DROP TRIGGER IF EXISTS on_company_created_notify_adminhub ON public.companies;
CREATE TRIGGER on_company_created_notify_adminhub
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_company_created();
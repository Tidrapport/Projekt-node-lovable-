-- Enable pg_net extension properly
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Update notify_company_created to use correct function
CREATE OR REPLACE FUNCTION public.notify_company_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call AdminHub sync-customer endpoint with register action using net.http_post
  PERFORM net.http_post(
    url := 'https://xlbasvniqinfbipsvmcv.supabase.co/functions/v1/sync-customer',
    body := json_build_object(
      'action', 'register',
      'company_name', NEW.name,
      'org_number', NEW.org_number,
      'email', NEW.billing_email,
      'user_count', 1
    )::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  
  RETURN NEW;
END;
$$;

-- Update notify_user_created to use correct function
CREATE OR REPLACE FUNCTION public.notify_user_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_record RECORD;
  user_count INTEGER;
BEGIN
  -- Get company info
  SELECT name, billing_email INTO company_record 
  FROM public.companies 
  WHERE id = NEW.company_id;
  
  -- Get current user count for this company
  SELECT COUNT(*) INTO user_count 
  FROM public.profiles 
  WHERE company_id = NEW.company_id;
  
  -- Call AdminHub sync-customer endpoint using net.http_post
  PERFORM net.http_post(
    url := 'https://xlbasvniqinfbipsvmcv.supabase.co/functions/v1/sync-customer',
    body := json_build_object(
      'action', 'update_users',
      'company_name', company_record.name,
      'email', company_record.billing_email,
      'user_count', user_count
    )::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  
  RETURN NEW;
END;
$$;

-- Update notify_user_deleted to use correct function
CREATE OR REPLACE FUNCTION public.notify_user_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_record RECORD;
  user_count INTEGER;
BEGIN
  -- Get company info
  SELECT name, billing_email INTO company_record 
  FROM public.companies 
  WHERE id = OLD.company_id;
  
  -- Get current user count for this company (after deletion)
  SELECT COUNT(*) INTO user_count 
  FROM public.profiles 
  WHERE company_id = OLD.company_id;
  
  -- Call AdminHub sync-customer endpoint using net.http_post
  PERFORM net.http_post(
    url := 'https://xlbasvniqinfbipsvmcv.supabase.co/functions/v1/sync-customer',
    body := json_build_object(
      'action', 'update_users',
      'company_name', company_record.name,
      'email', company_record.billing_email,
      'user_count', user_count
    )::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  
  RETURN OLD;
END;
$$;
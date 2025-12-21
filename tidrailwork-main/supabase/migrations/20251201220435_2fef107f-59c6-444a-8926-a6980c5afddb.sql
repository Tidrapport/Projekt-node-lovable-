-- Enable pg_net extension for HTTP calls from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to notify billing system when user is created
CREATE OR REPLACE FUNCTION public.notify_user_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Get the Supabase URL from environment (stored in vault or config)
  supabase_url := 'https://tlplvuiesgderflldjpb.supabase.co';
  
  -- Call the billing-sync edge function
  PERFORM extensions.http_post(
    url := supabase_url || '/functions/v1/billing-sync?action=user-count-update',
    body := json_build_object('company_id', NEW.company_id)::text,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS on_user_created_notify_billing ON public.profiles;
CREATE TRIGGER on_user_created_notify_billing
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.company_id IS NOT NULL)
  EXECUTE FUNCTION public.notify_user_created();

-- Also trigger on delete to update count when users are removed
CREATE OR REPLACE FUNCTION public.notify_user_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM extensions.http_post(
    url := 'https://tlplvuiesgderflldjpb.supabase.co/functions/v1/billing-sync?action=user-count-update',
    body := json_build_object('company_id', OLD.company_id)::text,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_user_deleted_notify_billing ON public.profiles;
CREATE TRIGGER on_user_deleted_notify_billing
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.company_id IS NOT NULL)
  EXECUTE FUNCTION public.notify_user_deleted();
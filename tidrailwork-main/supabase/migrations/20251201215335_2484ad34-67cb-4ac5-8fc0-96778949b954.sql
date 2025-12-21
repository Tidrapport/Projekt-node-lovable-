-- Create subscription plan enum
CREATE TYPE public.subscription_plan AS ENUM ('free', 'core', 'pro', 'enterprise');

-- Add subscription fields to companies table
ALTER TABLE public.companies 
ADD COLUMN subscription_plan subscription_plan NOT NULL DEFAULT 'free',
ADD COLUMN billing_email text,
ADD COLUMN monthly_price_per_user numeric DEFAULT 0,
ADD COLUMN billing_start_date date;

-- Create billing_records table to track monthly billing
CREATE TABLE public.billing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  billing_month date NOT NULL,
  user_count integer NOT NULL,
  plan subscription_plan NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  paid_at timestamp with time zone,
  UNIQUE(company_id, billing_month)
);

-- Enable RLS on billing_records
ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all billing records
CREATE POLICY "Super admins can manage billing records"
ON public.billing_records
FOR ALL
USING (is_super_admin(auth.uid()));

-- Admins can view their own company billing records
CREATE POLICY "Admins can view own company billing"
ON public.billing_records
FOR SELECT
USING (has_role(auth.uid(), 'admin') AND company_id = get_user_company_id(auth.uid()));
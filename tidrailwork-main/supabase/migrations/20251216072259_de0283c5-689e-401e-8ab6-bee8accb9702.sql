-- Add org_number and address fields to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS org_number text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS contact_person text,
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS contact_phone text;

-- Create offers table
CREATE TABLE public.offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id),
  customer_id uuid REFERENCES public.customers(id),
  offer_number text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  valid_until date,
  
  -- Pricing type: 'hourly', 'fixed', or 'both'
  pricing_type text NOT NULL DEFAULT 'hourly',
  
  -- Fixed price option
  fixed_price numeric,
  
  -- Hourly rates per shift type
  hourly_rate_day numeric,
  hourly_rate_evening numeric,
  hourly_rate_night numeric,
  hourly_rate_weekend numeric,
  
  -- Additional costs
  travel_rate_per_km numeric,
  per_diem_full numeric,
  per_diem_half numeric,
  
  -- Estimated hours (for hourly pricing)
  estimated_hours numeric,
  
  -- Terms and notes
  terms text,
  notes text,
  
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- RLS policies for offers
CREATE POLICY "Admins can manage company offers"
ON public.offers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Super admins can manage all offers"
ON public.offers
FOR ALL
USING (is_super_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_offers_updated_at
BEFORE UPDATE ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to generate offer number
CREATE OR REPLACE FUNCTION public.generate_offer_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year text;
  offer_count integer;
  new_number text;
BEGIN
  current_year := to_char(now(), 'YYYY');
  
  SELECT COUNT(*) + 1 INTO offer_count
  FROM public.offers
  WHERE company_id = p_company_id
  AND created_at >= date_trunc('year', now());
  
  new_number := 'OFF-' || current_year || '-' || lpad(offer_count::text, 4, '0');
  
  RETURN new_number;
END;
$$;
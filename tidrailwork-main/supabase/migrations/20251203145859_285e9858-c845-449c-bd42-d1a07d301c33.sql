-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage company customers"
ON public.customers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can view company customers"
ON public.customers
FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Super admins can manage all customers"
ON public.customers
FOR ALL
USING (is_super_admin(auth.uid()));

-- Add customer_id to projects table (keep customer_name for backwards compatibility during migration)
ALTER TABLE public.projects ADD COLUMN customer_id UUID REFERENCES public.customers(id);

-- Trigger for updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
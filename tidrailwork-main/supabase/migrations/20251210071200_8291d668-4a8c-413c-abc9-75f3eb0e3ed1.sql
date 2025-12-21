-- Create welding reports table
CREATE TABLE public.welding_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  company_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Header info
  report_date DATE NOT NULL,
  own_ao_number TEXT,
  customer_ao_number TEXT,
  welder_name TEXT NOT NULL,
  welder_id TEXT NOT NULL,
  report_year INTEGER NOT NULL,
  report_month INTEGER NOT NULL,
  bessy_anm_ofelia TEXT,
  
  -- Welding details (can have multiple rows, stored as JSONB array)
  welding_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Self-control checklist
  id_marked_weld BOOLEAN DEFAULT false,
  geometry_control BOOLEAN DEFAULT false,
  cleaned_workplace BOOLEAN DEFAULT false,
  restored_rail_quantity BOOLEAN DEFAULT false,
  welded_in_cold_climate BOOLEAN DEFAULT false,
  ensured_gas_flow BOOLEAN DEFAULT false,
  protected_cooling BOOLEAN DEFAULT false,
  
  -- Responsible and notes
  welding_supervisor TEXT,
  supervisor_phone TEXT,
  deviations TEXT,
  comments TEXT
);

-- Enable RLS
ALTER TABLE public.welding_reports ENABLE ROW LEVEL SECURITY;

-- Users can create their own reports
CREATE POLICY "Users can create their own welding reports"
ON public.welding_reports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own reports
CREATE POLICY "Users can view their own welding reports"
ON public.welding_reports
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own reports
CREATE POLICY "Users can update their own welding reports"
ON public.welding_reports
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own reports
CREATE POLICY "Users can delete their own welding reports"
ON public.welding_reports
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view company welding reports
CREATE POLICY "Admins can view company welding reports"
ON public.welding_reports
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));

-- Admins can manage company welding reports
CREATE POLICY "Admins can manage company welding reports"
ON public.welding_reports
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));

-- Super admins can view all
CREATE POLICY "Super admins can view all welding reports"
ON public.welding_reports
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_welding_reports_updated_at
BEFORE UPDATE ON public.welding_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
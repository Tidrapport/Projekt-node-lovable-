-- Add hourly_wage column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN hourly_wage NUMERIC(10,2) DEFAULT 0.00;

COMMENT ON COLUMN public.profiles.hourly_wage IS 'Hourly wage in SEK before tax';
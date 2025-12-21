-- Add tax_table column to profiles for calculating net salary
ALTER TABLE public.profiles 
ADD COLUMN tax_table INTEGER DEFAULT 30;
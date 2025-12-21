-- Add is_active column to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
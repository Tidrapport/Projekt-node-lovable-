-- Add employee_number column to profiles table
ALTER TABLE public.profiles ADD COLUMN employee_number text;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.employee_number IS 'Employee number for Fortnox integration';
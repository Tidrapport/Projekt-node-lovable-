-- Create enum for employee types
CREATE TYPE public.employee_type AS ENUM ('anställd', 'platschef', 'inhyrd');

-- Add new columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN phone TEXT,
ADD COLUMN emergency_contact TEXT,
ADD COLUMN employee_type public.employee_type DEFAULT 'anställd';

-- Allow admins to update all profile fields
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));
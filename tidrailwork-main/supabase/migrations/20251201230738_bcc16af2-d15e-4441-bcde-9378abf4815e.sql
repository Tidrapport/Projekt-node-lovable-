-- Add email column to profiles table for contact list functionality
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
-- Add new columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS customer_name text,
ADD COLUMN IF NOT EXISTS work_task text,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS internal_marking text;
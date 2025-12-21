-- Add is_tentative column to scheduled_assignments table
ALTER TABLE public.scheduled_assignments 
ADD COLUMN is_tentative boolean NOT NULL DEFAULT false;
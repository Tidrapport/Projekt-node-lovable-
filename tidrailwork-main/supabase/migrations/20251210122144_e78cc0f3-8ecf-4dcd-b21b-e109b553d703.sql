-- Add column to save travel compensation instead of paying out
ALTER TABLE public.time_entries 
ADD COLUMN save_travel_compensation boolean DEFAULT false;
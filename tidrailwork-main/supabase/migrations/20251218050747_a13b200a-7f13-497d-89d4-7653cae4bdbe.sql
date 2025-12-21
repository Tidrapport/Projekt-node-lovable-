-- Add ao_number column to time_entries table
ALTER TABLE public.time_entries 
ADD COLUMN ao_number text;
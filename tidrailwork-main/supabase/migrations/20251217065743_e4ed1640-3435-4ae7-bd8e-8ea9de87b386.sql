-- Add overtime columns to time_entries table
ALTER TABLE public.time_entries
ADD COLUMN overtime_weekday_hours numeric DEFAULT 0,
ADD COLUMN overtime_weekend_hours numeric DEFAULT 0;
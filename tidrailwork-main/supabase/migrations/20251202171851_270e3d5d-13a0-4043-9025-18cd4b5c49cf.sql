-- Add new fields to scheduled_assignments table for enhanced planning
ALTER TABLE public.scheduled_assignments
ADD COLUMN first_shift_start_time time without time zone,
ADD COLUMN contact_person text,
ADD COLUMN contact_phone text,
ADD COLUMN vehicle text,
ADD COLUMN location_lat numeric,
ADD COLUMN location_lng numeric;
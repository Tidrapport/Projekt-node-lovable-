-- Remove GPS columns and add work_address field
ALTER TABLE public.scheduled_assignments
DROP COLUMN location_lat,
DROP COLUMN location_lng,
ADD COLUMN work_address text;
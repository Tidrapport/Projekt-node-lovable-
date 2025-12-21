-- Add attested column to time_entries table
ALTER TABLE public.time_entries 
ADD COLUMN attested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN attested_at timestamp with time zone;

-- Add comment for documentation
COMMENT ON COLUMN public.time_entries.attested_by IS 'Admin user who attested this time entry';
COMMENT ON COLUMN public.time_entries.attested_at IS 'Timestamp when the time entry was attested';

-- Update RLS policies for time_entries to prevent users from updating/deleting attested entries
DROP POLICY IF EXISTS "Users can update their own time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Users can delete their own time entries" ON public.time_entries;

-- Users can only update their own time entries that are NOT attested
CREATE POLICY "Users can update their own unattested time entries"
ON public.time_entries
FOR UPDATE
USING (auth.uid() = user_id AND attested_by IS NULL);

-- Users can only delete their own time entries that are NOT attested
CREATE POLICY "Users can delete their own unattested time entries"
ON public.time_entries
FOR DELETE
USING (auth.uid() = user_id AND attested_by IS NULL);

-- Admins can still manage all time entries including attested ones
-- (This policy already exists but we ensure it's correct)
CREATE POLICY "Admins can attest time entries"
ON public.time_entries
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));
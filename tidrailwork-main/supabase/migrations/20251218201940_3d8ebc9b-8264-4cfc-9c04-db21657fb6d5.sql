-- Add invoiced fields to time_entries table
ALTER TABLE public.time_entries
ADD COLUMN invoiced boolean DEFAULT false,
ADD COLUMN invoiced_at timestamp with time zone DEFAULT null,
ADD COLUMN invoiced_by uuid DEFAULT null;

-- Add foreign key for invoiced_by
ALTER TABLE public.time_entries
ADD CONSTRAINT time_entries_invoiced_by_fkey
FOREIGN KEY (invoiced_by) REFERENCES public.profiles(id);
-- Add include_vat column to offers table
ALTER TABLE public.offers 
ADD COLUMN include_vat boolean NOT NULL DEFAULT true;
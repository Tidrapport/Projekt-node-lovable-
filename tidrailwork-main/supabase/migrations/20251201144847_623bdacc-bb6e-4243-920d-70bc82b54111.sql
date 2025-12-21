-- Add per diem and travel time fields to time_entries
ALTER TABLE time_entries 
ADD COLUMN per_diem_type text CHECK (per_diem_type IN ('none', 'half', 'full')) DEFAULT 'none',
ADD COLUMN travel_time_hours numeric(5,2) DEFAULT 0 CHECK (travel_time_hours >= 0);
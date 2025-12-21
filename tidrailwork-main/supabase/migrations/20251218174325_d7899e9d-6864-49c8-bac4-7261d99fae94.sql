-- Add overtime types to shift_type enum
ALTER TYPE shift_type ADD VALUE IF NOT EXISTS 'overtime_day';
ALTER TYPE shift_type ADD VALUE IF NOT EXISTS 'overtime_weekend';
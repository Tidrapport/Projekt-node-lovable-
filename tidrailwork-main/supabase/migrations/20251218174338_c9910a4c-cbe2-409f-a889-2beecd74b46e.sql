-- Insert default configs for overtime
INSERT INTO shift_types_config (shift_type, multiplier, description, start_hour, end_hour)
VALUES 
  ('overtime_day', 1.50, 'Övertid vardagar (50% tillägg)', 0, 24),
  ('overtime_weekend', 2.00, 'Övertid helg (100% tillägg)', 0, 24)
ON CONFLICT DO NOTHING;
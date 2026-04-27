ALTER TABLE technician
  ADD COLUMN available_days TEXT[] NOT NULL DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

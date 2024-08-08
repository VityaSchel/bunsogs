ALTER TABLE rooms
ADD COLUMN rate_limit_size INTEGER;
ALTER TABLE rooms
ADD COLUMN rate_limit_interval FLOAT;
-- Q03 probe product SQL (application-owned file).
CREATE TABLE IF NOT EXISTS seen (message_id text PRIMARY KEY, attempt integer NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp());

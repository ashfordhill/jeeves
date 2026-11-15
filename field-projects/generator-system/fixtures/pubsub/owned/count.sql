CREATE TABLE IF NOT EXISTS clicks (message_id text PRIMARY KEY, value text NOT NULL, worker text NOT NULL);
CREATE TABLE IF NOT EXISTS deliveries (message_id text NOT NULL, attempt integer NOT NULL, worker text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp());

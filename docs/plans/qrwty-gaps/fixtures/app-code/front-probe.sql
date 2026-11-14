-- Q03 probe product SQL (application-owned file).
CREATE TABLE IF NOT EXISTS items (id text PRIMARY KEY, note text NOT NULL);
CREATE OR REPLACE FUNCTION two_rows(a text, b text, fail boolean) RETURNS integer
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO m_front_probe.items(id, note) VALUES (a, 'fn'), (b, 'fn');
  IF fail THEN RAISE EXCEPTION 'probe failure after two inserts'; END IF;
  RETURN 2;
END $$;

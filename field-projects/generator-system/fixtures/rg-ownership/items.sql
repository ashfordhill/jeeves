-- Application-owned RG07 initial migration, executed by the restricted namespace role.
CREATE TABLE IF NOT EXISTS items(id text PRIMARY KEY, title text NOT NULL);
INSERT INTO items VALUES ('a', 'Apple') ON CONFLICT DO NOTHING;
CREATE OR REPLACE VIEW visible_items AS SELECT id, title FROM items;
CREATE OR REPLACE VIEW other_items AS SELECT id, title FROM items;

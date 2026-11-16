-- Application-owned RG06 product SQL, executed only by the setup owner.
CREATE TABLE IF NOT EXISTS items(id text PRIMARY KEY, title text NOT NULL);
INSERT INTO items VALUES ('a', 'Apple') ON CONFLICT DO NOTHING;
CREATE OR REPLACE VIEW published.visible_items AS SELECT id, title FROM items;
CREATE OR REPLACE VIEW published.other_items AS SELECT id, title FROM items;

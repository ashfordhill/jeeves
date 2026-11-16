-- Application-owned initial migration; shared by both API modules and their separate worker.
CREATE TABLE items(id text PRIMARY KEY, title text NOT NULL);
INSERT INTO items VALUES ('a', 'Apple');
CREATE VIEW visible_items AS SELECT id, title FROM items;
CREATE VIEW other_items AS SELECT id, title FROM items;

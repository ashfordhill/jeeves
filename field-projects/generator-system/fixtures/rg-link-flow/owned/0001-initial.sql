CREATE TABLE items(id text PRIMARY KEY, marked boolean NOT NULL DEFAULT false);
CREATE TABLE records(key text PRIMARY KEY, payload jsonb NOT NULL);
CREATE VIEW visible_items AS SELECT id, marked FROM items;
INSERT INTO items(id) VALUES ('seed');

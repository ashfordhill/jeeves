CREATE TABLE IF NOT EXISTS items (id text PRIMARY KEY, title text NOT NULL, state text NOT NULL);
INSERT INTO items VALUES ('amber', 'Amber lighthouse', 'published'), ('violet', 'Violet harbor', 'published'), ('draft', 'Unpublished draft', 'draft') ON CONFLICT DO NOTHING;
CREATE OR REPLACE VIEW published.items AS SELECT id, title FROM items WHERE state = 'published';

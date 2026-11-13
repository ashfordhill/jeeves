CREATE TABLE IF NOT EXISTS records (id text PRIMARY KEY, title text NOT NULL, state text NOT NULL);
INSERT INTO records VALUES ('published-a', 'Immutable amber catalog', 'published'), ('draft-a', 'Unpublished draft', 'draft') ON CONFLICT DO NOTHING;
CREATE OR REPLACE VIEW published.catalog AS SELECT id, title, state FROM records WHERE state = 'published';

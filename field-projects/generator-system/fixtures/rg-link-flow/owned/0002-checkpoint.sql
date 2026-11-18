CREATE TABLE foundation_checkpoint(id text PRIMARY KEY);
INSERT INTO foundation_checkpoint(id) VALUES ('applied-once');
SELECT pg_sleep(1);

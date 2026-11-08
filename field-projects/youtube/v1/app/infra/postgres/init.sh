#!/bin/sh
set -eu
# First-start database owners only. Repeatable scripts/migrate.mjs supplies runtime grants/data.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  --set=metadata_owner="$(cat /run/secrets/metadata_owner)" \
  --set=metadata_reader="$(cat /run/secrets/metadata_reader)" \
  --set=counts_owner="$(cat /run/secrets/counts_owner)" \
  --set=counts_reader="$(cat /run/secrets/counts_reader)" \
  --set=identity_password="$(cat /run/secrets/identity_password)" <<'SQL'
CREATE ROLE metadata_owner LOGIN PASSWORD :'metadata_owner';
CREATE ROLE metadata_reader LOGIN PASSWORD :'metadata_reader';
CREATE ROLE counts_owner LOGIN PASSWORD :'counts_owner';
CREATE ROLE counts_reader LOGIN PASSWORD :'counts_reader';
CREATE ROLE identity_owner LOGIN PASSWORD :'identity_password';
CREATE DATABASE metadata OWNER metadata_owner;
CREATE DATABASE counts OWNER counts_owner;
CREATE DATABASE identity OWNER identity_owner;
REVOKE ALL ON DATABASE metadata, counts, identity FROM PUBLIC;
GRANT CONNECT ON DATABASE metadata TO metadata_reader;
GRANT CONNECT ON DATABASE counts TO counts_reader;
\connect metadata
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE metadata_owner IN SCHEMA public REVOKE ALL ON TABLES FROM metadata_reader;
\connect counts
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE counts_owner IN SCHEMA public REVOKE ALL ON TABLES FROM counts_reader;
SQL

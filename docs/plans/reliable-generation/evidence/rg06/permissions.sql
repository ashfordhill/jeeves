-- Actual SQL dispatched by the emitted products.mjs against PGlite.
-- Runtime role setup/template migrations follow emitted local.json; credential authentication is deferred to RG14.

CREATE SCHEMA IF NOT EXISTS "published"; REVOKE ALL ON SCHEMA "published" FROM PUBLIC;
CREATE SCHEMA IF NOT EXISTS "p_links_api_owner"; REVOKE ALL ON SCHEMA "p_links_api_owner" FROM PUBLIC;
SET LOCAL search_path TO "p_links_api_owner";
-- Application-owned RG06 product SQL, executed only by the setup owner.
CREATE TABLE IF NOT EXISTS items(id text PRIMARY KEY, title text NOT NULL);
INSERT INTO items VALUES ('a', 'Apple') ON CONFLICT DO NOTHING;
CREATE OR REPLACE VIEW published.visible_items AS SELECT id, title FROM items;
CREATE OR REPLACE VIEW published.other_items AS SELECT id, title FROM items;
;
SET LOCAL search_path TO "p_links_api_owner";
-- The worker's product SQL shares the declared owner namespace, already created by setup.
SELECT 1;
;
RESET search_path;
REVOKE ALL ON ALL TABLES IN SCHEMA "published" FROM "r_links_db__links_api"; REVOKE ALL ON ALL SEQUENCES IN SCHEMA "published" FROM "r_links_db__links_api"; ALTER DEFAULT PRIVILEGES IN SCHEMA "published" REVOKE ALL ON TABLES FROM "r_links_db__links_api"; ALTER DEFAULT PRIVILEGES IN SCHEMA "published" REVOKE ALL ON SEQUENCES FROM "r_links_db__links_api"; REVOKE ALL ON SCHEMA "published" FROM "r_links_db__links_api";
REVOKE ALL ON ALL TABLES IN SCHEMA "p_links_api_owner" FROM "r_links_db__links_api"; REVOKE ALL ON ALL SEQUENCES IN SCHEMA "p_links_api_owner" FROM "r_links_db__links_api"; ALTER DEFAULT PRIVILEGES IN SCHEMA "p_links_api_owner" REVOKE ALL ON TABLES FROM "r_links_db__links_api"; ALTER DEFAULT PRIVILEGES IN SCHEMA "p_links_api_owner" REVOKE ALL ON SEQUENCES FROM "r_links_db__links_api"; REVOKE ALL ON SCHEMA "p_links_api_owner" FROM "r_links_db__links_api";
SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2; -- parameters: ["p_links_api_owner","items"]
GRANT USAGE ON SCHEMA "p_links_api_owner" TO "r_links_db__links_api"; GRANT SELECT, INSERT ON TABLE "p_links_api_owner"."items" TO "r_links_db__links_api";
REVOKE ALL ON ALL TABLES IN SCHEMA "published" FROM "r_links_db__stats_api"; REVOKE ALL ON ALL SEQUENCES IN SCHEMA "published" FROM "r_links_db__stats_api"; ALTER DEFAULT PRIVILEGES IN SCHEMA "published" REVOKE ALL ON TABLES FROM "r_links_db__stats_api"; ALTER DEFAULT PRIVILEGES IN SCHEMA "published" REVOKE ALL ON SEQUENCES FROM "r_links_db__stats_api"; REVOKE ALL ON SCHEMA "published" FROM "r_links_db__stats_api";
REVOKE ALL ON ALL TABLES IN SCHEMA "p_links_api_owner" FROM "r_links_db__stats_api"; REVOKE ALL ON ALL SEQUENCES IN SCHEMA "p_links_api_owner" FROM "r_links_db__stats_api"; ALTER DEFAULT PRIVILEGES IN SCHEMA "p_links_api_owner" REVOKE ALL ON TABLES FROM "r_links_db__stats_api"; ALTER DEFAULT PRIVILEGES IN SCHEMA "p_links_api_owner" REVOKE ALL ON SEQUENCES FROM "r_links_db__stats_api"; REVOKE ALL ON SCHEMA "p_links_api_owner" FROM "r_links_db__stats_api";
SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2; -- parameters: ["published","visible_items"]
GRANT USAGE ON SCHEMA "published" TO "r_links_db__stats_api"; GRANT SELECT ON TABLE "published"."visible_items" TO "r_links_db__stats_api";
REVOKE ALL ON ALL TABLES IN SCHEMA "published" FROM "r_links_db__visit_worker"; REVOKE ALL ON ALL SEQUENCES IN SCHEMA "published" FROM "r_links_db__visit_worker"; ALTER DEFAULT PRIVILEGES IN SCHEMA "published" REVOKE ALL ON TABLES FROM "r_links_db__visit_worker"; ALTER DEFAULT PRIVILEGES IN SCHEMA "published" REVOKE ALL ON SEQUENCES FROM "r_links_db__visit_worker"; REVOKE ALL ON SCHEMA "published" FROM "r_links_db__visit_worker";
REVOKE ALL ON ALL TABLES IN SCHEMA "p_links_api_owner" FROM "r_links_db__visit_worker"; REVOKE ALL ON ALL SEQUENCES IN SCHEMA "p_links_api_owner" FROM "r_links_db__visit_worker"; ALTER DEFAULT PRIVILEGES IN SCHEMA "p_links_api_owner" REVOKE ALL ON TABLES FROM "r_links_db__visit_worker"; ALTER DEFAULT PRIVILEGES IN SCHEMA "p_links_api_owner" REVOKE ALL ON SEQUENCES FROM "r_links_db__visit_worker"; REVOKE ALL ON SCHEMA "p_links_api_owner" FROM "r_links_db__visit_worker";
SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2; -- parameters: ["p_links_api_owner","items"]
GRANT USAGE ON SCHEMA "p_links_api_owner" TO "r_links_db__visit_worker"; GRANT SELECT, UPDATE ON TABLE "p_links_api_owner"."items" TO "r_links_db__visit_worker";

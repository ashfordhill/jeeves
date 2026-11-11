CREATE SCHEMA IF NOT EXISTS "account_api_favorite_videos";
REVOKE ALL ON SCHEMA "account_api_favorite_videos" FROM PUBLIC;
CREATE TABLE "account_api_favorite_videos"."favorites" (
 account text NOT NULL CHECK(length(account) BETWEEN 1 AND 255),
 item text NOT NULL CHECK(item ~ '^[A-Za-z0-9._:-]{1,200}$'),
 added_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(account, item)
);
CREATE INDEX ON "account_api_favorite_videos"."favorites"(account, added_at DESC, item);

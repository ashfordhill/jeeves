DROP TABLE "attempts" CASCADE;--> statement-breakpoint
DROP TABLE "generations" CASCADE;--> statement-breakpoint
DROP TABLE "implementation_usage" CASCADE;--> statement-breakpoint
DROP TABLE "runs" CASCADE;--> statement-breakpoint
DROP TABLE "tasks" CASCADE;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "target";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "output_dir";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "git_strategy";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "max_retries";--> statement-breakpoint
-- pg-boss kept its run queue in its own schema; nothing uses it now.
DROP SCHEMA IF EXISTS "pgboss" CASCADE;

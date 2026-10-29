ALTER TABLE "attempts" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "feedback" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "checks" jsonb;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "changes" jsonb;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "diff" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "events" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "commit" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "git_strategy" text DEFAULT 'branch-per-task' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "max_retries" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "git_strategy" text DEFAULT 'branch-per-task' NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "max_retries" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "workspace" jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "commit" text;
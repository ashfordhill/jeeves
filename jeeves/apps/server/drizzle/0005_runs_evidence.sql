CREATE TABLE "implementation_usage" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "implementation_usage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"project_id" uuid NOT NULL,
	"run_id" integer NOT NULL,
	"task_id" integer,
	"attempt_id" integer,
	"task_key" text,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"provider" text,
	"model" text,
	"request" jsonb,
	"usage" jsonb,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "execution_mode" text DEFAULT 'continuous' NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "parent_run_id" integer;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "evidence" jsonb;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "interventions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "implementation_usage" ADD CONSTRAINT "implementation_usage_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implementation_usage" ADD CONSTRAINT "implementation_usage_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implementation_usage" ADD CONSTRAINT "implementation_usage_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implementation_usage" ADD CONSTRAINT "implementation_usage_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "implementation_usage_project_idx" ON "implementation_usage" USING btree ("project_id","run_id");--> statement-breakpoint
-- Preserve historical known usage. Historical prompts/models and overwritten planner calls
-- cannot be reconstructed; the UI identifies these as legacy evidence.
INSERT INTO implementation_usage (project_id, run_id, task_id, attempt_id, task_key, kind, status, usage, started_at, finished_at)
SELECT r.project_id, a.run_id, a.task_id, a.id, t.key, 'legacy',
CASE WHEN a.status = 'succeeded' THEN 'completed' ELSE a.status END,
a.usage, a.started_at, a.finished_at
FROM attempts a JOIN runs r ON r.id = a.run_id JOIN tasks t ON t.id = a.task_id;
--> statement-breakpoint
INSERT INTO implementation_usage (project_id, run_id, kind, status, model, usage, started_at, finished_at)
SELECT project_id, id, 'planning', 'completed', planner->>'model', planner->'usage', created_at, updated_at
FROM runs WHERE planner->>'model' IS NOT NULL;

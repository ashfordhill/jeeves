CREATE TABLE "design_revisions" (
	"project_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"document" jsonb NOT NULL,
	"findings" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "design_revisions_project_id_revision_pk" PRIMARY KEY("project_id","revision")
);
--> statement-breakpoint
CREATE TABLE "layouts" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"document" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "operations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"ops" jsonb,
	"target_id" integer,
	"state" text,
	"base_revision" integer NOT NULL,
	"revision" integer NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_revisions" ADD CONSTRAINT "design_revisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layouts" ADD CONSTRAINT "layouts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operations_project_state_idx" ON "operations" USING btree ("project_id","state","id");
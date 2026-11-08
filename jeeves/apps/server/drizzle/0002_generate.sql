CREATE TABLE "generations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "generations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"project_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"output_dir" text NOT NULL,
	"baseline" boolean NOT NULL,
	"status" text NOT NULL,
	"steps" jsonb NOT NULL,
	"checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"report" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "output_dir" text;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generations_project_idx" ON "generations" USING btree ("project_id","id");
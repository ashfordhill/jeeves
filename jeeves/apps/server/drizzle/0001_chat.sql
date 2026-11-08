CREATE TABLE "chat_turns" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_turns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"project_id" uuid NOT NULL,
	"message" text NOT NULL,
	"file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"selection" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text NOT NULL,
	"reply" text DEFAULT '' NOT NULL,
	"question" jsonb,
	"operation_id" integer,
	"changed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"activity" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"usage" jsonb,
	"model" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"media_type" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_turns" ADD CONSTRAINT "chat_turns_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_turns_project_idx" ON "chat_turns" USING btree ("project_id","id");
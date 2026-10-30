// Sub-paths, so drizzle-kit (CommonJS) doesn't load the providers' ESM-only dependencies.
import {
  type AttemptChecks,
  type AttemptEvent,
  type FileChange,
  gitStrategies,
  type TaskWorkspace,
} from "@jeeves/orchestrator/execute";
import { attemptStatuses, runStatuses, taskStatuses } from "@jeeves/orchestrator/states";
import type {
  DesignDocument,
  Finding,
  LayoutDocument,
  OperationInput,
  SubtypeReview,
} from "@jeeves/spec";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Current semantic revision; the matching `design_revisions` row holds the document. */
  revision: integer("revision").notNull().default(0),
  /** Where Generate writes the template project; `null` until chosen (a default is suggested). */
  outputDir: text("output_dir"),
  /** The git strategy new runs use (PLAN §10 ruleset). */
  gitStrategy: text("git_strategy", { enum: gitStrategies }).notNull().default("branch-per-task"),
  /** Retries after a task's first failed attempt before it needs attention. */
  maxRetries: integer("max_retries").notNull().default(2),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every semantic revision of every design, with the findings saved alongside it. */
export const designRevisions = pgTable(
  "design_revisions",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    document: jsonb("document").$type<DesignDocument>().notNull(),
    findings: jsonb("findings").$type<Finding[]>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.revision] })],
);

export const operationKinds = ["edit", "undo", "redo"] as const;
export type OperationKind = (typeof operationKinds)[number];

/** Where an edit came from. One chat turn is one edit, so it is one undo step. */
export const operationSources = ["canvas", "chat", "api"] as const;
export type OperationSource = (typeof operationSources)[number];

/**
 * `applied` edits can be undone (latest first); `undone` ones can be redone (earliest first).
 * A new edit discards every undone edit, so the history stays linear.
 */
export const editStates = ["applied", "undone", "discarded"] as const;
export type EditState = (typeof editStates)[number];

/**
 * The operation history. Every row stores the semantic document before and after, so undo and
 * redo restore snapshots instead of inverting ops.
 */
export const operations = pgTable(
  "operations",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: operationKinds }).notNull(),
    source: text("source", { enum: operationSources }).notNull(),
    /** The batch as posted (edits only). */
    ops: jsonb("ops").$type<OperationInput[]>(),
    /** The edit an undo or redo acted on. */
    targetId: integer("target_id"),
    /** Edits only; `null` for undo and redo rows. */
    state: text("state", { enum: editStates }),
    baseRevision: integer("base_revision").notNull(),
    revision: integer("revision").notNull(),
    before: jsonb("before").$type<DesignDocument>().notNull(),
    after: jsonb("after").$type<DesignDocument>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("operations_project_state_idx").on(t.projectId, t.state, t.id)],
);

/** Positions and sizes. Writing it never changes the semantic revision. */
export const layouts = pgTable("layouts", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  document: jsonb("document").$type<LayoutDocument>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => (Buffer.isBuffer(value) ? value : Buffer.from(value)),
});

/** Files attached to chat messages: Markdown, text, and images, stored with the project. */
export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mediaType: text("media_type").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  createdAt: createdAt(),
});

export const chatTurnStatuses = ["running", "done", "failed"] as const;
export type ChatTurnStatus = (typeof chatTurnStatuses)[number];

/** A question the chat agent asked with `askUser`; the person answers with a new message. */
export type ChatQuestion = {
  question: string;
  choices: string[];
  allowFreeText: boolean;
  subtypeReview?: SubtypeReview;
};

/** One line of "what the agent did" in a turn, e.g. a tool call and its outcome. */
export type ChatActivity = { tool: string; ok: boolean; summary: string };

export type ChatUsage = { inputTokens: number; outputTokens: number; known: boolean };

/**
 * One chat turn: the person's message and the agent's reply. A turn's design edits are one
 * operation (`operation_id`), so they are one undo step.
 */
export const chatTurns = pgTable(
  "chat_turns",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    fileIds: jsonb("file_ids").$type<string[]>().notNull().default([]),
    /** Board selection when the message was sent. */
    selection: jsonb("selection").$type<string[]>().notNull().default([]),
    status: text("status", { enum: chatTurnStatuses }).notNull(),
    reply: text("reply").notNull().default(""),
    question: jsonb("question").$type<ChatQuestion>(),
    operationId: integer("operation_id"),
    /** Elements and other items the turn added or changed, for highlighting. */
    changed: jsonb("changed").$type<string[]>().notNull().default([]),
    activity: jsonb("activity").$type<ChatActivity[]>().notNull().default([]),
    usage: jsonb("usage").$type<ChatUsage>(),
    model: text("model"),
    error: text("error"),
    createdAt: createdAt(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("chat_turns_project_idx").on(t.projectId, t.id)],
);

export const generationStatuses = [
  "running",
  "succeeded",
  "failed",
  "blocked",
  "cancelled",
  "interrupted",
] as const;
export type GenerationStatus = (typeof generationStatuses)[number];

export type GenerationStepId =
  | "generate"
  | "install"
  | "typecheck"
  | "compose-up"
  | "test-packs"
  | "compose-down";

export type GenerationStep = {
  id: GenerationStepId;
  title: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  durationMs?: number;
  message?: string;
};

export type GenerationCheck = {
  subject: string;
  template: string;
  id: string;
  title: string;
  status: "passed" | "failed";
  durationMs: number;
  error?: string;
};

export type GenerationLogLine = { step: GenerationStepId; line: string };

/** What the generate step did, or why it stopped (`problems`). */
export type GenerationReport = {
  written: string[];
  scaffolded: string[];
  kept: string[];
  packages: string[];
  vendored: string[];
  removedElements: { id: string; dir: string }[];
  orphaned: string[];
  git: "initialized" | "existing" | "disabled";
  problems: { path: string; kind: "edited" | "unmanaged"; message: string }[];
};

/** One Generate run (PLAN §9): writing the template project, then the baseline check. */
export const generations = pgTable(
  "generations",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    outputDir: text("output_dir").notNull(),
    baseline: boolean("baseline").notNull(),
    status: text("status", { enum: generationStatuses }).notNull(),
    steps: jsonb("steps").$type<GenerationStep[]>().notNull(),
    checks: jsonb("checks").$type<GenerationCheck[]>().notNull().default([]),
    /** The last lines of output (capped), for the drawer after a reload. */
    log: jsonb("log").$type<GenerationLogLine[]>().notNull().default([]),
    report: jsonb("report").$type<GenerationReport>(),
    error: text("error"),
    createdAt: createdAt(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("generations_project_idx").on(t.projectId, t.id)],
);

export type RunUsage = {
  inputTokens: number;
  outputTokens: number;
  known: boolean;
  costUsd?: number;
};

/** How the plan was made: refined by the planner model, or the deterministic seed alone (and why). */
export type RunPlanner = {
  mode: "refined" | "seed";
  model: string | null;
  /** The planner's own summary, or why the seed was used as is. */
  message: string | null;
  usage: RunUsage | null;
};

/** One orchestration of a generated template project (PLAN §10). */
export const runs = pgTable(
  "runs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: text("status", { enum: runStatuses }).notNull(),
    /** Why the run stopped, paused, or failed, in words for the person. */
    statusReason: text("status_reason"),
    outputDir: text("output_dir").notNull(),
    /** The design revision the project was generated from (`jeeves/lock.json`). */
    designRevision: integer("design_revision"),
    planner: jsonb("planner").$type<RunPlanner>(),
    warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
    /** The project's git strategy and retry limit when the run was planned. */
    gitStrategy: text("git_strategy", { enum: gitStrategies }).notNull().default("branch-per-task"),
    maxRetries: integer("max_retries").notNull().default(2),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("runs_project_idx").on(t.projectId, t.id)],
);

/** A unit of agent work. `position` orders a run's tasks; the person can reorder pending ones. */
export const tasks = pgTable(
  "tasks",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    runId: integer("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    key: text("key").notNull(),
    element: text("element").notNull(),
    attachment: text("attachment"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    acceptance: jsonb("acceptance").$type<string[]>().notNull(),
    ownedPaths: jsonb("owned_paths").$type<string[]>().notNull(),
    dependsOn: jsonb("depends_on").$type<string[]>().notNull(),
    source: text("source", { enum: ["seed", "planner"] }).notNull(),
    /** Changed by the person after planning. */
    edited: boolean("edited").notNull().default(false),
    status: text("status", { enum: taskStatuses }).notNull(),
    /** Branch and base commit, saved before the first attempt's agent starts. */
    workspace: jsonb("workspace").$type<TaskWorkspace>(),
    /** The commit holding the task on the run branch, once it's done. */
    commit: text("commit"),
    createdAt: createdAt(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("tasks_run_idx").on(t.runId, t.position)],
);

/** One try at a task. Retries and resumes after a restart are new attempts. */
export const attempts = pgTable(
  "attempts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    runId: integer("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    status: text("status", { enum: attemptStatuses }).notNull(),
    summary: text("summary"),
    usage: jsonb("usage").$type<RunUsage>(),
    error: text("error"),
    /** The coding-agent session, so a retry can continue it. */
    sessionId: text("session_id"),
    /** What the next attempt tells the agent about this one's failure. */
    feedback: text("feedback"),
    checks: jsonb("checks").$type<AttemptChecks>(),
    changes: jsonb("changes").$type<FileChange[]>(),
    /** The task's diff against its base commit when the attempt ended (capped). */
    diff: text("diff"),
    /** The agent's and the checks' live log (capped). */
    events: jsonb("events").$type<AttemptEvent[]>().notNull().default([]),
    commit: text("commit"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("attempts_task_idx").on(t.taskId, t.number)],
);

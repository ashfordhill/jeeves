import type { DesignDocument, Finding, LayoutDocument, OperationInput } from "@jeeves/spec";
import {
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
};

/** One line of "what the agent did" in a turn, e.g. a tool call and its outcome. */
export type ChatActivity = { tool: string; ok: boolean; summary: string };

export type ChatUsage = {
  inputTokens: number;
  outputTokens: number;
  known: boolean;
  cachedInputTokens?: number;
  costUsd?: number;
};

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

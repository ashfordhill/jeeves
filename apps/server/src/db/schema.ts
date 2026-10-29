import type { DesignDocument, Finding, LayoutDocument, OperationInput } from "@jeeves/spec";
import {
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

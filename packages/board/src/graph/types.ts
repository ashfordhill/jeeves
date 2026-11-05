// Ported from automation-illustrator src/workflow/graph.ts, src/workflow/commands.ts (0803c4a).
// The board's graph vocabulary: tiles (nodes), links (edges) and the rules a caller adds on top.
// Positions, labels, Before/After overlays and Split live elsewhere or nowhere.

/** A tile on the board. Callers may carry more fields; the graph rules only read `id`. */
export type BoardNode = { id: string };

/** A link from one tile to another. `async` links are drawn dashed by the caller. */
export type BoardEdge = { id: string; source: string; target: string; async?: boolean };

export type BoardGraph = { nodes: BoardNode[]; edges: BoardEdge[] };

/** A link an edit creates; the edit fills in its ends. */
export type NewLink = { id: string; async?: boolean };

/**
 * What makes a graph valid beyond its shape: every tile is reachable from `root`, `canLink`
 * accepts every link, and no tile other than the root has more than `maxOut` outgoing links.
 * The root's own links are the caller's to limit.
 */
export type Rules = {
  root: string;
  canLink?(source: string, target: string, async: boolean): boolean;
  maxOut?: number;
};

export type GraphCode =
  | "duplicate-id"
  | "missing-ref"
  | "self-link"
  | "duplicate-link"
  | "cycle"
  | "unreachable"
  | "refused-link"
  | "too-many-links"
  | "root"
  | "strands";

/** One broken rule. `node` or `edge` names what it is about, when one thing is. */
export type GraphViolation = {
  code: GraphCode;
  message: string;
  node?: string;
  edge?: string;
};

/** Why an edit was refused: the broken rule, in the same shape as a violation. */
export type Refusal = { ok: false } & GraphViolation;

export type Result<T> = { ok: true; value: T } | Refusal;

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail(code: GraphCode, message: string): Refusal {
  return { ok: false, code, message };
}

/** A refusal carrying one violation. */
export function refuse(violation: GraphViolation): Refusal {
  return { ok: false, ...violation };
}

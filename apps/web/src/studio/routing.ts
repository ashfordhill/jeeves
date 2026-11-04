/**
 * Derived paths only: no saved connections or positions. One drawn line per ordered box pair
 * (SG07); geometry is ELK's (layout.ts).
 */
import type { StudioRelationship, StudioScopeProjection } from "@jeeves/spec";
import type { Point } from "./creation.ts";
import { boundedStudioText } from "./text.ts";

export interface StudioPath {
  id: string;
  item: StudioRelationship;
  edgeIds: string[];
}
export interface RouteBox extends Point {
  width: number;
  height: number;
}
export interface StudioRoute {
  points: Point[];
  path: string;
  label?: RouteBox & { short: string; detail: string };
}
export type StudioGeometry = Record<string, StudioRoute>;

/** Capture once per gesture: the paths touching each box. */
export function studioIncidentPaths(paths: StudioPath[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const path of paths) {
    for (const id of new Set([path.item.from, path.item.to])) {
      const ids = result.get(id) ?? [];
      ids.push(path.id);
      result.set(id, ids);
    }
  }
  return result;
}

const routePath = (points: Point[]) =>
  points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");

/** Rubber-band only incident anchors. No obstacle search or label reservation on pointer ticks. */
export function movedStudioGeometry(
  base: StudioGeometry,
  paths: Map<string, StudioPath>,
  nodes: Record<string, RouteBox>,
  positions: Record<string, Point>,
  incident: Map<string, string[]>,
): StudioGeometry {
  const affected = new Set(
    Object.keys(positions)
      .filter(
        (id) =>
          nodes[id] && (nodes[id]?.x !== positions[id]?.x || nodes[id]?.y !== positions[id]?.y),
      )
      .flatMap((id) => incident.get(id) ?? []),
  );
  const result = { ...base };
  for (const id of affected) {
    const path = paths.get(id),
      route = base[id];
    if (!path || !route) continue;
    const points = [...route.points];
    const moveAnchor = (nodeId: string, first: boolean) => {
      const old = nodes[nodeId],
        point = positions[nodeId];
      if (!old || !point) return;
      const index = first ? 0 : points.length - 1;
      const anchor = points[index];
      if (!anchor) return;
      const next = { x: anchor.x + point.x - old.x, y: anchor.y + point.y - old.y };
      // Retain the captured middle exactly.
      const elbow = { x: first ? next.x + 12 : next.x - 12, y: next.y };
      const join = { x: elbow.x, y: anchor.y };
      if (first) points.splice(0, 1, next, elbow, join, anchor);
      else points.splice(index, 1, anchor, join, elbow, next);
    };
    moveAnchor(path.item.from, true);
    moveAnchor(path.item.to, false);
    result[id] = { ...route, points, path: routePath(points) };
  }
  return result;
}

/**
 * One line per ordered box pair (plan §4, O4). The projection already merges every member between
 * the same two boxes in the same direction into one edge; opposite directions stay two edges.
 */
export function studioPaths(scope: StudioScopeProjection): StudioPath[] {
  return [...scope.edges]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((edge) => ({ id: edge.id, item: edge, edgeIds: [edge.id] }));
}

/** About 24 characters: verb plus protocol (plan §4, O8). */
export const STUDIO_SHORT_LABEL = 24;
const hidden = new Set(["In process", "Unspecified", "Undecided"]);
const preposition = new Set([
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "on",
  "over",
  "per",
  "to",
  "via",
  "with",
]);

const protocolText = (item: StudioRelationship) =>
  item.protocols.filter((p) => !hidden.has(p)).join(" / ");

/** Lower-case the leading verb unless it is an acronym ("SQL", "API"). */
const verbCase = (words: string[]) =>
  words.map((word, index) =>
    index === 0 && !/^[A-Z0-9]{2,}/.test(word)
      ? word.charAt(0).toLowerCase() + word.slice(1)
      : word,
  );

/** Links inside one frame that never leave the process need no label room (SG07). */
export function studioInProcess(item: StudioRelationship) {
  return item.members.every(
    (member) => member.protocols.length > 0 && member.protocols.every((p) => p === "In process"),
  );
}

/** How many separate relationships a merged line carries, in words: "3 calls". */
export function studioMergedCount(item: StudioRelationship) {
  const count = item.members.length;
  const noun = item.members.every((m) => m.kind === "context")
    ? "relationships"
    : item.members.every(
          (m) => m.interactions.length && m.interactions.every((i) => i === "Asynchronous"),
        )
      ? "messages"
      : "calls";
  return `${count} ${noun}`;
}

/**
 * The short line label. A single relationship keeps as many leading words of its action as fit
 * with its protocol ("reads links · SQL", then "reads · SQL"); a merged line shows its count
 * ("3 calls · SQL"). The full text stays in the inspector and the export.
 */
export function studioShortLabel(item: StudioRelationship, limit = STUDIO_SHORT_LABEL): string {
  const protocol = protocolText(item);
  const suffix = (text: string) => (protocol ? `${text} · ${protocol}` : text);
  if (item.members.length > 1) {
    const merged = suffix(studioMergedCount(item));
    return Array.from(merged).length <= limit ? merged : studioMergedCount(item);
  }
  const words = verbCase(
    (item.actions[0] ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean),
  );
  if (!words.length) return boundedStudioText(protocol, limit);
  const fits = (list: string[]) => Array.from(suffix(list.join(" "))).length <= limit;
  // Shorten while keeping intent: drop a coordinated second verb ("creates and lists links"
  // → "creates links"), then a trailing prepositional phrase ("reads links on miss" → "reads
  // links"), then middle words ("checks destination reputation" → "checks reputation"), and
  // finally keep the verb alone ("publishes · Messaging").
  const candidates: string[][] = [words];
  let current = words;
  if (current[1]?.toLowerCase() === "and" && current.length > 3) {
    current = [current[0] as string, ...current.slice(3)];
    candidates.push(current);
  }
  const cut = current.findIndex((word, index) => index > 0 && preposition.has(word.toLowerCase()));
  if (cut > 1) {
    current = current.slice(0, cut);
    candidates.push(current);
  }
  if (current.length > 2) candidates.push([current[0] as string, current.at(-1) as string]);
  const verb = words[0] as string;
  candidates.push([verb]);
  const chosen = candidates.find(fits);
  if (chosen) return suffix(chosen.join(" "));
  // A long protocol yields to the verb; the verb alone is never cut below a readable word.
  return protocol && Array.from(verb).length + 3 < limit
    ? `${verb} · ${boundedStudioText(protocol, limit - Array.from(verb).length - 3)}`
    : boundedStudioText(verb, limit);
}

/** The zoomed-in label: full action text and protocol, bounded only to keep one line. */
export function studioDetailLabel(item: StudioRelationship): string {
  const action = item.actions.join(" / ");
  const protocol = boundedStudioText(protocolText(item), 18);
  const text = item.members.length > 1 ? `${studioMergedCount(item)}: ${action}` : action;
  return protocol
    ? `${boundedStudioText(text, 53 - Array.from(protocol).length)} · ${protocol}`
    : boundedStudioText(text, 56);
}

/** One label per drawn line; in-process links inside a frame are left unlabelled. */
export function studioPathLabels(
  paths: StudioPath[],
): Record<string, { short: string; detail: string; merged: boolean }> {
  const result: Record<string, { short: string; detail: string; merged: boolean }> = {};
  for (const path of paths) {
    if (studioInProcess(path.item)) continue;
    result[path.id] = {
      short: studioShortLabel(path.item),
      detail: studioDetailLabel(path.item),
      merged: path.item.members.length > 1,
    };
  }
  return result;
}

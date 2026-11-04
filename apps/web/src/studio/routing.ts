/** Derived paths only: no saved connections, positions, or invented trunk settings. Geometry is ELK's (layout.ts). */
import type { StudioRelationship, StudioScopeProjection } from "@jeeves/spec";
import type { Point } from "./creation.ts";
import { boundedStudioText } from "./text.ts";

export interface StudioPath {
  id: string;
  item: StudioRelationship;
  edgeIds: string[];
  trunk?: string;
  branchIds?: string[];
}
export interface RouteBox extends Point {
  width: number;
  height: number;
}
export interface StudioRoute {
  points: Point[];
  path: string;
  junction?: Point;
  label?: RouteBox & { short: string; detail: string };
}
export type StudioGeometry = Record<string, StudioRoute>;

/** Capture once per gesture. Trunks own their source; branches own their target. */
export function studioIncidentPaths(paths: StudioPath[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const path of paths) {
    for (const id of [
      ...(!path.trunk ? [path.item.from] : []),
      ...(!path.branchIds ? [path.item.to] : []),
    ]) {
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
      // Retain the captured middle (including the shared bus/junction) exactly.
      const elbow = { x: first ? next.x + 12 : next.x - 12, y: next.y };
      const join = { x: elbow.x, y: anchor.y };
      if (first) points.splice(0, 1, next, elbow, join, anchor);
      else points.splice(index, 1, anchor, join, elbow, next);
    };
    if (!path.trunk) moveAnchor(path.item.from, true);
    if (!path.branchIds) moveAnchor(path.item.to, false);
    result[id] = { ...route, points, path: routePath(points) };
  }
  return result;
}
const compare = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, "en");
const unique = <T extends string>(values: T[]) => [...new Set(values)].sort();

function relationship(
  id: string,
  edges: StudioRelationship[],
  memberIds: string[],
): StudioRelationship {
  const members = [...new Map(edges.flatMap((e) => e.members).map((m) => [m.id, m])).values()]
    .filter((m) => memberIds.includes(m.id))
    .sort(compare);
  const first = edges[0];
  if (!first) throw new Error("A visible path requires its original relationship.");
  const item = { ...first, id, members };
  // Retain every provenance field, including queued legs and exact contract/binding refs.
  const fields = [
    "sourceRefs",
    "targetRefs",
    "connectionIds",
    "queueIds",
    "contextRelationshipIds",
    "componentRelationshipIds",
    "componentIds",
    "bindingIds",
    "interfaceIds",
    "contractRefs",
    "capabilityRefs",
  ] as const;
  for (const key of fields) {
    const values = members.flatMap((m) => m[key] as unknown[]);
    Object.assign(item, {
      [key]: [...new Map(values.map((v) => [JSON.stringify(v), v])).values()],
    });
  }
  item.actions = unique(members.map((m) => m.action));
  item.protocols = unique(members.flatMap((m) => m.protocols));
  item.interactions = unique(members.flatMap((m) => m.interactions));
  return item;
}

/** Consume UX04b's exact protocol/interaction groups, including subsets of mixed aggregates. */
export function studioPaths(scope: StudioScopeProjection): StudioPath[] {
  const paths: StudioPath[] = [];
  const used = new Map<string, Set<string>>();
  for (const trunk of [...scope.trunks].sort(compare)) {
    const edges = scope.edges
      .filter((e) => trunk.branches.some((b) => b.edgeId === e.id))
      .sort(compare);
    const memberIds = trunk.branches.flatMap((b) => b.memberIds);
    const branchIds: string[] = [];
    for (const branch of [...trunk.branches].sort((a, b) =>
      a.edgeId.localeCompare(b.edgeId, "en"),
    )) {
      const edge = edges.find((e) => e.id === branch.edgeId);
      if (!edge) continue;
      const id = `${edge.id}:branch:${branch.memberIds.join("|")}`;
      branchIds.push(id);
      paths.push({
        id,
        item: relationship(id, [edge], branch.memberIds),
        edgeIds: [edge.id],
        trunk: trunk.id,
      });
      const ids = used.get(edge.id) ?? new Set<string>();
      for (const memberId of branch.memberIds) ids.add(memberId);
      used.set(edge.id, ids);
    }
    paths.push({
      id: trunk.id,
      item: relationship(trunk.id, edges, memberIds),
      edgeIds: edges.map((e) => e.id),
      branchIds,
    });
  }
  for (const edge of [...scope.edges].sort(compare)) {
    const remaining = edge.members.filter((m) => !used.get(edge.id)?.has(m.id));
    if (!remaining.length) continue;
    const id = used.has(edge.id)
      ? `${edge.id}:branch:${remaining.map((m) => m.id).join("|")}`
      : edge.id;
    paths.push({
      id,
      item: relationship(
        id,
        [edge],
        remaining.map((m) => m.id),
      ),
      edgeIds: [edge.id],
    });
  }
  return paths.sort(compare);
}

export function studioRelationshipLabel(item: StudioRelationship, detailed: boolean): string {
  const action = item.actions.join(" / ");
  const protocol = boundedStudioText(
    item.protocols.filter((p) => p !== "In process" && p !== "Unspecified").join(" / "),
    18,
  );
  return detailed && protocol
    ? `${boundedStudioText(action, 53 - Array.from(protocol).length)} · ${protocol}`
    : boundedStudioText(action, detailed ? 56 : 36);
}

/**
 * One label per drawn relationship: the first end path of each original edge carries the combined
 * text of its siblings (a shared trunk's branches), as before SG06.
 */
export function studioPathLabels(
  paths: StudioPath[],
): Record<string, { short: string; detail: string }> {
  const ends = paths.filter((path) => !path.branchIds);
  const result: Record<string, { short: string; detail: string }> = {};
  const labeled = new Set<string>();
  for (const path of ends) {
    const edgeId = path.edgeIds[0];
    if (!edgeId || labeled.has(edgeId)) continue;
    labeled.add(edgeId);
    const siblings = ends.filter((sibling) => sibling.edgeIds.includes(edgeId));
    const item = relationship(
      edgeId,
      siblings.map((sibling) => sibling.item),
      siblings.flatMap((sibling) => sibling.item.members.map((member) => member.id)),
    );
    result[path.id] = {
      short: studioRelationshipLabel(item, false),
      detail: studioRelationshipLabel(item, true),
    };
  }
  return result;
}

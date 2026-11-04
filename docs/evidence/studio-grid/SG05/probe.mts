// biome-ignore-all lint/suspicious/noExplicitAny: one-off evidence script over dynamically imported spec sources.
// SG05 one-off probe of the C1/C2/C3 projection. Usage: tsx probe.mts <spec-src-index> [out.json]
import { writeFileSync } from "node:fs";

const S: any = await import(process.argv[2]);
const { design, name } = S.studioArchitectureExample("studio-tinyurl");
const views = S.studioViews(design, S.studioDefinitions, name);
const scope = (view: any) => ({
  key: view.key,
  level: view.level,
  nodes: view.nodes.map(
    (n: any) =>
      `${n.id}${n.frame ? " [frame]" : ""}${n.parent ? ` in ${n.parent}` : ""} | ${n.name}`,
  ),
  edges: view.edges.map(
    (e: any) => `${e.from} -> ${e.to} | ${e.actions.join(" / ")} | ${e.connectionIds.join(",")}`,
  ),
});
const c3 = views.components;
const out = {
  keys: S.studioScopes(views).map((v: any) => v.key),
  context: scope(views.context),
  containers: scope(views.containers),
  components: scope(c3),
  counts: {
    c2Nodes: views.containers.nodes.length,
    c2Frames: views.containers.nodes.filter((n: any) => n.frame).length,
    c2Edges: views.containers.edges.length,
    c3Nodes: c3.nodes.length,
    c3Frames: c3.nodes.filter((n: any) => n.frame).length,
    c3Components: c3.nodes.filter((n: any) => n.kind === "component").length,
    c3Queues: c3.nodes.filter((n: any) => n.kind === "queue").length,
    c3Edges: c3.edges.length,
    componentLinks: design.architecture.studio.componentConnections.length,
    componentLinksDrawn: new Set(c3.edges.flatMap((e: any) => e.componentRelationshipIds)).size,
  },
  // Every component edge to an element follows its via connection's direction.
  viaConsistent: design.architecture.studio.componentConnections
    .filter((l: any) => l.to.kind === "element")
    .every((l: any) => {
      const via = design.connections.find((c: any) => c.id === l.to.via);
      const edge = c3.edges.find((e: any) => e.componentRelationshipIds.includes(l.id));
      if (!via || !edge) return false;
      const comp = S.studioNodeKeys.component(l.from);
      const target = S.studioNodeKeys.element(l.to.id);
      return via.to.element === l.to.id
        ? edge.from === comp && (edge.to === target || edge.to.startsWith("studio:component:"))
        : edge.to === comp && (edge.from === target || edge.from.startsWith("studio:component:"));
    }),
  unresolved: views.source.relationships.unresolved.map((u: any) => u.id),
  unscopedQueues: views.source.unscopedQueues,
  legacyKey: ["studio:service:redirect", "studio:package:link-platform", "studio:components"].map(
    (k) => [k, S.isLegacyStudioDetailKey(k)],
  ),
};
const text = `${JSON.stringify(out, null, 2)}\n`;
if (process.argv[3]) writeFileSync(process.argv[3], text);
console.log(text);

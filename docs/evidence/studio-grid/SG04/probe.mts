// biome-ignore-all lint/suspicious/noExplicitAny: one-off evidence script over dynamically imported spec sources.
// SG04 one-off probe. Usage: tsx probe.mts <spec-src-index> [out-dir]
import { writeFileSync } from "node:fs";

const S: any = await import(process.argv[2]);
const outDir = process.argv[3];
const manifest = S.studioGoalManifests[0];
const hash = await S.studioGoalManifestHash(manifest);
const meta = S.studioArchitectureExamples;
const { design, layout, name } = S.studioArchitectureExample("studio-tinyurl");
const findings = S.validateDesign ? S.validateDesign(design) : [];
const studioFindings = S.validateStudio(design);
const blueprint = S.designBlueprintSchema.parse(S.designBlueprint(design, name));
const views = S.studioViews(design, S.studioDefinitions, name);
const out = {
  examples: meta.map((m: any) => `${m.id}@${m.version}`),
  manifestHash: hash,
  manifestHashMatches: hash === meta[0].goalManifestSha256,
  sources: (await S.resolveStudioSources(design.architecture.studio.origin)).map(
    (s: any) => s.status,
  ),
  designFindings: findings.map((f: any) => `${f.code} ${f.path?.join(".") ?? ""} ${f.message}`),
  studioFindings: studioFindings.map(
    (f: any) => `${f.code} ${f.path?.join(".") ?? ""} ${f.message}`,
  ),
  counts: {
    elements: design.elements.length,
    connections: design.connections.length,
    packages: design.architecture.studio.packages.length,
    components: design.architecture.studio.components.length,
    componentConnections: design.architecture.studio.componentConnections.length,
  },
  blueprint: {
    services: blueprint.services.map((s: any) => `${s.kind}:${s.id}:${s.components.length}c`),
    resources: blueprint.resources.map((r: any) => `${r.kind}:${r.id}`),
    externals: blueprint.externals.map((r: any) => `${r.id}`),
    groups: blueprint.groups.map((g: any) => `${g.id}:${(g.members ?? []).join("+")}`),
    connections: blueprint.connections.length,
    componentLinks: blueprint.componentLinks.length,
    omitted: blueprint.omitted,
    findingCodes: [...new Set(blueprint.findings.map((f: any) => f.code))],
  },
  views: [views.context, views.containers, ...views.details].map((v: any) => ({
    key: v.key,
    nodes: v.nodes.map((n: any) => n.id),
  })),
  layoutKeys: Object.keys(layout.architecture ?? {}),
};
console.log(JSON.stringify(out, null, 2));
if (outDir) {
  writeFileSync(`${outDir}/probe.json`, `${JSON.stringify(out, null, 2)}\n`);
  writeFileSync(`${outDir}/tinyurl-blueprint.json`, `${JSON.stringify(blueprint, null, 2)}\n`);
}
// A project saved from a removed study keeps its origin and resolves as "unavailable", not an error.
const removed = await S.resolveStudioSources({
  example: { id: "studio-mattermost-reference", version: "1.0.0" },
  goalManifestSha256: "8a540c8cc0b3492379aade3f19d4bae516b07cf58c5fe68bdc61ff1c2fad6f70",
});
console.log(JSON.stringify({ removedStudyOrigin: removed.map((s: any) => s.status) }));

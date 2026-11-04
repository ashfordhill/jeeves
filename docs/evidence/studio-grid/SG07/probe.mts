// biome-ignore-all lint/suspicious/noExplicitAny: one-off evidence script over dynamically imported sources.
// SG07 one-off probe: drawn lines (one per ordered box pair) and derived short labels for the
// TinyURL study and, read-only, any design JSON passed as a third argument.
// Usage: tsx probe.mts <packages/spec/src/index.ts> <apps/web/src/studio/routing.ts> [out.json]
import { writeFileSync } from "node:fs";

const S: any = await import(process.argv[2] as string);
const R: any = await import(process.argv[3] as string);
const { design, name } = S.studioArchitectureExample("studio-tinyurl");
const views = S.studioViews(design, S.studioDefinitions, name);
const out: any = {};
for (const scope of S.studioScopes(views)) {
  const paths = R.studioPaths(scope);
  const labels = R.studioPathLabels(paths);
  out[scope.key] = {
    lines: paths.length,
    merged: paths.filter((p: any) => p.item.members.length > 1).length,
    unlabelledInProcess: paths.filter((p: any) => !labels[p.id]).length,
    labels: paths.map(
      (p: any) =>
        `${p.item.from} -> ${p.item.to} | ${p.item.members.length} | ${labels[p.id]?.short ?? "(in process, unlabelled)"} | full: ${p.item.actions.join(" / ")} · ${p.item.protocols.join(" / ")}`,
    ),
    longest: Math.max(0, ...Object.values(labels).map((l: any) => Array.from(l.short).length)),
  };
}
const text = `${JSON.stringify(out, null, 2)}\n`;
if (process.argv[4]) writeFileSync(process.argv[4], text);
console.log(text);

/** Reviewed starting architectures. Their copies are editable; provided behavior comes from templates. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { designSchema, layoutSchema, type TemplateRef, workspaceConfigSchema } from "@jeeves/spec";
import { z } from "zod";

const hash = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const entry = z.strictObject({
  file: z.enum(["design.json", "layout.json"]),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const manifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.literal("resource-workspace"),
  version: z.literal("0.1.0"),
  title: z.string(),
  description: z.string(),
  maturity: z.literal("experimental"),
  features: z.array(z.string()),
  limits: z.array(z.string()),
  design: entry,
  layout: entry,
  provenance: z.strictObject({ jeevesCommit: z.string(), note: z.string() }),
});
const ref = { id: "resource-workspace", version: "0.1.0" } as const;
export const starterConfigSchema = workspaceConfigSchema
  .pick({ preset: true, pageSize: true, tagline: true })
  .extend({
    pageSize: workspaceConfigSchema.shape.pageSize.default(10),
    tagline: workspaceConfigSchema.shape.tagline.default("Inventory, without the busywork."),
  });
export class StarterError extends Error {}
function loadStarter(request: TemplateRef) {
  if (request.id !== ref.id || request.version !== ref.version)
    throw new StarterError("Unknown architecture starter version.");
  const root = fileURLToPath(
    new URL("../../../starters/resource-workspace/0.1.0/", import.meta.url),
  );
  const raw = readFileSync(join(root, "manifest.json"));
  if (hash(raw) !== "31fc24a5bca956a718681689e7495a8672f7e8047049355250d1e530348e9007")
    throw new StarterError("Registered starter manifest changed under its published version.");
  const manifest = manifestSchema.parse(JSON.parse(raw.toString("utf8")));
  const read = (source: z.output<typeof entry>) => {
    const bytes = readFileSync(join(root, source.file));
    if (hash(bytes) !== source.sha256)
      throw new StarterError(`Starter checksum mismatch: ${source.file}`);
    return JSON.parse(bytes.toString("utf8"));
  };
  return {
    manifest,
    manifestSha256: hash(raw),
    design: designSchema.parse(read(manifest.design)),
    layout: layoutSchema.parse(read(manifest.layout)),
  };
}
export function starterCatalog() {
  const { manifest, manifestSha256 } = loadStarter(ref);
  const { design: _design, layout: _layout, ...details } = manifest;
  return [{ ...details, manifestSha256 }];
}
export function createStarterDesign(
  request: TemplateRef,
  options: { title: string; hostPort: number; config?: Record<string, unknown> },
) {
  const title = z.string().trim().min(1).max(80).parse(options.title);
  const hostPort = z.int().min(1024).max(65535).parse(options.hostPort);
  const starter = loadStarter(request);
  const config = starterConfigSchema.parse(options.config ?? {});
  const design = starter.design;
  const web = design.elements.find((element) => element.id === "inventory-web");
  const workspace = web?.attachments.find(
    (attachment) => attachment.template.id === "resource-workspace",
  );
  if (!web || !workspace || !design.architecture)
    throw new StarterError("Starter composition is incomplete.");
  design.startedFrom = { ...ref, manifestSha256: starter.manifestSha256 };
  design.architecture.system.name = title;
  web.config = { ...web.config, title, hostPort };
  workspace.config = { ...workspace.config, ...config };
  return { design, layout: starter.layout };
}

/**
 * Fixed acceptance packs available to Generate. Packs are repository fixtures, never uploaded
 * source: each `fixtures/acceptance/<id>/manifest.ts` exports the reviewed `FixedAcceptance[]`.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type FixedAcceptance, fixedAcceptanceSchema } from "@jeeves/generator";

const PACKS_DIR = fileURLToPath(new URL("../../../../fixtures/acceptance/", import.meta.url));

export type AcceptancePack = {
  id: string;
  suites: { id: string; acceptanceIds: string[] }[];
};

async function load(id: string): Promise<FixedAcceptance[] | undefined> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return undefined;
  const manifest = join(PACKS_DIR, id, "manifest.ts");
  if (!existsSync(manifest)) return undefined;
  const module = (await import(pathToFileURL(manifest).href)) as Record<string, unknown>;
  const suites = Object.values(module).find(
    (value): value is FixedAcceptance[] =>
      Array.isArray(value) &&
      value.length > 0 &&
      value.every(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          "id" in item &&
          "acceptanceIds" in item &&
          "source" in item,
      ),
  );
  return suites ? fixedAcceptanceSchema.array().parse(suites) : undefined;
}

/** Metadata for the Generate picker; source stays on the server. */
export async function acceptancePacks(): Promise<AcceptancePack[]> {
  if (!existsSync(PACKS_DIR)) return [];
  const packs: AcceptancePack[] = [];
  for (const id of readdirSync(PACKS_DIR, { withFileTypes: true })) {
    if (!id.isDirectory()) continue;
    const suites = await load(id.name);
    if (suites)
      packs.push({
        id: id.name,
        suites: suites
          .map((suite) => ({
            id: suite.id,
            acceptanceIds: suite.acceptanceIds,
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      });
  }
  return packs.sort((a, b) => a.id.localeCompare(b.id));
}

/** The full registered suites for one pack, or `undefined` for an unknown id. */
export async function acceptancePack(id: string): Promise<FixedAcceptance[] | undefined> {
  return load(id);
}

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parse } from "yaml";
import { contractTypes } from "./types.ts";

/** The line in a generated client that names its contract, relative to the client file. */
export const CONTRACT_MARKER = "// @jeeves-contract ";

export interface GeneratedTypes {
  client: string;
  contract: string;
  types: string;
  changed: boolean;
}

/**
 * Writes `src/clients/<target>.openapi.ts` next to each generated client
 * (`src/clients/<target>.generated.ts`) in an element directory, from the contract its marker
 * line names. Throws, naming every problem, when a contract is missing or can't be typed.
 */
export function generateClientTypes(elementDir: string): GeneratedTypes[] {
  const clientsDir = join(elementDir, "src/clients");
  if (!existsSync(clientsDir)) return [];
  const results: GeneratedTypes[] = [];
  const problems: string[] = [];
  const files = readdirSync(clientsDir)
    .filter((f) => f.endsWith(".generated.ts"))
    .sort();
  for (const file of files) {
    const client = join(clientsDir, file);
    const marker = readFileSync(client, "utf8")
      .split("\n")
      .find((line) => line.startsWith(CONTRACT_MARKER));
    if (!marker) continue;
    const contract = resolve(dirname(client), marker.slice(CONTRACT_MARKER.length).trim());
    const types = join(clientsDir, file.replace(/\.generated\.ts$/, ".openapi.ts"));
    const shown = (path: string) => relative(elementDir, path).replaceAll("\\", "/");
    let text: string;
    try {
      text = readFileSync(contract, "utf8");
    } catch {
      problems.push(`${shown(client)}: its contract ${shown(contract)} doesn't exist`);
      continue;
    }
    let document: unknown;
    try {
      document = parse(text);
    } catch (error) {
      problems.push(`${shown(contract)}: not valid YAML: ${(error as Error).message}`);
      continue;
    }
    try {
      const source = contractTypes(document, shown(contract));
      const before = existsSync(types) ? readFileSync(types, "utf8") : undefined;
      if (before !== source) writeFileSync(types, source);
      results.push({
        client: shown(client),
        contract: shown(contract),
        types: shown(types),
        changed: before !== source,
      });
    } catch (error) {
      problems.push((error as Error).message);
    }
  }
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return results;
}

export { contractTypes } from "./types.ts";

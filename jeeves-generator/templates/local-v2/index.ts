import { readdirSync } from "node:fs";
import { jsonFile } from "../../src/json.ts";
import { captureV2Sources, createV2Registry, type V2Emitter } from "../../src/v2/registry.ts";

const root = new URL("../../../", import.meta.url);
function sourcePaths(path: string): string[] {
  return readdirSync(new URL(`${path}/`, root), { withFileTypes: true })
    .filter((entry) => !entry.name.includes(".test.") && entry.name !== "fixtures")
    .flatMap((entry) =>
      entry.isDirectory() ? sourcePaths(`${path}/${entry.name}`) : [`${path}/${entry.name}`],
    );
}

/** Infrastructure only: no runtime, template or preset implementation is installed yet. */
export function loadLocalV2Registry() {
  const paths = [
    ...sourcePaths("jeeves-generator/src/v2"),
    ...sourcePaths("jeeves-generator/templates/local-v2"),
    ...sourcePaths("jeeves/packages/spec/src"),
    "jeeves-generator/src/json.ts",
    "jeeves-generator/src/files.ts",
    "jeeves-generator/src/export.ts",
    "jeeves-generator/package.json",
    "jeeves/packages/spec/package.json",
    "pnpm-lock.yaml",
  ];
  const diagnostic: V2Emitter = {
    id: "local.diagnostic",
    version: "0.1.0-experimental.1",
    status: "diagnostic",
    description:
      "Normalized binding inventory only; implements no application behavior or setting consumer.",
    sourcePaths: paths,
    render: ({ model }) => ({
      files: [
        {
          path: "diagnostics/generation.json",
          content: jsonFile(model),
          ownership: "generated-scaffold",
          sourcePaths: ["/generation"],
        },
      ],
      gaps: [
        {
          id: "application-implementations",
          status: "unfinished",
          required: true,
          description:
            "No standalone project envelope, runtime, feature implementations or application hooks are installed.",
          sourcePaths: ["/generation"],
        },
      ],
    }),
  };
  return createV2Registry(captureV2Sources(root, paths), [diagnostic]);
}

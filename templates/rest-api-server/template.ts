import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { TemplateModule } from "@jeeves/template-kit";
import { generate } from "./generate.ts";
import manifest from "./manifest.ts";
import runtimePackage from "./runtime/package.json" with { type: "json" };
import { testPack } from "./test-pack/index.ts";

export const restApiServerTemplate: TemplateModule = {
  manifest,
  generate,
  agentGuide: readFileSync(new URL("./agent-guide.md", import.meta.url), "utf8"),
  testPack,
  runtime: {
    name: runtimePackage.name,
    version: runtimePackage.version,
    dir: fileURLToPath(new URL("./runtime", import.meta.url)),
  },
};

export default restApiServerTemplate;

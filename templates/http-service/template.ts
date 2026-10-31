import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { TemplateModule } from "@jeeves/template-kit";
import { generate } from "./generate.ts";
import { generateV03 } from "./generate-v03.ts";
import manifest from "./manifest.ts";
import manifestV02 from "./manifest-v02.ts";
import manifestV03 from "./manifest-v03.ts";
import runtimePackage from "./runtime/package.json" with { type: "json" };
import { testPack } from "./test-pack/index.ts";

export const httpServiceTemplate: TemplateModule = {
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

export default httpServiceTemplate;

export const httpServiceV02Template: TemplateModule = {
  ...httpServiceTemplate,
  manifest: manifestV02,
};

export const httpServiceV03Template: TemplateModule = {
  ...httpServiceV02Template,
  manifest: manifestV03,
  generate: generateV03,
};

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { TemplateModule } from "@jeeves/template-kit";
import legacy from "../../artifacts/rest-server/0.2.0/manifest.json" with { type: "json" };
import current from "../../artifacts/rest-server/0.3.0/manifest.json" with { type: "json" };
import { generate } from "./generate.ts";
import manifest from "./manifest.ts";
import manifestV02 from "./manifest-v02.ts";
import { testPack } from "./test-pack/index.ts";

export const restApiServerTemplate: TemplateModule = {
  manifest,
  generate,
  agentGuide: readFileSync(new URL("./agent-guide.md", import.meta.url), "utf8"),
  testPack,
  runtime: {
    name: legacy.name,
    version: legacy.version,
    dir: fileURLToPath(new URL("./runtime", import.meta.url)),
    artifact: {
      path: fileURLToPath(
        new URL(`../../artifacts/rest-server/0.2.0/${legacy.archive}`, import.meta.url),
      ),
      sha256: legacy.sha256,
    },
  },
};

export default restApiServerTemplate;

export const restApiServerV02Template: TemplateModule = {
  ...restApiServerTemplate,
  manifest: manifestV02,
  agentGuide:
    restApiServerTemplate.agentGuide +
    "\n" +
    readFileSync(new URL("./session-transition.md", import.meta.url), "utf8"),
  runtime: {
    name: current.name,
    version: current.version,
    dir: fileURLToPath(new URL("./runtime", import.meta.url)),
    artifact: {
      path: fileURLToPath(
        new URL(`../../artifacts/rest-server/0.3.0/${current.archive}`, import.meta.url),
      ),
      sha256: current.sha256,
    },
  },
};

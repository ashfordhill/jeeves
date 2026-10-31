import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { TemplateModule } from "@jeeves/template-kit";
import { generate } from "./generate.ts";
import manifest from "./manifest.ts";
import manifestV02 from "./manifest-v02.ts";
import runtimePackage from "./runtime/package.json" with { type: "json" };
import { testPack } from "./test-pack/index.ts";

export const webAppTemplate: TemplateModule = {
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

export default webAppTemplate;

/** The old scaffold remains identical unless the new version explicitly binds a workspace. */
export const webAppV02Template: TemplateModule = {
  ...webAppTemplate,
  manifest: manifestV02,
  agentGuide: readFileSync(new URL("./agent-guide-v02.md", import.meta.url), "utf8"),
  generate(ctx) {
    const result = generate(ctx);
    if (
      ctx.element.attachments.some((attachment) => attachment.template.id === "resource-workspace")
    ) {
      const replaced = ["src/App.tsx", "src/main.tsx", "src/styles.css", "src/pages/Home.tsx"].map(
        (path) => `${ctx.dir}/${path}`,
      );
      result.files = result.files.filter((file) => !replaced.includes(file.path));
    }
    return result;
  },
};

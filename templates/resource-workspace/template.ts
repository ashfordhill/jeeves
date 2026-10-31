import { fileURLToPath } from "node:url";
import type { TemplateModule } from "@jeeves/template-kit";
import { generate } from "./generate.ts";
import manifest from "./manifest.ts";
import { testPack } from "./test-pack.ts";
export const resourceWorkspaceTemplate: TemplateModule = {
  manifest,
  generate,
  testPack,
  agentGuide:
    "Accounts, resource forms, paging, transport, descriptor and composition are generated. Implement additive content only under src/project/ and supplemental tests under tests/. Never replace src/App.tsx, main.tsx, styles.css, workspace.generated.json or frozen component dependencies. Domain API extensions remain separate declared tasks. This version has no custom business-command UI hook or permission to bypass the resource contract.",
  runtimes: [
    {
      name: "@jeeves/resource-workspace",
      version: "0.1.0",
      dir: fileURLToPath(new URL("../../packages/resource-workspace", import.meta.url)),
      artifact: {
        path: fileURLToPath(
          new URL(
            "../../artifacts/resource-workspace/0.1.0/jeeves-resource-workspace-0.1.0.tgz",
            import.meta.url,
          ),
        ),
        sha256: "dbe8b4579b75dfac42cb95a459ec4581436e06dfeb95c7fbd6fa09ec5b48488f",
      },
    },
    {
      name: "@jeeves/product-ui",
      version: "0.3.0",
      dir: fileURLToPath(new URL("../../packages/product-ui", import.meta.url)),
      artifact: {
        path: fileURLToPath(
          new URL("../../artifacts/product-ui/0.3.0/jeeves-product-ui-0.3.0.tgz", import.meta.url),
        ),
        sha256: "389791a7a18bf33bbd66fc0b62e8c52c9abedf22acd7ebd86c53f823d696a615",
      },
    },
  ],
};

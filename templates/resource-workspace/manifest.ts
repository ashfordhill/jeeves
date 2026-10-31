import { defineTemplate, workspaceConfigSchema } from "@jeeves/spec";
export default defineTemplate({
  id: "resource-workspace",
  version: "0.1.0",
  kind: "attachment",
  displayName: "Resource workspace",
  description:
    "Account access, owner records, forms and cursor pages derived from an actual resource API. Experimental; custom content stays project-owned.",
  config: workspaceConfigSchema,
  ports: [],
  card: { icon: "browser", chips: ["preset"] },
});

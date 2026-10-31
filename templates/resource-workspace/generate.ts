import { workspaceDefinitionSchema } from "@jeeves/resource-workspace/definition";
import { resourceDisplayLabel, workspaceModel } from "@jeeves/spec";
import type { GenerateContext, GenerateResult, OutputFile } from "@jeeves/template-kit";

export function generate(ctx: GenerateContext): GenerateResult {
  if (!ctx.attachment) throw new Error("Workspace generation requires its attachment");
  const { binding, config, collections } = workspaceModel(
    ctx.design,
    ctx.element.id,
    ctx.attachment.id,
  );
  const definition = workspaceDefinitionSchema.parse({
    version: 1,
    title: ctx.element.config.title,
    tagline: config.tagline,
    preset: config.preset,
    pageSize: config.pageSize,
    collections: collections.map(({ selection, resource }) => {
      const property = (reference: string) =>
        reference === "$id"
          ? "id"
          : reference === "$createdAt"
            ? "createdAt"
            : resource.fields.find((field) => field.id === reference)!.name;
      return {
        id: resource.id,
        name: resource.name,
        label: selection.label,
        singularLabel: selection.singularLabel,
        fields: resource.fields.map((field) => ({
          ...field,
          label: resourceDisplayLabel(field.name),
        })),
        relationships: resource.belongsTo.map((relation) => {
          const parent = collections.find((item) => item.resource.id === relation.resource)!;
          return {
            id: relation.id,
            name: `${parent.resource.name}Id`,
            label: parent.selection.singularLabel,
            target: parent.resource.id,
          };
        }),
        operations: resource.operations,
        primaryField: property(selection.primaryField),
        columns: selection.columns.map(property),
      };
    }),
  });
  const file = (
    path: string,
    contents: string,
    ownership: OutputFile["ownership"] = "generated",
  ): OutputFile => ({ path: `${ctx.dir}/${path}`, contents, ownership });
  const header =
    "// Generated resource workspace composition. Change the diagram; project content belongs in src/project/.\n";
  return {
    files: [
      file("src/workspace.generated.json", `${JSON.stringify(definition, null, 2)}\n`),
      file(
        "src/App.tsx",
        header +
          `import { createWorkspaceClient, ResourceWorkspace } from "@jeeves/resource-workspace";
import { apiUrl } from "@jeeves/web-runtime";
import definition from "./workspace.generated.json";
import { ProjectExtras } from "./project/ProjectExtras.tsx";
const client = createWorkspaceClient({ definition, baseUrl: () => apiUrl(${JSON.stringify(binding.service)}) });
export function App() { return <ResourceWorkspace client={client} extraContent={<ProjectExtras />} />; }
`,
      ),
      file(
        "src/main.tsx",
        header +
          `import { startApp } from "@jeeves/web-runtime";
import { App } from "./App.tsx";
import { app } from "./jeeves.generated.ts";
import "@jeeves/product-ui/styles.css";
import "@jeeves/resource-workspace/styles.css";
import "./styles.css";
void startApp(app, <App />);
`,
      ),
      file(
        "src/styles.css",
        "/* Generated host layout. Workspace presentation is versioned. */\nhtml, body, #root { margin: 0; min-height: 100%; }\n",
      ),
      file(
        "src/project/ProjectExtras.tsx",
        "// Project-owned additive content shown inside the authenticated workspace.\n// Account, navigation, records and forms are supplied by the versioned component.\nexport function ProjectExtras() { return null; }\n",
        "scaffold",
      ),
    ],
    compose: {},
    runtimeDependencies: [
      { element: ctx.element.id, name: "@jeeves/resource-workspace" },
      { element: ctx.element.id, name: "@jeeves/product-ui" },
    ],
  };
}

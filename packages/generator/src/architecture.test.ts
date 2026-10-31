import {
  applyOperations,
  architectureViews,
  type DesignDocument,
  validateArchitecture,
} from "@jeeves/spec";
import { expect, it } from "vitest";
import { templateSet } from "./modules.ts";
import { planProject } from "./plan.ts";
import { createRecipeDesign, recipeForDesign } from "./recipes.ts";
import { fixtureDesign } from "./test-support.ts";

const templates = templateSet();
it("groups every QR operation once, preserves partial and mixed groups, and keeps uses explicit", () => {
  const design = fixtureDesign("qrwty-architecture");
  const project = (input: DesignDocument) =>
    architectureViews(input, templates.lookup, "QR").components.find(
      (view) => view.container === "qrwty",
    )!;
  const scope = project(design);
  const grouped = scope.nodes.filter((node) => node.binding?.component);
  expect(grouped).toHaveLength(5);
  expect(
    grouped.flatMap((node) => node.members ?? []).filter((node) => node.binding?.extension),
  ).toHaveLength(8);
  expect(
    new Set(grouped.flatMap((node) => node.members?.map((member) => member.id) ?? [])).size,
  ).toBe(10);
  expect(
    scope.edges
      .filter((edge) => edge.declared)
      .map((edge) => edge.from)
      .sort(),
  ).toEqual(["responsibility:analytics", "responsibility:artwork", "responsibility:redirect"]);
  expect(scope.edges.filter((edge) => edge.id.startsWith("declared:"))).toHaveLength(0);
  const partial = structuredClone(design);
  partial.architecture!.components = partial.architecture!.components!.filter(
    (item) => item.id !== "artwork",
  );
  expect(
    project(partial).nodes.filter((node) => node.unassigned && node.binding?.extension),
  ).toHaveLength(5);
  const mixed = structuredClone(design);
  const definitions = mixed.architecture!.components!;
  definitions
    .find((item) => item.id === "qr-management")!
    .members.push(...definitions.find((item) => item.id === "redirect")!.members);
  mixed.architecture!.components = definitions.filter((item) => item.id !== "redirect");
  expect(
    project(mixed).nodes.find((item) => item.binding?.component === "qr-management")?.support,
  ).toBe("mixed");
  expect(validateArchitecture(mixed)).toEqual([]);
});

it("rejects duplicate and unknown bindings atomically while retaining lost intent through a display rename", () => {
  const design = fixtureDesign("qrwty-architecture");
  const before = structuredClone(design);
  const architecture = structuredClone(design.architecture!);
  architecture.components![1]!.members.push(...architecture.components![0]!.members);
  expect(
    applyOperations(design, [{ op: "setArchitecture", architecture }], templates.lookup).ok,
  ).toBe(false);
  architecture.components![1]!.members = [
    { attachment: "missing", kind: "resource", ref: "missing" },
  ];
  expect(
    applyOperations(design, [{ op: "setArchitecture", architecture }], templates.lookup).ok,
  ).toBe(false);
  expect(design).toEqual(before);
  const removed = applyOperations(
    design,
    [{ op: "removeAttachment", id: "qrwty-api" }],
    templates.lookup,
  );
  expect(removed.ok).toBe(true);
  if (!removed.ok) return;
  expect(removed.design.architecture?.components).toEqual(design.architecture?.components);
  const renamed = structuredClone(removed.design.architecture!);
  renamed.components![0]!.name = "Renamed missing capability";
  expect(
    applyOperations(
      removed.design,
      [{ op: "setArchitecture", architecture: renamed }],
      templates.lookup,
    ).ok,
  ).toBe(true);
  const missing = architectureViews(removed.design, templates.lookup, "QR")
    .components.flatMap((view) => view.nodes)
    .filter((node) => node.missing?.length);
  expect(missing).toHaveLength(5);
});
it("projects the same QR recipe through context, containers and meaningful component bindings", () => {
  const { design } = createRecipeDesign(
    { id: "qr-studio", version: "0.1.0" },
    { title: "Independent Studio", hostPort: 18287 },
  );
  const snapshot = structuredClone(design);
  const recipe = recipeForDesign(design, templates.lookup)!;
  const views = architectureViews(design, templates.lookup, "Project", {
    id: recipe.manifest.id,
    version: recipe.manifest.version,
    ...recipe.manifest.provided,
    frontendNotes: Object.fromEntries(
      recipe.design.elements.map((element) => [element.id, element.notes]),
    ),
  });
  expect(views.context.nodes).toHaveLength(4);
  expect(views.context.edges).toContainEqual(
    expect.objectContaining({
      from: "context:scanner",
      to: "context:destination",
      description: "Browser follows the destination URL",
    }),
  );
  expect(
    views.containers.edges.filter((edge) => edge.connection).map((edge) => edge.connection),
  ).toEqual(design.connections.map((connection) => connection.id));
  const api = views.components.find((view) => view.container === "qrwty")!;
  expect(
    api.nodes.filter((node) => node.support === "recipe" && node.binding?.element === "qrwty"),
  ).toHaveLength(8);
  expect(api.nodes.find((node) => node.id === "container:qrwty-web")).toEqual(
    views.containers.nodes.find((node) => node.id === "container:qrwty-web"),
  );
  expect(api.nodes.some((node) => node.name === "Accounts and sessions")).toBe(true);
  expect(api.resources.map((resource) => resource.id)).toEqual(["qr", "scan", "artwork"]);
  expect(api.nodes.find((node) => node.binding?.extension === "redirect")?.acceptance).toContain(
    "QR-03",
  );
  expect(api.edges.some((edge) => edge.to === "container:qrwty-db")).toBe(true);
  expect(
    architectureViews(design, templates.lookup, "Project")
      .components.find((view) => view.container === "qrwty")
      ?.nodes.filter((node) => node.support === "extension" && node.binding?.element === "qrwty"),
  ).toHaveLength(8);
  expect(design).toEqual(snapshot);
});

it("uses the same projection for a non-QR resource application and never invents wiring", () => {
  const design = fixtureDesign("resources");
  const model = design.elements
    .flatMap((element) => element.attachments)
    .find((attachment) => attachment.config.model)!.config.model as {
    resources: { name: string }[];
    extensions: { id: string; notes: string }[];
  };
  model.resources[0]!.name = "inventoryItem";
  model.extensions[0]!.notes = "Summarize inventory movements for the signed-in owner.";
  const views = architectureViews(design, templates.lookup, "Inventory");
  expect(views.context.name).toBe("Inventory");
  expect(
    views.components
      .flatMap((view) => view.nodes)
      .some((node) => node.name === "Inventory Item registry"),
  ).toBe(true);
  for (const edge of views.components.flatMap((view) => view.edges))
    expect(design.connections.some((connection) => connection.id === edge.connection)).toBe(true);
  expect(views.provision).toBeUndefined();
  const attachment = design.elements
    .flatMap((element) => element.attachments)
    .find((item) => item.template.id === "rest-api-server")!;
  attachment.template.version = "99.0.0";
  const unsupported = architectureViews(design, templates.lookup, "Inventory");
  expect(
    unsupported.components
      .flatMap((view) => view.nodes)
      .filter((node) => node.binding?.attachment === attachment.id),
  ).toEqual([expect.objectContaining({ kind: "binding", support: "intent" })]);
});

it("changes documentation/configuration through the same protected recipe without changing runtime wiring", () => {
  const { design } = createRecipeDesign(
    { id: "qr-studio", version: "0.1.0" },
    { title: "Studio", hostPort: 18287 },
  );
  const before = planProject(design, templates, { projectName: "Studio" });
  const afterDesign: DesignDocument = structuredClone(design);
  afterDesign.architecture!.system.description = "A documented business responsibility";
  const after = planProject(afterDesign, templates, { projectName: "Studio" });
  expect(after.files.filter((file) => file.path !== "jeeves/design.json")).toEqual(
    before.files.filter((file) => file.path !== "jeeves/design.json"),
  );
  afterDesign.recipe!.config.tagline = "Changed in structured configuration";
  const configured = planProject(afterDesign, templates, { projectName: "Studio" });
  expect(configured.recipe).toEqual(before.recipe);
  expect(configured.artifacts).toEqual(before.artifacts);
  expect(
    configured.files.find((file) => file.path.endsWith("product.generated.ts"))?.contents,
  ).toContain("Changed in structured configuration");
  expect(configured.files.find((file) => file.path === "docker-compose.yml")).toEqual(
    before.files.find((file) => file.path === "docker-compose.yml"),
  );
});

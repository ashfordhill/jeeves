import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import type { DesignDocument } from "./design.ts";
import { createStudioComponentSettings, type StudioComponentKind } from "./studio-components.ts";
import { studioArchitectureExample } from "./studio-examples/index.ts";
import { moduleKinds, moduleLinkChoices, newModuleIdentity } from "./studio-modules.ts";
import { buildStudioCommand, type StudioCommand } from "./studio-operations.ts";
import { validateStudio } from "./studio-validation.ts";

const tinyurl = (): DesignDocument => studioArchitectureExample("studio-tinyurl").design;
function run(design: DesignDocument, command: StudioCommand) {
  const batch = buildStudioCommand(design, command);
  const result = applyOperations(design, batch.ops, { baseRevision: batch.baseRevision });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
}
/** Adds a module of this kind to `host` with the inspector's default name and ID. */
function addModule(design: DesignDocument, host: string, kind: StudioComponentKind) {
  const created = newModuleIdentity(design, host, kind);
  const next = run(design, {
    type: "createComponent",
    component: { ...created, host, settings: createStudioComponentSettings(kind) },
  });
  return { ...created, design: next };
}
const gaps = (design: DesignDocument, id: string) => {
  const index = design.architecture?.studio?.components?.findIndex((item) => item.id === id);
  return validateStudio(design)
    .filter((item) => item.target.path?.[2] === "components" && item.target.path[3] === index)
    .map((item) => item.message);
};

describe("modules", () => {
  it("are offered only on applications and get free names and IDs per host", () => {
    const design = tinyurl();
    expect(moduleKinds(design, "shorten-api")).toHaveLength(10);
    expect(moduleKinds(design, "links-db")).toEqual([]);
    expect(moduleKinds(design, "cdn")).toEqual([]);
    // Shorten API already has an "ID generator"; the Redirect service has none.
    expect(newModuleIdentity(design, "shorten-api", "id-generator")).toEqual({
      id: "shorten-api-id-generator-2",
      name: "ID generator 2",
    });
    expect(newModuleIdentity(design, "redirect", "id-generator")).toEqual({
      id: "redirect-id-generator",
      name: "ID generator",
    });
    const first = addModule(design, "redirect", "id-generator");
    expect(newModuleIdentity(first.design, "redirect", "id-generator")).toEqual({
      id: "redirect-id-generator-2",
      name: "ID generator 2",
    });
  });

  it("link to the tiles their host links to, through that link, and become ready", () => {
    const added = addModule(tinyurl(), "shorten-api", "data-access");
    expect(gaps(added.design, added.id)).toEqual(["Data access needs a database connection."]);
    const [choice, ...others] = moduleLinkChoices(added.design, added.id);
    expect(others).toEqual([]);
    expect(choice).toEqual({
      element: "links-db",
      via: "shorten-db",
      id: "shorten-api-data-access-links-db",
    });
    if (!choice) return;
    const linked = run(added.design, {
      type: "connectComponent",
      links: [
        {
          link: {
            id: choice.id,
            from: added.id,
            to: { kind: "element", id: choice.element, via: choice.via },
          },
        },
      ],
    });
    expect(gaps(linked, added.id)).toEqual([]);
    expect(moduleLinkChoices(linked, added.id)).toEqual([]);
    // A publisher reaches the queue only through a publish link; a consumer in the publisher's
    // host finds none, and the click publisher already uses Click events.
    const consumer = addModule(tinyurl(), "redirect", "event-consumer");
    expect(moduleLinkChoices(consumer.design, consumer.id)).toEqual([]);
    expect(
      moduleLinkChoices(tinyurl(), "redirect-click-publisher").map((item) => item.element),
    ).toEqual(["links-db"]);
  });
});

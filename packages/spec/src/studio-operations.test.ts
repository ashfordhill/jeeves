import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, designSchema, emptyDesign } from "./design.ts";
import { createStudioComponentSettings } from "./studio-components.ts";
import { studioArchitectureExample } from "./studio-examples/index.ts";
import { createStudioSettings, studioKindLanguages, studioSettingsSchema } from "./studio-model.ts";
import { buildStudioCommand, type StudioCommand } from "./studio-operations.ts";

const tinyurl = () => studioArchitectureExample("studio-tinyurl").design;

/** Builds the command and applies its batch, as the studio and chat do. */
function run(design: DesignDocument, command: StudioCommand) {
  const batch = buildStudioCommand(design, command);
  expect(batch.baseRevision).toBe(design.revision);
  const result = applyOperations(design, batch.ops, { baseRevision: batch.baseRevision });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return { ops: batch.ops.map((op) => op.op), design: result.design };
}
const studio = (design: DesignDocument) => {
  const model = design.architecture?.studio;
  if (!model) throw new Error("No studio model.");
  return model;
};
describe("buildStudioCommand", () => {
  it("refuses studio commands before the system exists, except a first addTile", () => {
    const first = {
      type: "addTile",
      from: { lane: "upload" },
      side: "after",
      link: "sync",
      tile: { id: "links", name: "Links", kind: "service" },
      linkId: "upload-links",
    } as const;
    expect(() => buildStudioCommand(emptyDesign(), first)).toThrow(/no system yet/);
    expect(() =>
      buildStudioCommand(emptyDesign(), { type: "edit", element: "links", name: "x" }),
    ).toThrow(/no system yet/);
    const { ops, design } = run(emptyDesign(), { ...first, system: { name: "Shortener" } });
    expect(ops).toEqual(["setArchitecture", "addElement", "setStudio"]);
    expect(studio(design).entries).toEqual([
      { id: "upload-links", lane: "upload", element: "links" },
    ]);
  });

  it("edits a box's text and settings, and the system text in place", () => {
    const settings = { ...createStudioSettings("service"), language: "go" as const };
    const edited = run(tinyurl(), {
      type: "edit",
      element: "shorten-api",
      name: "Create API",
      settings,
    });
    expect(edited.ops).toEqual(["updateElement", "setStudio"]);
    expect(edited.design.elements.find((e) => e.id === "shorten-api")?.name).toBe("Create API");
    expect(
      studio(edited.design).elements.find((b) => b.element === "shorten-api")?.settings,
    ).toEqual(settings);

    const system = run(tinyurl(), { type: "editSystem", description: "Short links." });
    expect(system.ops).toEqual(["updateArchitectureSystem"]);
    expect(system.design.architecture?.system.description).toBe("Short links.");
    expect(run(emptyDesign(), { type: "editSystem", name: "New" }).ops).toEqual([
      "setArchitecture",
    ]);
  });

  it("edits a link's details and settings", () => {
    const edited = run(tinyurl(), {
      type: "editConnection",
      connection: "shorten-reputation",
      planned: { label: "Screens links" },
      settings: { timeoutMs: 500 },
    });
    expect(edited.ops).toEqual(["updatePlannedConnection", "setStudio"]);
    expect(
      edited.design.connections.find((c) => c.id === "shorten-reputation")?.planned,
    ).toMatchObject({ label: "Screens links", protocol: "HTTPS" });
    expect(
      studio(edited.design).connections.find((b) => b.connection === "shorten-reputation")
        ?.settings,
    ).toEqual({ timeoutMs: 500 });
    // The same settings on a SQL link are refused.
    expect(
      applyOperations(
        tinyurl(),
        buildStudioCommand(tinyurl(), {
          type: "editConnection",
          connection: "redirect-db",
          settings: { timeoutMs: 500 },
        }).ops,
      ).ok,
    ).toBe(false);
    // An entry is a link without settings.
    expect(() =>
      buildStudioCommand(tinyurl(), { type: "editConnection", connection: "download-cdn" }),
    ).toThrow(/lane entry/);
  });

  it("adds, edits, links and removes components", () => {
    const component = {
      id: "analytics-guard",
      host: "analytics",
      name: "Guard",
      settings: createStudioComponentSettings("auth-guard"),
    };
    expect(() =>
      buildStudioCommand(tinyurl(), {
        type: "createComponent",
        component: { ...component, host: "ghost" },
      }),
    ).toThrow(/no tile "ghost"/);
    let design = run(tinyurl(), {
      type: "createComponent",
      component,
      links: [
        {
          link: {
            id: "guard-data",
            from: "analytics-guard",
            to: { kind: "component", id: "analytics-data" },
          },
        },
      ],
    }).design;
    expect(studio(design).componentConnections?.at(-1)?.id).toBe("guard-data");

    expect(() =>
      buildStudioCommand(design, {
        type: "editComponent",
        component: "analytics-guard",
        settings: createStudioComponentSettings("custom"),
      }),
    ).toThrow(/kind can't change/);
    design = run(design, {
      type: "editComponent",
      component: "analytics-guard",
      name: "Checks keys",
    }).design;
    expect(studio(design).components?.at(-1)?.name).toBe("Checks keys");

    design = run(design, { type: "removeComponent", components: ["analytics-guard"] }).design;
    expect(studio(design).components?.some((c) => c.id === "analytics-guard")).toBe(false);
    expect(studio(design).componentConnections?.some((l) => l.id === "guard-data")).toBe(false);
  });

  it("disconnects a component link but keeps the C2 connection it traced", () => {
    const { design } = run(tinyurl(), {
      type: "disconnectComponent",
      links: ["cache-reader-redis"],
    });
    expect(studio(design).componentConnections?.some((l) => l.id === "cache-reader-redis")).toBe(
      false,
    );
    expect(design.connections.some((c) => c.id === "redirect-cache")).toBe(true);
  });

  it("rejects commands outside the finite vocabulary", () => {
    // Tiles and links change only through the lane commands, so nothing can make an island.
    for (const type of ["addRoute", "create", "connect", "delete", "group", "ungroup"])
      expect(() =>
        buildStudioCommand(tinyurl(), { type, elements: [] } as unknown as StudioCommand),
      ).toThrow();
    expect(() =>
      buildStudioCommand(tinyurl(), {
        type: "edit",
        element: "redirect",
        settings: { kind: "service", runtime: "cobol" },
      } as unknown as StudioCommand),
    ).toThrow();
  });
});

describe("preconfigured kinds and languages", () => {
  it("starts each kind with the owner-approved provider and its default language", () => {
    expect(createStudioSettings("billing")).toMatchObject({
      provider: "stripe",
      language: "typescript",
    });
    expect(createStudioSettings("notification")).toMatchObject({
      provider: "resend",
      language: "typescript",
    });
    expect(createStudioSettings("identity")).toMatchObject({
      provider: "oidc",
      language: "typescript",
    });
    expect(createStudioSettings("gateway")).toMatchObject({ provider: "traefik" });
    expect(createStudioSettings("gateway")).not.toHaveProperty("language");
    expect(createStudioSettings("cdn")).toEqual({ kind: "cdn", provider: "cloudflare" });
    expect(createStudioSettings("redirect").language).toBe("go");
    expect(createStudioSettings("service").language).toBe("typescript");
    expect(createStudioSettings("worker").language).toBe("typescript");
    expect(studioKindLanguages).toEqual({
      service: ["typescript", "go"],
      worker: ["typescript", "go"],
      redirect: ["go", "typescript"],
      identity: ["typescript", "go"],
      notification: ["typescript", "go"],
      billing: ["typescript", "go"],
    });
  });

  it("changeKind starts from the new kind's presets", () => {
    const { design } = run(tinyurl(), {
      type: "changeKind",
      element: "shorten-api",
      kind: "billing",
    });
    expect(studio(design).elements.find((b) => b.element === "shorten-api")?.settings).toEqual({
      kind: "billing",
      execution: "docker",
      exposure: "internal",
      language: "typescript",
      provider: "stripe",
    });
  });

  it("refuses a language outside the kind's pair, and any language on a gateway", () => {
    const refusal = (settings: unknown) => {
      const parsed = studioSettingsSchema.safeParse(settings);
      return parsed.success ? undefined : parsed.error.issues[0]?.message;
    };
    for (const language of ["csharp", "python", "unspecified"])
      expect(refusal({ ...createStudioSettings("billing"), language })).toBe(
        "Choose TypeScript or Go; this kind offers no other language.",
      );
    expect(refusal({ ...createStudioSettings("redirect"), language: "rust" })).toBe(
      "Choose Go or TypeScript; this kind offers no other language.",
    );
    expect(refusal({ ...createStudioSettings("gateway"), language: "go" })).toBeDefined();
    expect(refusal({ ...createStudioSettings("billing"), language: "go" })).toBeUndefined();
    // Commands parse strictly: an edit with another language is refused, not normalised.
    expect(() =>
      buildStudioCommand(tinyurl(), {
        type: "edit",
        element: "shorten-api",
        settings: { ...createStudioSettings("service"), language: "csharp" },
      } as unknown as StudioCommand),
    ).toThrow(/this kind offers no other language/);
  });

  it("reads a stored language outside the pair as the kind's default", () => {
    const stored = JSON.parse(JSON.stringify(tinyurl()));
    const setting = (id: string) =>
      stored.architecture.studio.elements.find((b: { element: string }) => b.element === id)
        .settings;
    setting("shorten-api").language = "csharp";
    setting("redirect").language = "unspecified";
    setting("analytics").language = "go";
    const settings = (design: DesignDocument, id: string) =>
      studio(design).elements.find((b) => b.element === id)?.settings;
    const design = designSchema.parse(stored);
    expect(settings(design, "shorten-api")).toMatchObject({ language: "typescript" });
    expect(settings(design, "redirect")).toMatchObject({ language: "go" });
    expect(settings(design, "analytics")).toMatchObject({ language: "go" });

    const gateway = JSON.parse(JSON.stringify(tinyurl()));
    const binding = gateway.architecture.studio.elements.find(
      (b: { element: string }) => b.element === "shorten-api",
    );
    binding.definition.id = "studio-gateway";
    binding.settings = { ...createStudioSettings("gateway"), language: "unspecified" };
    expect(settings(designSchema.parse(gateway), "shorten-api")).not.toHaveProperty("language");
  });
});

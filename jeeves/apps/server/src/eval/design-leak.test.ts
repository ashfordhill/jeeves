/**
 * The leak check (V3-19): chat must never be handed a design's names. Nothing it reads (the
 * system prompt, the tool definitions, the patterns' defaults, any tool's output, the caller
 * context) may contain a tile, module, action or system name from YouTube v3, v2 or the studies
 * unless the case itself supplied it: its own brief or seed, or the model's own arguments.
 * The studio's own catalogs are its vocabulary, not a design's, so their words don't count: kind,
 * module kind, template and lane-action names, the reviewed guidance records' role names, and the
 * operation and readiness-profile catalogs (TinyURL's Create link and Resolve link operations and
 * its create/resolve profile are catalog entries). Names are matched case-sensitively, as names:
 * "an upload service" or "shorten a line" is prose, "Upload service" a name.
 */
import {
  createFakeProvider,
  type ModelItem,
  type ModelProvider,
  type ModelRequest,
} from "@jeeves/providers";
import {
  contractRecords,
  type DesignDocument,
  emptyDesign,
  modulePatternIds,
  moduleTemplateNames,
  studioActionDefaults,
  studioArchitectureExample,
  studioArchitectureExamples,
  studioComponentDefinitions,
  studioDefinitions,
  studioKindLabel,
  studioPatterns,
  tinyurlDesignScope,
  validateDesign,
} from "@jeeves/spec";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { v2ModuleDesign } from "../../../../packages/spec/src/fixtures/v2-modules.ts";
import { v3ModuleDesign } from "../../../../packages/spec/src/fixtures/v3-modules.ts";
import { INSTRUCTIONS, toolDefinitions, turnContext, Workspace } from "../chat/tools.ts";
import { installedGenerationSupport } from "../generation/support.ts";
import { openTestDb } from "../test-support.ts";
import { type DesignCase, designCases } from "./design-cases.ts";
import { runDesignCase } from "./design-harness.ts";
import { scriptedArms, scriptedProvider } from "./design-scripts.ts";

const installed = installedGenerationSupport();
const lower = (text: string) => text.trim().toLowerCase();

/** The studio's own words: what the catalogs call kinds, modules, templates and lane actions. */
const vocabulary = new Set(
  [
    ...Object.values(studioDefinitions).map((item) => item.name),
    ...Object.values(studioDefinitions).map((item) => studioKindLabel(item.defaults as never)),
    ...Object.values(studioComponentDefinitions).map((item) => item.name),
    ...Object.values(moduleTemplateNames),
    ...Object.values(studioActionDefaults),
    ...Object.values(studioPatterns).flatMap((item) => item.roles.map((role) => role.id)),
    ...contractRecords.flatMap((item) => {
      const name = item.definition.name.replace(/ · v\d+$/, "");
      return [name, name.split(" ")[0] ?? ""];
    }),
    ...(tinyurlDesignScope().profile?.id.split(/[-@]/) ?? []),
  ].map(lower),
);

/** Every name a design of v3, v2 or a study gives: its tiles, modules, actions and system. */
function designNames(design: DesignDocument): string[] {
  const studio = design.architecture?.studio;
  return [
    design.architecture?.system.name ?? "",
    ...design.elements.map((item) => item.name),
    ...(studio?.components ?? []).map((item) => item.name),
    ...(studio?.actions ?? []).map((item) => item.name),
  ];
}
const studies = studioArchitectureExamples.map((item) => studioArchitectureExample(item.id).design);
const forbidden = [
  ...new Set(
    ["YouTube", ...[v3ModuleDesign(installed), v2ModuleDesign(), ...studies].flatMap(designNames)]
      .map((name) => name.trim())
      .filter((name) => name.length > 2 && !vocabulary.has(lower(name))),
  ),
].sort();

const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pattern = (name: string) => new RegExp(`(?<![A-Za-z0-9])${literal(name)}(?![A-Za-z0-9])`);
/** The forbidden names `text` holds, less those `supplied` holds. */
function leaks(text: string, supplied: string): string[] {
  return forbidden.filter((name) => pattern(name).test(text) && !pattern(name).test(supplied));
}
/** What a case gives chat itself: its prompt and every name in its seed. */
const suppliedBy = (test: DesignCase) => [test.prompt, ...designNames(test.seed())].join("\n");

describe("the leak check (V3-19)", () => {
  it("knows the names it looks for", () => {
    expect(forbidden).toEqual(
      expect.arrayContaining(["YouTube", "Watch API", "Hot metadata", "Upload API", "Transcoder"]),
    );
    // The studio's own words are not design names.
    for (const word of ["Sign-in", "Favorites", "Multipart uploads", "Consume", "Database"])
      expect(forbidden).not.toContain(word);
  });

  it("finds no design name in the system prompt, the tools or the patterns' defaults", () => {
    expect(leaks(INSTRUCTIONS, "")).toEqual([]);
    expect(leaks(JSON.stringify(toolDefinitions()), "")).toEqual([]);
    // Each pattern applied with only what it needs: everything it adds is named by its defaults.
    const needs: Record<string, Record<string, unknown>> = {
      search: { events: "Stream" },
      "sign-in": { tile: "Portal" },
    };
    for (const id of modulePatternIds) {
      const workspace = new Workspace(emptyDesign());
      if (id === "search")
        workspace.run(
          "applyPattern",
          JSON.stringify({ pattern: { id: "upload-pipeline", publication: "Stream" } }),
        );
      const output = workspace.run(
        "applyPattern",
        JSON.stringify({ preview: true, pattern: { id, ...needs[id] } }),
      );
      expect(JSON.parse(output).ok, `${id}: ${output.slice(0, 300)}`).toBe(true);
      expect([id, leaks(output, "Stream Portal")]).toEqual([id, []]);
    }
  });

  it("finds none in what chat reads about each case's seed", () => {
    for (const test of designCases) {
      const seed = test.seed();
      const workspace = new Workspace(seed);
      const reads = [
        turnContext(seed, validateDesign(seed), []),
        ...["listStudioDefinitions", "listStudioPatterns", "getDesign", "reviewDesign"].map(
          (tool) => workspace.run(tool, "{}"),
        ),
        ...Object.keys(studioPatterns).map((id) =>
          workspace.run("describeStudioPattern", JSON.stringify({ id })),
        ),
      ];
      expect([test.id, leaks(reads.join("\n"), suppliedBy(test))]).toEqual([test.id, []]);
    }
  });

  describe("in every tool output of a scripted run", () => {
    let database: Awaited<ReturnType<typeof openTestDb>>;
    const fetch = vi.spyOn(globalThis, "fetch");
    beforeAll(async () => {
      fetch.mockRejectedValue(new Error("Offline leak check must never use a network"));
      database = await openTestDb();
    });
    afterAll(async () => {
      fetch.mockRestore();
      await database.close();
    });

    it("finds none that neither the case nor the model's own arguments supplied", async () => {
      for (const arm of scriptedArms)
        for (const test of designCases) {
          const requests: ModelRequest[] = [];
          const inner = scriptedProvider(test, arm);
          const observed: ModelProvider = {
            ...createFakeProvider([]),
            async respond(request, options) {
              requests.push(structuredClone(request));
              return inner.respond(request, options);
            },
          };
          await runDesignCase(database.db, test, observed, `scripted-${arm}`, installed);
          const items = requests.flatMap((request) => request.items);
          const text = (kind: ModelItem["type"]) =>
            items
              .filter((item) => item.type === kind)
              .map((item) =>
                item.type === "tool-result"
                  ? item.output
                  : item.type === "tool-call"
                    ? item.arguments
                    : item.type === "message"
                      ? item.content.map((part) => (part.type === "text" ? part.text : "")).join("")
                      : "",
              )
              .join("\n");
          const supplied = [suppliedBy(test), text("tool-call"), text("message")].join("\n");
          expect([arm, test.id, leaks(text("tool-result"), supplied)]).toEqual([arm, test.id, []]);
        }
    }, 120_000);
  });
});

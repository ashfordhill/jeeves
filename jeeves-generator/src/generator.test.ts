import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assembleExperimental,
  canonicalJson,
  type ExperimentalInput,
  type ExperimentalTemplate,
  GeneratorRefusal,
  planFileWrites,
  sha256,
  validateExperimentalInput,
  youtubeLocalProfile,
} from "./index.ts";
import { atPointer, type Json } from "./json.ts";

const fixtureDir = new URL("../../field-projects/youtube/v1/inputs/", import.meta.url);
function fixture(): ExperimentalInput {
  return {
    profileId: "youtube-local-v1",
    artifacts: Object.fromEntries(
      Object.keys(youtubeLocalProfile.artifacts).map((name) => [
        name,
        readFileSync(new URL(name, fixtureDir), "utf8"),
      ]),
    ) as ExperimentalInput["artifacts"],
  };
}
const diagnostic: ExperimentalTemplate = {
  id: "local.project",
  version: "0.0.1-diagnostic",
  sourceSha256: sha256("diagnostic test renderer v1"),
  render: ({ input }) => ({
    files: [
      {
        path: "diagnostic.json",
        content: `${canonicalJson({ source: input.profile.sourceCanonicalSha256, settings: input.bindings.elements[0]?.requiredSettings })}\n`,
        ownership: "generated-scaffold",
        sourcePaths: ["/architecture/studio/elements/0"],
      },
    ],
    settings: [
      {
        artifact: "design.json",
        sourcePath: "/architecture/studio/elements/0/settings/requestTimeoutMs",
        status: "configuration-only",
        outputPaths: ["diagnostic.json"],
        note: "Recorded diagnostic intent only; no HTTP server is emitted.",
      },
    ],
  }),
};
const signatures = (input: ReturnType<typeof assembleExperimental>) =>
  input.files.map((file) => ({ path: file.path, hash: sha256(file.bytes) }));
function edit(
  input: ExperimentalInput,
  artifact: "design.json" | "blueprint.json" | "local-bindings.json" | "runtime-pins.json",
  path: string,
  replacement: Json,
) {
  const value: unknown = JSON.parse(input.artifacts[artifact]);
  const parts = path.split("/");
  const key = parts.pop();
  if (!key) throw new Error("Expected a child path");
  const parent = atPointer(value, parts.join("/")) as Record<string, unknown>;
  parent[key] = replacement;
  input.artifacts[artifact] = JSON.stringify(value);
}
function refusal(run: () => unknown, code: string, path?: string) {
  try {
    run();
    expect.fail("Expected generator refusal");
  } catch (error) {
    expect(error).toBeInstanceOf(GeneratorRefusal);
    expect(error).toMatchObject({ code, ...(path ? { path } : {}) });
  }
}

describe("finite experimental assembly boundary", () => {
  it("validates frozen source/blueprint and emits an honest deterministic diagnostic bundle with no templates", () => {
    const input = fixture(),
      before = structuredClone(input);
    const first = assembleExperimental(input),
      second = assembleExperimental(input);
    expect(signatures(first)).toEqual(signatures(second));
    expect(input).toEqual(before);
    expect(first.manifest.generator.version).toBe("0.1.0-experimental.1");
    expect(first.manifest.profile.baselineCommit).toBe("acbc716c90245aeb398391f30f7800f988294cb4");
    expect(first.manifest.templates).toEqual([]);
    expect(first.report.mappings).toHaveLength(38);
    expect(first.report.mappings.every((item) => item.availability === "unavailable")).toBe(true);
    expect(first.report.connections).toHaveLength(18);
    expect(first.report.settings.filter((item) => item.status === "unsupported")).toHaveLength(25);
    expect(
      first.report.settings.every(
        (item) => item.sourcePath.startsWith("/") && item.note.length > 0,
      ),
    ).toBe(true);
    expect(
      first.report.settings.find(
        (item) => item.sourcePath === "/architecture/studio/elements/10/settings/language",
      ),
    ).toMatchObject({ status: "unsupported", value: "typescript" });
    expect(
      first.report.settings.find(
        (item) => item.sourcePath === "/architecture/studio/components/0/settings/stampede",
      ),
    ).toMatchObject({ status: "unimplemented", value: "single-flight" });
    expect(
      first.report.settings.find((item) => item.sourcePath === "/localConfig/secrets"),
    ).toMatchObject({ artifact: "local-bindings.json", status: "unimplemented" });
    expect(first.report.extensionTasks).toHaveLength(7);
    expect(first.report.gaps.map((gap) => gap.id)).toEqual([
      "G01",
      "G02",
      "G03",
      "G04",
      "G05",
      "G06",
      "G07",
      "G08",
    ]);
    expect(first.report.scenarios.every((item) => item.status === "not-run")).toBe(true);
    expect(first.report.strictReadiness).toEqual(
      JSON.parse(input.artifacts["blueprint.json"]).readiness,
    );
    expect(first.report.strictReadiness.generationEligible).toBe(false);
    expect(first.manifest.diagram.included).toBe(false);
    expect(
      first.manifest.files.every((record) => {
        const file = first.files.find((file) => file.path === record.path);
        return !!file && sha256(file.bytes) === record.sha256 && file.bytes.length === record.bytes;
      }),
    ).toBe(true);
    expect(first.files.map((file) => file.path)).toEqual(
      [...first.files.map((file) => file.path)].sort(),
    );
    expect(first.files.every((file) => file.path.startsWith(".jeeves/"))).toBe(true);
  });

  it("assembles trusted shared project output once, hashes its ownership and accounts for settings without granting runtime evidence", () => {
    const first = assembleExperimental(fixture(), [diagnostic]);
    expect(signatures(first)).toEqual(signatures(assembleExperimental(fixture(), [diagnostic])));
    expect(first.manifest.files.find((file) => file.path === "diagnostic.json")).toMatchObject({
      ownership: "generated-scaffold",
      sourcePaths: ["/architecture/studio/elements/0"],
      template: {
        id: "local.project",
        version: diagnostic.version,
        sourceSha256: diagnostic.sourceSha256,
      },
    });
    expect(
      first.report.settings.find((item) =>
        item.sourcePath.endsWith("/0/settings/requestTimeoutMs"),
      ),
    ).toMatchObject({ status: "configuration-only", outputPaths: ["diagnostic.json"] });
    expect(first.report.runtimeVerification).toBe("none");
    expect(first.report.strictTemplateAvailability).toBe("none");
    expect(first.report.applicationComplete).toBe(false);
  });

  it("includes only the real hash-checked optional source-linked image", () => {
    const input = fixture();
    input.diagramPng = readFileSync(
      new URL("../diagrams/005-local-intent-aligned/diagram.png", fixtureDir),
    );
    const bundle = assembleExperimental(input);
    expect(bundle.manifest.diagram.included).toBe(true);
    expect(bundle.manifest.files.find((file) => file.path.endsWith("/diagram.png"))?.sha256).toBe(
      youtubeLocalProfile.diagram.sha256,
    );
    const mutated = assembleExperimental(input, [
      {
        ...diagnostic,
        render: ({ input: context }) => {
          context.diagramPng?.fill(0);
          return { files: [] };
        },
      },
    ]);
    const archived = mutated.files.find((file) => file.path.endsWith("/diagram.png"));
    expect(archived && sha256(archived.bytes)).toBe(youtubeLocalProfile.diagram.sha256);
    expect(sha256(input.diagramPng)).toBe(youtubeLocalProfile.diagram.sha256);
    input.diagramPng = new Uint8Array([1, 2, 3]);
    refusal(() => assembleExperimental(input), "INPUT_HASH_MISMATCH", "diagram.png");
  });

  it("refuses unsupported profiles, malformed sources and stale/altered blueprints", () => {
    refusal(
      () => assembleExperimental({ ...fixture(), profileId: "tinyurl" }),
      "UNSUPPORTED_PROFILE",
      "/profileId",
    );
    const invalid = fixture();
    invalid.artifacts["design.json"] = "{";
    refusal(() => assembleExperimental(invalid), "INVALID_JSON", "design.json");
    const schema = fixture();
    edit(schema, "design.json", "/architecture/studio/elements/0/settings/surprise", true);
    refusal(() => assembleExperimental(schema), "INVALID_STRUCTURE", "design.json");
    const dangling = fixture();
    edit(dangling, "design.json", "/connections/0/to/element", "missing");
    refusal(() => assembleExperimental(dangling), "INVALID_DESIGN", "design.json");
    const stale = fixture();
    edit(stale, "blueprint.json", "/services/0/name", "Stale name");
    refusal(() => assembleExperimental(stale), "CONTRADICTORY_MAPPING", "blueprint.json");
  });

  it("refuses altered selectors, settings, owners, hosts, links, connections, unsupported paths and floated pins", () => {
    const cases: [string, string, Json][] = [
      ["bindings/elements", "/elements/0/elementId", "unknown"],
      ["/architecture/studio/elements/0", "/elements/0/requiredSettings/requestTimeoutMs", 7],
      ["/architecture/studio/elements/2", "/elements/2/owner/id", "upload"],
      ["/architecture/studio/components/0", "/components/0/hostId", "upload"],
      ["/architecture/studio/components/0/links", "/components/0/links", []],
      ["/connections/0", "/connections/0/toId", "view-counts"],
    ];
    for (const [errorPath, path, replacement] of cases) {
      const input = fixture();
      edit(input, "local-bindings.json", path, replacement);
      refusal(() => assembleExperimental(input), "CONTRADICTORY_MAPPING", errorPath);
    }
    const duplicate = fixture();
    edit(duplicate, "local-bindings.json", "/elements/1/elementId", "watch");
    refusal(() => assembleExperimental(duplicate), "DUPLICATE_MAPPING", "bindings/elements");
    const unknown = fixture();
    edit(unknown, "local-bindings.json", "/elements/0/proposedTemplateId", "magic-handler");
    refusal(() => assembleExperimental(unknown), "INVALID_STRUCTURE", "local-bindings.json");
    const path = fixture();
    edit(path, "local-bindings.json", "/explicitUnsupportedIntent/0/sourcePath", "/missing");
    refusal(() => assembleExperimental(path), "INVALID_SOURCE_PATH", "/missing");
    const pin = fixture();
    edit(pin, "runtime-pins.json", "/toolchain/node", "latest");
    refusal(() => assembleExperimental(pin), "INPUT_HASH_MISMATCH", "runtime-pins.json");
    const bytes = fixture();
    bytes.artifacts["design.json"] += "\n";
    refusal(() => validateExperimentalInput(bytes), "INPUT_HASH_MISMATCH", "design.json");
  });

  it("refuses unsafe, colliding or reserved template paths, and unknown/duplicate template identities", () => {
    function paths(names: string[]): ExperimentalTemplate {
      return {
        ...diagnostic,
        render: () => ({
          files: names.map((path) => ({
            path,
            content: "diagnostic\n",
            ownership: "generated-scaffold",
            sourcePaths: [],
          })),
        }),
      };
    }
    for (const path of [
      "../escape",
      "/absolute",
      "C:/drive",
      "a\\b",
      "a//b",
      "a/./b",
      "a/../b",
      "a/CON.txt",
      "a/.git/config",
      "a/trailing.",
      "",
    ])
      refusal(() => assembleExperimental(fixture(), [paths([path])]), "UNSAFE_OUTPUT_PATH");
    for (const pair of [
      ["same", "same"],
      ["Case", "case"],
      ["file", "file/child"],
    ])
      refusal(() => assembleExperimental(fixture(), [paths(pair)]), "OUTPUT_COLLISION");
    refusal(
      () => assembleExperimental(fixture(), [paths([".jeeves/report.json"])]),
      "RESERVED_OUTPUT_PATH",
    );
    refusal(() => assembleExperimental(fixture(), [diagnostic, diagnostic]), "DUPLICATE_TEMPLATE");
    refusal(
      () => assembleExperimental(fixture(), [{ ...diagnostic, version: "latest" }]),
      "UNRECOGNIZED_TEMPLATE",
    );
  });

  it("rejects untraceable setting credit or attempts to erase frozen overrides", () => {
    for (const decision of [
      {
        artifact: "design.json" as const,
        sourcePath: "/missing",
        status: "emitted" as const,
        note: "invalid",
      },
      {
        artifact: "design.json" as const,
        sourcePath: "/architecture/studio/elements/10/settings/language",
        status: "custom" as const,
        note: "Cannot erase explicit override",
      },
      {
        artifact: "design.json" as const,
        sourcePath: "/architecture/studio/elements/0/settings/requestTimeoutMs",
        status: "emitted" as const,
        outputPaths: ["missing-file"],
        note: "No actual output",
      },
    ])
      refusal(
        () =>
          assembleExperimental(fixture(), [
            { ...diagnostic, render: () => ({ files: [], settings: [decision] }) },
          ]),
        "INVALID_SETTING_DECISION",
      );
  });

  it("plans new files without overwriting existing edits or deleting custom files", () => {
    const bundle = assembleExperimental(fixture(), [diagnostic]);
    expect(planFileWrites(bundle.files).create).toHaveLength(bundle.files.length);
    const custom = { path: "custom/manual.ts", bytes: new TextEncoder().encode("human work\n") };
    const existing = [
      ...bundle.files.map((file) => ({ ...file, bytes: new Uint8Array(file.bytes) })),
      custom,
    ];
    expect(planFileWrites(bundle.files, existing)).toMatchObject({
      create: [],
      unchanged: bundle.files.map((file) => file.path),
    });
    const edited = existing.find((file) => file.path === "diagnostic.json");
    if (!edited) throw new Error("Missing diagnostic");
    edited.bytes = new TextEncoder().encode("edited by a developer\n");
    const before = structuredClone(existing);
    refusal(
      () => planFileWrites(bundle.files, existing),
      "EXISTING_OUTPUT_CHANGED",
      "diagnostic.json",
    );
    expect(existing).toEqual(before);
    expect(existing.at(-1)).toEqual(custom);
    refusal(
      () =>
        planFileWrites(
          [{ path: "dir/child", bytes: new Uint8Array() }],
          [{ path: "dir", bytes: new Uint8Array() }],
        ),
      "OUTPUT_COLLISION",
    );
  });
});

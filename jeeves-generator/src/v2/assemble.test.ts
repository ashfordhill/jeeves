import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { designSchema, generationTemplates } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import {
  generationSelectionsFixture,
  generationSourceFixture,
} from "../../../jeeves/packages/spec/src/fixtures/yv2-selections.ts";
import { localV1Templates } from "../../templates/local-v1/index.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleExperimental } from "../assemble.ts";
import { exportNewDirectory } from "../export.ts";
import { planFileWrites } from "../files.ts";
import { GeneratorRefusal, sha256 } from "../json.ts";
import { loadYoutubeLocalInput } from "../local.ts";
import { assembleV2 } from "./assemble.ts";
import { captureV2Sources, createV2Registry, type V2Emitter, type V2Source } from "./registry.ts";

const source = () =>
  designSchema.parse({ ...generationSourceFixture(), generation: generationSelectionsFixture() });
const input = () => ({ designJson: JSON.stringify(source()) });
const signature = (bundle: ReturnType<typeof assembleV2>) =>
  bundle.files.map((file) => [file.path, sha256(file.bytes)]);
// Test-only emitters. Attestations below deliberately exercise rejected/missing ownership;
// they are never installed in the production local registry or credited as real features.
const diagnostic = (): V2Emitter => ({
  id: "test.diagnostic",
  version: "0.1.0",
  status: "diagnostic",
  description: "Test diagnostic bytes only.",
  sourcePaths: ["diagnostic.ts", "message.txt"],
  render: ({ asset }) => ({
    files: [
      {
        path: "diagnostics/message.txt",
        content: asset("message.txt"),
        ownership: "generated-scaffold",
        sourcePaths: ["/generation"],
      },
    ],
  }),
});
const sources = (): V2Source[] => [
  { path: "diagnostic.ts", bytes: readFileSync(new URL("./assemble.test.ts", import.meta.url)) },
  { path: "message.txt", bytes: new TextEncoder().encode("diagnostic asset v1\n") },
];

describe("isolated versioned v2 assembly", () => {
  it("emits deterministic source-linked diagnostics while keeping every unimplemented selection explicit", () => {
    const registry = loadLocalV2Registry(),
      saved = input();
    const first = assembleV2(saved, registry);
    expect(signature(first)).toEqual(signature(assembleV2(saved, registry)));
    expect(first.report).toMatchObject({
      applicationComplete: false,
      semanticComplete: false,
      runtimeVerification: "none",
      strictReadiness: "not-assessed",
    });
    expect(registry.installed).toMatchObject({
      runtime: { id: "local-runtime" },
      presets: [],
      templates: [],
    });
    expect(first.report.selections).toHaveLength(10);
    expect(first.report.selections.every((selection) => selection.status === "unfinished")).toBe(
      true,
    );
    expect(
      first.report.settings.every(
        (setting) =>
          setting.implementationStatus === "unfinished" ||
          setting.implementationStatus === "unsupported",
      ),
    ).toBe(true);
    expect(first.report.settings.every((setting) => !setting.normalControl)).toBe(true);
    expect(first.report.localAdapterTreatments[0]).toMatchObject({
      actual: "keycloak",
      classification: "unsupported-intent",
    });
    expect(first.report.gaps[0]).toMatchObject({ required: true, status: "unfinished" });
    for (const record of first.manifest.files) {
      const emitted = first.files.find((file) => file.path === record.path);
      expect(emitted && sha256(emitted.bytes)).toBe(record.sha256);
      expect(emitted?.bytes.length).toBe(record.bytes);
    }
    expect(
      first.manifest.files.find((file) => file.path === "diagnostics/generation.json"),
    ).toMatchObject({
      owner: { id: "local.diagnostic", sourceSha256: expect.stringMatching(/^[a-f0-9]{64}$/u) },
      sourcePaths: ["/generation"],
    });
    const renamed = source();
    for (const element of renamed.elements) element.name = "Unrelated human label";
    const changed = assembleV2({ designJson: JSON.stringify(renamed, null, 2) }, registry);
    expect(changed.manifest.input.sourceSha256).not.toBe(first.manifest.input.sourceSha256);
    expect(changed.manifest.input.normalizedInputSha256).toBe(
      first.manifest.input.normalizedInputSha256,
    );
    const unknown = source();
    if (unknown.schemaVersion !== 3 || !unknown.generation?.selections[0]) throw new Error();
    unknown.generation.selections[0].template.sha256 = "f".repeat(64);
    const unsupported = assembleV2({ designJson: JSON.stringify(unknown) }, registry);
    expect(unsupported.report.selections[0]?.status).toBe("unsupported");
    expect(unsupported.manifest.templates[0]?.ref.sha256).toBe("f".repeat(64));
  });

  it("fingerprints actual edited asset bytes separately from descriptors and keeps captured bytes immutable", async () => {
    const scratch = await mkdtemp(join(tmpdir(), "jeeves-v2-assets-"));
    try {
      for (const file of sources()) await writeFile(join(scratch, file.path), file.bytes);
      const root = pathToFileURL(`${scratch}/`);
      const capture = () =>
        createV2Registry(captureV2Sources(root, ["diagnostic.ts", "message.txt"]), [diagnostic()]);
      const registry = capture(),
        saved = input(),
        before = assembleV2(saved, registry);
      await writeFile(join(scratch, "message.txt"), "actual edited asset\n");
      expect(signature(assembleV2(saved, registry))).toEqual(signature(before));
      const replacement = capture(),
        after = assembleV2(saved, replacement);
      expect(registry.sha256).not.toBe(replacement.sha256);
      expect(registry.emitters[0]?.identity.sourceSha256).not.toBe(
        replacement.emitters[0]?.identity.sourceSha256,
      );
      expect(before.manifest.templates).toEqual(after.manifest.templates);
      expect(before.manifest.input.normalizedInputSha256).toBe(
        after.manifest.input.normalizedInputSha256,
      );
      expect(signature(before)).not.toEqual(signature(after));
      const returnedAsset = registry.asset("message.txt");
      returnedAsset.fill(0);
      expect(signature(assembleV2(saved, registry))).toEqual(signature(before));
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  });

  it("requires real consumer files and one explicit owner for composed output; incomplete support stays partial", () => {
    const template = generationTemplates["positive-cache-read"].ref;
    const consumer: V2Emitter = {
      ...diagnostic(),
      id: "test.consumer",
      status: "implemented",
      description: "Test-only incomplete attestation to probe file responsibility.",
      provides: {
        templates: [
          {
            ref: template,
            consumers: [
              {
                input: "binding",
                consumer: "positive-cache-read",
                outputPaths: ["diagnostics/message.txt"],
              },
            ],
          },
        ],
      },
      render: () => ({ files: [] }),
    };
    const assemble = (emitters: V2Emitter[]) =>
      assembleV2(input(), createV2Registry(sources(), emitters));
    expect(() => assemble([consumer])).toThrowError(
      expect.objectContaining({ code: "MISSING_CONSUMER_OUTPUT" }),
    );
    expect(() => assemble([diagnostic(), consumer])).toThrowError(
      expect.objectContaining({ code: "MISSING_CONSUMER_OUTPUT" }),
    );
    const writer: V2Emitter = {
      ...diagnostic(),
      render: (context) => ({
        files: diagnostic()
          .render(context)
          .files.map((file) => ({
            ...file,
            contributors: [{ emitter: consumer.id, sourcePaths: ["/generation/selections/3"] }],
          })),
      }),
    };
    const shared = assemble([writer, consumer]);
    expect(
      shared.manifest.files.find((file) => file.path === "diagnostics/message.txt"),
    ).toMatchObject({
      owner: { id: writer.id },
      contributors: [{ emitter: { id: consumer.id }, sourcePaths: ["/generation/selections/3"] }],
    });
    expect(shared.report.applicationComplete).toBe(false);
    expect(
      shared.report.selections.find((selection) => selection.template.id === template.id)?.status,
    ).toBe("unfinished");
    expect(
      shared.report.findings.some((finding) =>
        finding.message.includes("no actual output consumer"),
      ),
    ).toBe(true);
    expect(() => createV2Registry(sources(), [{ ...consumer, status: "partial" }])).toThrowError(
      expect.objectContaining({ code: "INVALID_REGISTRY" }),
    );
    expect(() =>
      assemble([writer, { ...consumer, render: (context) => diagnostic().render(context) }]),
    ).toThrowError(expect.objectContaining({ code: "OUTPUT_COLLISION" }));
  });

  it("rejects unsafe/untraceable output and preserves edited destinations and custom work", async () => {
    const defaulted = source();
    const planned = defaulted.connections[0]?.planned;
    if (!planned) throw new Error();
    Reflect.deleteProperty(planned, "protocol"); // designSchema supplies HTTPS, but the raw source has no declaration.
    expect(() =>
      assembleV2(
        { designJson: JSON.stringify(defaulted) },
        createV2Registry(sources(), [
          {
            ...diagnostic(),
            render: () => ({
              files: [
                {
                  path: "diagnostics/default.json",
                  content: "invalid provenance",
                  ownership: "generated-scaffold",
                  sourcePaths: ["/connections/0/planned/protocol"],
                },
              ],
            }),
          },
        ]),
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_SOURCE_PATH" }));
    for (const path of ["../escape", ".jeeves/report.json", "a/CON.txt"])
      expect(() =>
        assembleV2(
          input(),
          createV2Registry(sources(), [
            {
              ...diagnostic(),
              render: () => ({
                files: [
                  { path, content: "invalid", ownership: "generated-scaffold", sourcePaths: [] },
                ],
              }),
            },
          ]),
        ),
      ).toThrow(GeneratorRefusal);
    expect(() =>
      assembleV2(
        input(),
        createV2Registry(sources(), [
          {
            ...diagnostic(),
            render: () => ({
              files: [
                {
                  path: "diagnostics/fake.json",
                  content: "invalid",
                  ownership: "generated-scaffold",
                  sourcePaths: ["/generation/missing"],
                },
              ],
            }),
          },
        ]),
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_SOURCE_PATH" }));
    const bundle = assembleV2(input(), createV2Registry(sources(), [diagnostic()]));
    const scratch = await mkdtemp(join(tmpdir(), "jeeves-v2-export-"));
    try {
      const destination = join(scratch, "new");
      await exportNewDirectory(bundle.files, destination);
      await writeFile(join(destination, "diagnostics/message.txt"), "owner edit\n");
      await writeFile(join(destination, "custom.txt"), "custom preserved\n");
      await expect(exportNewDirectory(bundle.files, destination)).rejects.toMatchObject({
        code: "EEXIST",
      });
      const existing = bundle.files.map((file) => ({ ...file, bytes: new Uint8Array(file.bytes) }));
      existing.push({ path: "custom.txt", bytes: new TextEncoder().encode("custom preserved\n") });
      expect(planFileWrites(bundle.files, existing).unchanged).toHaveLength(bundle.files.length);
      const edited = existing.find((file) => file.path === "diagnostics/message.txt");
      if (!edited) throw new Error();
      edited.bytes = new TextEncoder().encode("owner edit\n");
      expect(() => planFileWrites(bundle.files, existing)).toThrowError(
        expect.objectContaining({ code: "EXISTING_OUTPUT_CHANGED" }),
      );
      expect(await readFile(join(destination, "diagnostics/message.txt"), "utf8")).toBe(
        "owner edit\n",
      );
      expect(await readFile(join(destination, "custom.txt"), "utf8")).toBe("custom preserved\n");
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  });

  it("retains the frozen v1 output including its exact manifest", () => {
    const bundle = assembleExperimental(loadYoutubeLocalInput(), localV1Templates);
    expect(bundle.files).toHaveLength(108);
    const manifest = bundle.files.find((file) => file.path === ".jeeves/manifest.json");
    expect(manifest && sha256(manifest.bytes)).toBe(
      "5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f",
    );
  });
});

import { describe, expect, it } from "vitest";
import { designSchema } from "./design.ts";
import { isStructural } from "./findings.ts";
import { generationSelectionsFixture, generationSourceFixture } from "./fixtures/yv2-selections.ts";
import {
  generationPolicies,
  generationPresets,
  generationRuntime,
  generationTemplates,
} from "./generation-catalog.ts";
import { generationLocalIdentity, resolveGeneration } from "./generation-resolver.ts";
import { type GenerationInstalledSupport, generationCapabilities } from "./generation-support.ts";

const source = () =>
  designSchema.parse({ ...generationSourceFixture(), generation: generationSelectionsFixture() });
// Trusted test host: attests real consumer paths to test semantic availability, without installing
// runtime code in the product. Production default remains empty until later template units.
const installed = (): GenerationInstalledSupport => ({
  runtime: generationRuntime.ref,
  presets: [generationPresets.youtube.ref],
  templates: Object.entries(generationCapabilities).map(([kind, capability]) => ({
    ref: capability.template,
    consumers: [
      { input: "binding", consumer: kind, outputPaths: [`src/features/${kind}.ts`] },
      ...generationTemplates[kind as keyof typeof generationTemplates].definition.policies.map(
        (ref) => ({
          input: `policy.${ref.id}`,
          consumer: kind,
          outputPaths: [`src/features/${kind}.ts`],
        }),
      ),
      ...capability.settings.map((setting) => ({
        input: setting.input,
        consumer: setting.consumer,
        outputPaths: [`src/features/${kind}.ts`],
      })),
    ],
  })),
});
const localSource = () => {
  const design = source();
  for (const connection of design.connections) {
    if (connection.planned.protocol === "HTTPS") connection.planned.protocol = "HTTP";
    connection.planned.security = "Private network";
  }
  return design;
};
const binding = (design: ReturnType<typeof source>, id: string) => {
  if (design.schemaVersion !== 3) throw new Error();
  const selection = design.generation?.selections.find((entry) => entry.id === id);
  if (!selection) throw new Error();
  return selection;
};

describe("generation semantic resolution and actual support", () => {
  it("normalizes native010 bindings, grants, single-authority settings and fixed policies without mutation", () => {
    const design = localSource(),
      original = structuredClone(design);
    const result = resolveGeneration(design, installed());
    expect(result.findings).toEqual([]);
    expect(result.complete).toBe(true);
    expect(design).toEqual(original);
    expect(
      result.settings.find(
        (entry) => entry.selection === "owned-upload" && entry.input === "jobs.batchSize",
      ),
    ).toMatchObject({
      value: 1,
      origin: "descriptor-default",
      sourcePaths: [],
      normalControl: false,
    });
    expect(Object.isFrozen(result.model?.selections[0]?.inputs)).toBe(true);
    const row = result.model?.selections.find((entry) => entry.id === "owned-upload");
    expect(row).toMatchObject({
      host: "upload",
      owner: "video",
      inputs: { "host.requestTimeoutMs": 5000, "state.poolSize": 10 },
      resources: expect.arrayContaining([
        expect.objectContaining({ field: "state", authority: "video", access: "read-write" }),
      ]),
      policies: [generationPolicies.ownedMultipart],
    });
    expect(result.model?.selections.find((entry) => entry.id === "lifecycle")).toMatchObject({
      host: "completion-handler",
      owner: "video",
      binding: { upload: "owned-upload" },
    });
    expect(
      result.model?.selections.find((entry) => entry.id === "hls")?.inputs["host.concurrency"],
    ).toBe(1);
    expect(
      result.settings.find(
        (entry) => entry.selection === "hls" && entry.input === "host.concurrency",
      )?.normalControl,
    ).toBe(false);
    expect(result.model?.localAdapterTreatments).toEqual([
      expect.objectContaining({
        declared: "typescript",
        actual: "keycloak",
        classification: "unsupported-intent",
        sourcePath: expect.arrayContaining(["language"]),
      }),
    ]);
    const cache = design.architecture?.studio?.elements.find(
      (entry) => entry.element === "metadata-cache",
    );
    const reader = design.architecture?.studio?.components?.find(
      (entry) => entry.id === "watch-cache-reader",
    );
    if (cache?.settings.kind !== "cache" || reader?.settings.kind !== "cache-reader")
      throw new Error();
    cache.settings.ttlSeconds = 7200;
    // An old duplicate must be corrected explicitly; reads never prefer/overwrite it silently.
    expect(resolveGeneration(design, installed()).model).toBeUndefined();
    reader.settings.l2TtlSeconds = 7200;
    const edited = resolveGeneration(design, installed());
    expect(edited.complete).toBe(true);
    expect(
      edited.model?.selections.find((entry) => entry.id === "ready-reader")?.inputs[
        "cache.ttlSeconds"
      ],
    ).toBe(7200);
    expect(edited.settings.find((entry) => entry.input === "cache.ttlSeconds")).toMatchObject({
      consumer: "positive-cache-reader.ttlSeconds",
      normalControl: true,
      sourcePaths: expect.any(Array),
      outputPaths: ["src/features/positive-cache-read.ts"],
    });
  });

  it("keeps catalog-only, unknown, unsupported local/provider/language and unconsumed intent explicit", () => {
    const design = source();
    const catalogOnly = resolveGeneration(design);
    expect(catalogOnly.complete).toBe(false);
    expect(catalogOnly.settings.every((entry) => !entry.normalControl)).toBe(true);
    expect(catalogOnly.findings).toContainEqual(
      expect.objectContaining({
        target: { path: ["connections", 6, "planned", "protocol"] },
        message: expect.stringContaining("supports HTTP"),
      }),
    );
    const host = design.architecture?.studio?.elements.find((entry) => entry.element === "upload");
    const cache = design.architecture?.studio?.elements.find(
      (entry) => entry.element === "metadata-cache",
    );
    if (host?.settings.kind !== "uploads" || cache?.settings.kind !== "cache") throw new Error();
    host.settings.language = "go";
    host.settings.transfer = "tus";
    cache.settings.provider = "upstash";
    const result = resolveGeneration(design, installed());
    expect(result.complete).toBe(false);
    expect(result.settings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input: "host.language",
          value: "go",
          status: "unsupported",
          normalControl: false,
        }),
        expect.objectContaining({ input: "host.transfer", value: "tus", status: "unsupported" }),
        expect.objectContaining({
          input: "cache.provider",
          value: "upstash",
          status: "unsupported",
        }),
      ]),
    );
    expect(host.settings.transfer).toBe("tus");
    const altered = localSource();
    const alteredHost = altered.architecture?.studio?.elements.find(
      (entry) => entry.element === "upload",
    );
    const identity = altered.architecture?.studio?.elements.find(
      (entry) => entry.element === "identity",
    );
    if (!alteredHost || identity?.settings.kind !== "identity") throw new Error();
    alteredHost.definition.version = "9.0.0";
    identity.settings.maxReplicas = 2;
    const alteredResult = resolveGeneration(altered, installed());
    expect(alteredResult.complete).toBe(false);
    expect(alteredResult.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("host has an unresolved studio definition"),
        }),
        expect.objectContaining({
          target: { path: ["architecture", "studio", "elements", 10, "settings", "maxReplicas"] },
        }),
      ]),
    );
    const missingConsumer = installed();
    const cacheTemplate = missingConsumer.templates.find(
      (entry) => entry.ref.id === "positive-cache-read",
    );
    if (!cacheTemplate) throw new Error();
    cacheTemplate.consumers = cacheTemplate.consumers.filter(
      (entry) => entry.input !== "cache.ttlSeconds",
    );
    expect(
      resolveGeneration(localSource(), missingConsumer).settings.find(
        (entry) => entry.input === "cache.ttlSeconds",
      )?.normalControl,
    ).toBe(false);
    const unknown = binding(design, "owned-upload");
    unknown.template.sha256 = "f".repeat(64);
    expect(
      resolveGeneration(design, installed()).model?.selections.some(
        (entry) => entry.id === "owned-upload",
      ),
    ).toBe(false);
  });

  it("refuses wrong endpoints, insufficient grants, cross-selection mismatches and extra binding permissions", () => {
    const wrongEndpoint = localSource();
    const upload = binding(wrongEndpoint, "owned-upload");
    if (upload.binding.kind !== "owned-multipart") throw new Error();
    upload.binding.state.connection = "handler-metadata";
    expect(resolveGeneration(wrongEndpoint, installed()).model).toBeUndefined();
    const missingGrant = localSource();
    if (missingGrant.schemaVersion !== 3 || !missingGrant.ownership) throw new Error();
    const grant = missingGrant.ownership.grants.find(
      (entry) => entry.role === "upload" && entry.resource === "metadata-db",
    );
    if (!grant) throw new Error();
    grant.access = "read";
    expect(resolveGeneration(missingGrant, installed()).findings.filter(isStructural)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("read-write") }),
      ]),
    );
    expect(resolveGeneration(missingGrant, installed()).model).toBeUndefined();
    const crossed = localSource();
    if (crossed.schemaVersion !== 3 || !crossed.generation) throw new Error();
    const originalUpload = binding(crossed, "owned-upload");
    // A second valid owned-upload on another same-authority API, and a lifecycle valid on its own,
    // must not let the YouTube adapter silently combine two different upload selections.
    const copy = structuredClone(originalUpload);
    copy.id = "other-upload";
    copy.target = { kind: "component", component: "upload-multipart", host: "upload" };
    crossed.generation.selections.push(copy);
    const lifecycle = binding(crossed, "lifecycle");
    if (lifecycle.binding.kind !== "asset-lifecycle") throw new Error();
    lifecycle.binding.upload = copy.id;
    expect(resolveGeneration(crossed, installed()).findings).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("chosen owned-upload") }),
    );
    expect(resolveGeneration(crossed, installed()).model).toBeUndefined();
    const wrongMode = localSource();
    const queue = wrongMode.architecture?.studio?.elements.find(
      (entry) => entry.element === "upload-queue",
    );
    if (queue?.settings.kind !== "queue") throw new Error();
    queue.settings.mode = "topic";
    expect(resolveGeneration(wrongMode, installed()).settings).toContainEqual(
      expect.objectContaining({ input: "jobs.mode", status: "unsupported" }),
    );
    expect(resolveGeneration(wrongMode, installed()).complete).toBe(false);
    const extra = localSource();
    Object.assign(binding(extra, "owned-upload").binding, {
      extraPermission: { resource: "view-counts", access: "read-write" },
    });
    expect(resolveGeneration(extra, installed())).toMatchObject({
      model: undefined,
      complete: false,
    });
  });

  it("ignores human labels and rejects unsafe or ambiguous identities/consumer paths", () => {
    const design = localSource(),
      baseline = resolveGeneration(design, installed());
    for (const element of design.elements) element.name = "Go cloud tus";
    expect(resolveGeneration(design, installed()).model).toEqual(baseline.model);
    expect(generationLocalIdentity("a-b")).toEqual({ local: "a-b", sql: "a_b" });
    expect(generationLocalIdentity(`a${"b".repeat(62)}`).sql).toHaveLength(63);
    for (const bad of ["a_b", "../a", "a--b", `a${"b".repeat(63)}`])
      expect(() => generationLocalIdentity(bad)).toThrow();
    expect(
      new Set(["a-b", "ab", "a-b-c", "ab-c"].map((id) => generationLocalIdentity(id).sql)).size,
    ).toBe(4);
    const unsafe = installed();
    const template = unsafe.templates[0];
    if (!template) throw new Error();
    template.consumers = [
      { input: "binding", consumer: "owned-multipart", outputPaths: ["../unsafe.ts"] },
    ];
    expect(resolveGeneration(design, unsafe).model).toBeUndefined();
  });
});

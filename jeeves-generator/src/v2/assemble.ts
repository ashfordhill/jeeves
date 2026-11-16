import { designGeneration, moduleStatuses, resolveGeneration, sameContractRef } from "@jeeves/spec";
import { assertDistinctPaths, type BundleFile } from "../files.ts";
import {
  atPointer,
  canonicalJson,
  freeze,
  jsonFile,
  pointerPart,
  refuse,
  sha256,
} from "../json.ts";
import { type V2Input, validateV2Input } from "./input.ts";
import {
  type V2Delivery,
  type V2EmitterIdentity,
  type V2Gap,
  type V2ModuleSql,
  type V2ProcessReport,
  type V2Registry,
  v2Compare,
} from "./registry.ts";

const metadata = ".jeeves/";
const pointer = (parts: readonly (string | number)[]) =>
  `/${parts.map((part) => pointerPart(String(part))).join("/")}`;

/** No I/O: render only the immutable normalized model and captured trusted registry bytes.
 * Complete here means emitted support/hooks, never build/runtime proof or TinyURL readiness.
 */
export function assembleV2(inputValue: V2Input, registry: V2Registry) {
  const input = validateV2Input(inputValue);
  const resolution = resolveGeneration(input.design, registry.installed);
  if (!resolution.model) refuse("INVALID_GENERATION", "/generation", jsonFile(resolution.findings));
  const model = resolution.model;
  const generation = designGeneration(input.design);
  if (!generation) refuse("GENERATION_REQUIRED", "/generation", "Explicit generation is required.");
  const normalizedInputSha256 = sha256(canonicalJson(model));
  const checkSources = (paths: readonly string[]) => {
    if (new Set(paths).size !== paths.length)
      refuse("INVALID_SOURCE_PATH", "/sourcePaths", "Contributing declarations must be distinct.");
    for (const path of paths) {
      if (!path.startsWith("/"))
        refuse("INVALID_SOURCE_PATH", path, "Use exact design JSON pointers.");
      atPointer(input.rawDesign, path);
    }
    return [...paths].sort(v2Compare);
  };
  type Record = {
    path: string;
    sha256: string;
    bytes: number;
    ownership: "generated-scaffold" | "generated-extension" | "generator-metadata";
    owner: V2EmitterIdentity | "assembler";
    sourcePaths: string[];
    contributors: { emitter: V2EmitterIdentity; sourcePaths: string[] }[];
  };
  const files: BundleFile[] = [],
    records: Record[] = [];
  const gaps: (V2Gap & { emitter: string })[] = [];
  const resolved: { emitter: string; id: string }[] = [];
  const processRows: (V2ProcessReport & { emitter: string })[] = [];
  const productSql: V2ModuleSql[] = [];
  const delivery: V2Delivery[] = [];
  for (const emitter of registry.emitters) {
    const rendered = emitter.render(
      freeze({
        model,
        settings: resolution.settings,
        asset(path: string) {
          if (!emitter.sourcePaths.includes(path))
            refuse(
              "UNKNOWN_ASSET",
              path,
              "An emitter can read only its fingerprinted source/asset closure.",
            );
          return registry.asset(path);
        },
      }),
    );
    resolved.push(...(rendered.resolves ?? []));
    if (rendered.processes?.length && (!emitter.provides.processes || !model.processes))
      refuse(
        "INVALID_PROCESS_REPORT",
        emitter.id,
        "Only the installed processes owner reports processes, and only with Runnable processes on.",
      );
    processRows.push(...(rendered.processes ?? []).map((row) => ({ ...row, emitter: emitter.id })));
    if (rendered.sql?.length && (!emitter.provides.runtime || !model.processes))
      refuse(
        "INVALID_PRODUCT_SQL",
        emitter.id,
        "Only the runtime owner reports product SQL, and only with Runnable processes on.",
      );
    productSql.push(...(rendered.sql ?? []));
    if (rendered.delivery?.length && (!emitter.provides.runtime || !model.processes))
      refuse(
        "INVALID_PROCESS_REPORT",
        emitter.id,
        "Only the runtime owner reports CDN routes, and only with Runnable processes on.",
      );
    delivery.push(...(rendered.delivery ?? []));
    for (const file of rendered.files) {
      if (file.path.toLowerCase() === ".jeeves" || file.path.toLowerCase().startsWith(metadata))
        refuse("RESERVED_OUTPUT_PATH", file.path, "The assembler owns provenance output.");
      const bytes =
        typeof file.content === "string"
          ? new TextEncoder().encode(file.content)
          : new Uint8Array(file.content);
      const contributors = (file.contributors ?? [])
        .map((contribution) => {
          const contributor = registry.emitters.find((item) => item.id === contribution.emitter);
          if (!contributor || contributor.id === emitter.id)
            refuse(
              "INVALID_CONTRIBUTOR",
              file.path,
              "Name another installed emitter; the writer already owns the file.",
            );
          return {
            emitter: contributor.identity,
            sourcePaths: checkSources(contribution.sourcePaths),
          };
        })
        .sort((a, b) => v2Compare(a.emitter.id, b.emitter.id));
      if (new Set(contributors.map((item) => item.emitter.id)).size !== contributors.length)
        refuse("INVALID_CONTRIBUTOR", file.path, "Contributing emitters must be unique.");
      files.push({ path: file.path, bytes });
      records.push({
        path: file.path,
        sha256: sha256(bytes),
        bytes: bytes.length,
        ownership: file.ownership,
        owner: emitter.identity,
        sourcePaths: checkSources(file.sourcePaths),
        contributors,
      });
    }
    for (const gap of rendered.gaps ?? []) {
      if (
        !gap.id ||
        !gap.description ||
        gaps.some((item) => item.emitter === emitter.id && item.id === gap.id)
      )
        refuse(
          "INVALID_GAP",
          emitter.id,
          "Gaps require unique local IDs and a concrete description.",
        );
      gaps.push({ ...gap, sourcePaths: checkSources(gap.sourcePaths), emitter: emitter.id });
    }
    if (emitter.status === "partial")
      gaps.push({
        id: "partial-implementation",
        emitter: emitter.id,
        required: true,
        status: "unfinished",
        description: emitter.description,
        sourcePaths: [],
      });
  }
  assertDistinctPaths(files.map((file) => file.path));
  for (const row of productSql)
    if (
      !records.some(
        (record) => record.path === row.file && record.ownership === "generated-extension",
      )
    )
      refuse(
        "MISSING_CONSUMER_OUTPUT",
        row.file,
        "Report only product SQL files actually emitted.",
      );
  for (const hook of resolved) {
    const index = gaps.findIndex((gap) => gap.emitter === hook.emitter && gap.id === hook.id);
    if (index < 0)
      refuse(
        "INVALID_RESOLVED_HOOK",
        hook.id,
        "A recipe must satisfy an actual emitted dependency hook.",
      );
    gaps.splice(index, 1);
  }
  // Installed claims must name actual output, owned by this implementation or explicitly
  // composed by a single file owner on its behalf. Advertising a path does not establish support.
  const verifyOutputs = (emitter: string, outputPaths: readonly string[]) => {
    for (const path of outputPaths) {
      const record = records.find((file) => file.path === path);
      if (
        !record ||
        !(
          (typeof record.owner !== "string" && record.owner.id === emitter) ||
          record.contributors.some((item) => item.emitter.id === emitter)
        )
      )
        refuse(
          "MISSING_CONSUMER_OUTPUT",
          path,
          `${emitter} must actually emit or explicitly contribute to its attested consumer file.`,
        );
    }
  };
  for (const emitter of registry.emitters) {
    const provides = emitter.provides;
    for (const callable of provides.callables ?? [])
      if (model.capabilities.some((item) => item.contract.id === callable.contract.id))
        verifyOutputs(emitter.id, callable.outputPaths);
    if (provides.runtime && sameContractRef(provides.runtime.ref, model.runtime))
      verifyOutputs(emitter.id, provides.runtime.outputPaths);
    for (const preset of provides.presets ?? [])
      if (model.preset && sameContractRef(preset.ref, model.preset))
        verifyOutputs(emitter.id, preset.outputPaths);
    for (const template of provides.templates ?? [])
      if (model.selections.some((selection) => sameContractRef(selection.template, template.ref)))
        for (const consumer of template.consumers) verifyOutputs(emitter.id, consumer.outputPaths);
  }
  // Runnable processes (tile process contract, section 1): one row per normalized process, whose
  // entry point its owner actually emitted.
  if (processRows.some((row) => !model.processes?.some((process) => process.tile === row.tile)))
    refuse("INVALID_PROCESS_REPORT", "/generation/processes", "Report only normalized processes.");
  const processTiles = model.processes?.map((process) => {
    const rows = processRows.filter((row) => row.tile === process.tile);
    if (rows.length > 1)
      refuse("INVALID_PROCESS_REPORT", process.tile, "Report each process exactly once.");
    const [row] = rows;
    if (!row) return undefined;
    if (
      !records.some(
        (record) =>
          record.path === row.entry &&
          typeof record.owner !== "string" &&
          record.owner.id === row.emitter,
      )
    )
      refuse(
        "MISSING_CONSUMER_OUTPUT",
        row.entry,
        `${row.emitter} must actually emit the process's entry point.`,
      );
    const { emitter: _emitter, ...rest } = row;
    return rest;
  });
  const support = generation.selections.map((declaration, index) => {
    const selection = model.selections.find((item) => item.id === declaration.id);
    const emitter = registry.emitters.find((item) =>
      item.provides.templates?.some((template) =>
        sameContractRef(template.ref, declaration.template),
      ),
    );
    const installed = emitter?.provides.templates?.find((template) =>
      sameContractRef(template.ref, declaration.template),
    );
    return {
      selection: declaration.id,
      template: declaration.template,
      sourcePath: `/generation/selections/${index}`,
      status: !selection
        ? ("unsupported" as const)
        : installed
          ? ("implemented" as const)
          : ("unfinished" as const),
      ...(emitter && { emitter: emitter.identity }),
      consumers: installed?.consumers ?? [],
      fixedPolicies: (selection?.policies ?? []).map((policy) => ({
        ref: policy.ref,
        status: installed?.consumers.some(
          (consumer) =>
            consumer.input === `policy.${policy.ref.id}` &&
            consumer.consumer === declaration.binding.kind,
        )
          ? "fixed-policy"
          : "unfinished",
      })),
    };
  });
  // A known template missing a required input consumer is incomplete even if some files exist.
  for (const selection of support)
    if (
      selection.status !== "unsupported" &&
      (resolution.findings.some(
        (finding) =>
          finding.target.path &&
          pointer(finding.target.path).startsWith(`${selection.sourcePath}/`),
      ) ||
        resolution.settings.some(
          (setting) =>
            setting.selection === selection.selection &&
            (setting.status === "unsupported" ||
              setting.status === "missing" ||
              !setting.outputPaths.length),
        ))
    )
      selection.status = "unfinished";
  gaps.sort((a, b) => v2Compare(`${a.emitter}/${a.id}`, `${b.emitter}/${b.id}`));
  // Each module's status, only for a design with module-level selections (contract, section 6):
  // its files are those that cite its selection, apart from the shared project and diagnostics.
  const shared = new Set(
    registry.emitters
      .filter((emitter) => emitter.provides.runtime || emitter.status === "diagnostic")
      .map((emitter) => emitter.id),
  );
  const modules = generation.selections.some((selection) => selection.target.kind === "component")
    ? moduleStatuses(input.design).map((status) => {
        const index = generation.selections.findIndex((item) => item.id === status.selection);
        const prefix = `/generation/selections/${index}`;
        return {
          module: status.module,
          name: status.name,
          host: status.host,
          kind: status.kind,
          status: status.status,
          ...(status.template && { template: status.template }),
          ...(status.selection && { selection: status.selection }),
          files:
            index < 0
              ? []
              : records
                  .filter(
                    (record) =>
                      typeof record.owner !== "string" &&
                      !shared.has(record.owner.id) &&
                      record.sourcePaths.some(
                        (path) => path === prefix || path.startsWith(`${prefix}/`),
                      ),
                  )
                  .map((record) => record.path)
                  .sort(v2Compare),
          unconnected: status.unconnected,
          ...(status.reason && { reason: status.reason }),
          // Its own SQL file and schema in each database it writes (v3 contract, section 1).
          ...(productSql.some((row) => row.module === status.module) && {
            sql: productSql
              .filter((row) => row.module === status.module)
              .map(({ database, file, schema }) => ({ database, file, schema })),
          }),
        };
      })
    : undefined;
  // Runnable: no findings, no unsupported gap and a service for every application tile.
  const processes = processTiles && {
    runnable:
      resolution.findings.length === 0 &&
      !gaps.some((gap) => gap.status === "unsupported" || gap.id === "application-services") &&
      processTiles.every((row) => row !== undefined),
    tiles: processTiles.filter((row) => row !== undefined),
    // Each CDN tile's edge route (V3-08).
    ...(delivery.length && { delivery }),
  };
  const report = freeze({
    format: "jeeves-v2-support-v1",
    extensionApi: model.extensionApi,
    capabilities: model.capabilities,
    semanticComplete: resolution.complete,
    applicationComplete: resolution.complete && !gaps.some((gap) => gap.required),
    runtimeVerification: "none",
    strictReadiness: "not-assessed",
    implementations: registry.emitters.map((emitter) => ({
      ...emitter.identity,
      status: emitter.status,
      description: emitter.description,
    })),
    selections: support,
    settings: resolution.settings.map((setting) => ({
      ...setting,
      implementationStatus:
        setting.status === "unsupported"
          ? "unsupported"
          : setting.status === "missing" || !setting.outputPaths.length
            ? "unfinished"
            : setting.status === "fixed"
              ? "fixed-policy"
              : "implemented",
    })),
    findings: resolution.findings,
    localAdapterTreatments: model.localAdapterTreatments,
    gaps,
    ...(modules && { modules }),
    ...(processes && { processes }),
  });
  const addMetadata = (path: string, content: string, sourcePaths: string[] = []) => {
    const bytes = new TextEncoder().encode(content);
    files.push({ path, bytes });
    records.push({
      path,
      sha256: sha256(bytes),
      bytes: bytes.length,
      ownership: "generator-metadata",
      owner: "assembler",
      sourcePaths,
      contributors: [],
    });
  };
  addMetadata(`${metadata}inputs/design.json`, input.designJson);
  addMetadata(`${metadata}normalized.json`, jsonFile(model), ["/generation"]);
  addMetadata(`${metadata}report.json`, jsonFile(report), ["/generation"]);
  addMetadata(
    `${metadata}extensions.md`,
    `# Generated extension contract

Extension API version: ${model.extensionApi.version} (${model.extensionApi.boundary}).

Import product types/helpers only through ${model.extensionApi.publicApi}. Shared application DTOs and pure helpers belong in src/contracts/ (or src/helpers/); same-service helpers are allowed. Run pnpm check:extensions offline (also part of new-export build). The check rejects private cross-service/runtime/driver imports, forbidden policy effects and generated-file edits. Product policies are synchronous and receive copied DTOs; unavailable SQL/authenticated target handles remain explicit custom gaps. Each process validates settings before connections, owns compatible clients by full configuration and credential identity, then stops admission and signals cancellation before reverse-order cleanup. The final shutdown budget is 10 seconds from first stop, including unfinished startup; expiry exits 1 and does not establish that effects rolled back. It checks cooperative mistakes, not hostile JavaScript.

API v1 is legacy-unrestricted. Migrating from v1 requires replacing raw pools, transactions, credentials, guard controls and arbitrary HTTP/SQL calls. Transaction policy/mapping hooks receive immutable DTO copies, never transaction controls. Product queries and authenticated target calls remain explicit custom gaps until a generated binding installs them. Legacy files remain readable; an acknowledgement does not rewrite them. Package files are application-owned: add the check:extensions script and build precheck from .jeeves/generated/package.json when updating an old export.

One independent lifecycle per process reuses clients only for equal resource/configuration/credential/access scopes. Configuration is validated before setup. Shutdown stops admission, aborts dependency waits, drains in reverse construction order, and exits 1 after a final 10-second deadline, including hung startup/hooks. Termination does not imply rollback or a known external outcome.

API v3 adds runtime-owned OperationContext to ModuleRequest and ModuleMessage. Migrate application-created request/message values and test fixtures to supply the received context; keep its live signal and pass the received object through in-process calls. Context facts are immutable: request/correlation identity, verified caller facts, cancellation and remainingMs(). Only remaining durations are forwarded, clamped by the receiver (x-jeeves-remaining-ms); correlation uses x-correlation-id. HTTP retains its configured maximum. Queue delivery gets a fresh 30-second execution budget, ignoring any originating request deadline.

Adapters refuse dispatch after expiry/cancellation. OperationError.outcome distinguishes refused, definite-failure and unknown; a timed-out mutation/publish or lost COMMIT response is unknown even if cancellation or ROLLBACK was attempted. PostgreSQL/amqplib/Pub/Sub cannot cancel an already dispatched operation through the installed promise APIs; its actual driver promise remains tracked through drain. Fetch/S3/OpenSearch request cancellation is best effort. Publisher attributes have at most 32 entries, 64-byte names, 1024-byte values and 8192 total bytes; messageId is 1–128 safe ASCII characters and must remain stable during recovery. Runtime correlation/identity fields are reserved. SDK mutation retries are disabled. Private target transport allows only its declared origin, disables redirect following and credential overrides, and buffers at most 64 KiB of response data. Public SQL/authenticated targets remain unavailable.

Unknown queue effects are sent to .failed with OUTCOME_UNKNOWN instead of intentionally retried by the current runner. This is not durable recovery: a crash/broker redelivery can still repeat an unguarded Custom effect. Such effects require a later installed idempotency/reconciliation mechanism and remain unsupported custom gaps. Do not blindly replay them. The process waits for actual unsettled driver operations until its existing 10-second final shutdown bound; termination never establishes rollback or absence of an effect.

Handwritten hooks, stubs and product SQL remain application-owned. Incompatible version updates refuse and list affected paths. Migrate the code yourself, then run update:v2 with --ack-extension-api=<target version>. The updater validates a temporary copy against the new generated files with TypeScript before applying. Install the target export's dependencies offline first if required. --check never changes the checkout; an acknowledgement is not a build bypass.

Installed callable contracts: ${model.capabilities.map((item) => `${item.id}@${item.contract.version} (${item.contract.effect})`).join(", ") || "none"}.
`,
    ["/generation"],
  );
  records.sort((a, b) => v2Compare(a.path, b.path));
  const manifest = freeze({
    format: "jeeves-v2-manifest-v1",
    extensionApi: model.extensionApi,
    generator: { id: "jeeves-v2", version: "0.1.0-experimental.1" },
    input: {
      sourceSha256: input.sourceSha256,
      sourceCanonicalSha256: input.sourceCanonicalSha256,
      normalizedInputSha256,
    },
    registry: { sha256: registry.sha256, sources: registry.sources },
    runtime: model.runtime,
    ...(model.processes && { processes: true as const }),
    ...(model.preset && { preset: model.preset }),
    templates: generation.selections.map((selection) => ({
      selection: selection.id,
      ref: selection.template,
    })),
    implementations: registry.emitters.map((emitter) => emitter.identity),
    dependencies: registry.emitters.flatMap((emitter) => emitter.dependencies),
    files: records,
  });
  // The manifest excludes itself; every other payload byte, including the report, is covered.
  files.push({
    path: `${metadata}manifest.json`,
    bytes: new TextEncoder().encode(jsonFile(manifest)),
  });
  assertDistinctPaths(files.map((file) => file.path));
  files.sort((a, b) => v2Compare(a.path, b.path));
  return { files, manifest, report };
}

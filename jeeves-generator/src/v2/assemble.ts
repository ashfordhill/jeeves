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

Import product types/helpers only through ${model.extensionApi.publicApi}. Shared application DTOs and pure definitions belong only in src/contracts/; same-service helpers stay inside their own src/modules/<process>/ directory. API v5 requires moving older shared src/helpers/ code into src/contracts/. Run pnpm check:extensions offline (also part of new-export build). The check rejects private cross-service/runtime/driver imports, forbidden policy effects and generated-file edits. Product policies are synchronous and receive copied DTOs; registered product SQL handles are scoped by module and compiled grants; authenticated route-stub target handles use the API v8 boundary below; other target adapters remain explicit gaps. Each process validates settings before connections, owns compatible clients by full configuration and credential identity, then stops admission and signals cancellation before reverse-order cleanup. The final shutdown budget is 10 seconds from first stop, including unfinished startup; expiry exits 1 and does not establish that effects rolled back. It checks cooperative mistakes, not hostile JavaScript.

API v1 is legacy-unrestricted. Migrating from v1 requires replacing raw pools, transactions, credentials, guard controls and arbitrary HTTP/SQL calls. Transaction policy/mapping hooks receive immutable DTO copies, never transaction controls. Raw SQL and arbitrary target calls remain unavailable. Authenticated route-stub targets use the API8 contract below. Registered SQL is available only on declared stub database links. Legacy files remain readable; an acknowledgement does not rewrite them. Package files are application-owned: add the check:extensions script and build precheck from .jeeves/generated/package.json when updating an old export.

One independent lifecycle per process reuses clients only for equal resource/configuration/credential/access scopes. Configuration is validated before setup. Shutdown stops admission, aborts dependency waits, drains in reverse construction order, and exits 1 after a final 10-second deadline, including hung startup/hooks. Termination does not imply rollback or a known external outcome.

API v5 adds checked in-process Favorites handles to a Custom module's call link. New generated callers use dependencies.<callee>.add/remove/check/list with bounded DTOs and generated targets; they never construct /modules URLs or import private implementations. Calls inherit the runtime-owned verified subject, cancellation and effect authority. The existing Favorites selection alone mounts its four HTTP routes; a call link mounts none. src/contracts/ is the one application-owned shared DTO/pure definition directory; never import process-private code from it. Display renames now preserve all source IDs, target addresses, durable namespaces and extension paths, including newly created designs. Explicit identity changes require application migration. Updates from v4 require --ack-extension-api=8 and a successful staged build; handwritten files are preserved.

API v6 requires exact product-table operations and named published-view audiences through ownership.grants[].product. shareOwner explicitly gives a worker its API's logical owner; it does not share credentials or merge unrelated owned state. The declared product schema p_<logical owner> is shared by its modules and is separate from template implementation tables. Application roles receive no CREATE, ownership or migration credentials. Existing undeclared product tables/views receive no product grants. Move existing module-schema data explicitly before selecting a shared product namespace; export to a fresh directory for namespace changes. API v7 adds versioned product migrations and registered SQL execution below; earlier updates require explicit acknowledgement and staged checking and never rewrite handwritten product SQL or hook bodies.

API v8 changes application HttpTarget dependencies to scoped ServiceTarget.call(operation, {method: "GET" | "POST", body?, key?}) handles. Updates from earlier versions require --ack-extension-api=8 plus staged checker/TypeScript validation; migrate each affected handwritten call explicitly. Hooks are never rewritten. Connect workload slots on the actual caller and callee modules to the same installed Identity (local Keycloak/OIDC), independently of browser Sign-in. The emitted operation is each route stub's existing entrypoint, addressed internally at /internal/modules/<stable-module-id>, GET/POST root only, with bounded JSON DTOs. Internal request/response DTOs share finite validation; primitive strings are JSON-encoded, empty results normalize to null, and no-content responses have no body. Both request path fields are the operation root; GET has no body. Internal framing ignores product response headers and always sets Cache-Control: no-store. HEAD and other methods are refused before product dispatch. Response headers are not forwarded, and redirects are never followed. Installed template operations without an authenticated cross-process adapter remain unavailable. Declared links establish the maximum callers/operations; export const allowedCallers = ["stable-process-id"] in a callee module may only narrow its maximum (empty denies all). Internal-only callees do not mount legacy /modules aliases, including wildcard/method alternatives. Explicitly public ingress retains /modules routes under its user policy; internal routes always require the dedicated workload credential, including on private networks. Required end-user identities remain separate. A verified incoming user bearer is forwarded privately only to compiled recipients sharing the user issuer; workload-marked tokens cannot establish users. No raw bearer reaches product DTOs, and no session lookup, refresh or retry is supplied here.

The finite issuer contract uses confidential service-account client credentials, RS256, a signed jeeves_workload process ID and matching azp=jeeves-workload-<process-id>, and audience jeeves-service-<target-id>. User grants are disabled on those clients. Each process snapshots its own workload client secret before opening clients. JEEVES_WORKLOAD_ISSUER, JEEVES_WORKLOAD_TOKEN_URL and JEEVES_WORKLOAD_JWKS_URL are validated deployment endpoints; JEEVES_REQUIRE_TLS applies to all three. Compose supplies only local test endpoints and fresh setup secrets. Token/JWKS responses are at most 64 KiB; JWKS has 1–16 keys. Token/JWKS caches belong to one process: at most 16 fixed target audiences, one refresh per target, a 2s acquisition/JWKS bound, 1s failed-refresh cooldown, 300s maximum token lifetime, 5s early token refresh, 60s maximum cached-key age and 30s unknown-key cooldown. A valid cached token may be used after refresh failure only until its verified exp; expired or absent credentials never become anonymous. Key removal may take 60s to reach readers; issuer outage never extends that key window. Credentials rotate by process restart. Invalid workload identity answers safe 401, disallowed caller 403, issuer/key dependency failure 503. GET is read; POST is an external mutation with unknown outcomes after timeout/loss/oversized/invalid replies or remote uncertainty. No automatic retry occurs, and no network call is allowed in a local atomic effect, including nested reads.

Keycloak --import-realm provisions only the first startup, never an existing realm update. The local runner checks .runtime/workload-contract.json against the exact compiled client/audience contract and refuses missing/changed setup before starting services. Use a fresh disposable local runtime or an externally reviewed issuer/client migration; the local record is an operator attestation, not proof of issuer state. No automatic reset, provisioning of a production issuer, general managed-provider compatibility, or deployment is claimed.

API v7 replaces re-runnable module SQL with infra/postgres/<database>/products.json and ordered four-digit migrations per compiled product namespace. One protected ledger in public.jeeves_product_migrations tracks (namespace, version, sha256); the setup transaction locks the database and namespace, checks all applied checksums, applies only appended versions, and commits product DDL and ledger together. Any failure rolls both back. Missing/edited applied migrations refuse; no reset is inferred. Module SQL files remain preserved and are never executed. Product migrations run under a NOLOGIN, NOINHERIT role with CREATE only in their product schema, without template-table or ledger access. Setup alone switches roles and writes the ledger. It then publishes declared product-schema views into published with compiled audiences. Migration roles have no CREATE on published.

The finite products.json declares namespaces/migrations, tables, published view name/source, and named operations (module, host, query/command, SQL file, 0..32 positional parameters, relation operations). Declarations can only narrow compiled ownership.grants[].product and actual module/database links. SQL files are application-owned. Register ordinary SELECT or INSERT/UPDATE/DELETE statements with $1..$n placeholders; product code calls dependencies.<database>.call(name, values). A call never accepts SQL or transaction handles. Each registered query runs BEGIN READ ONLY; commands use the generated transaction with poisoned-failure/unknown-COMMIT semantics. Only null/string/finite number/boolean parameters are accepted. Returned rows are copied/frozen. Pure policy hooks receive no handle.

All declarations, operation SQL, endpoints and product credentials are checked before any process client opens. Product-only logins/pools remain distinct from template credentials and grant scopes, with no protected template state, DDL, ledger authority or default grants. Configuration uses bounded lexical control refusals, not a complete SQL parser or hostile SQL/JavaScript sandbox. PostgreSQL privileges and READ ONLY enforce the boundary; application-owned code/SQL is still reviewed. The template loader's unavailable query placeholder remains a gap until that template installs a product binding.

Migrating v6 or older is explicit: preserve/export the old application and database first; inventory old modules/*.sql and actual schema/data; write a reviewed versioned initial baseline and subsequent migrations in a fresh export, preserving the intended namespace. Perform any existing-database baseline/data movement separately under operator review; never run legacy re-runnable files through the new runner. This updater never executes SQL, copies data or infers a schema conversion. To acknowledge a prepared external baseline without renaming namespaces, supply products.json, its migration files and .jeeves/product-sql-migration.json: {"version":1,"mode":"external-reviewed","legacy":[{"file":"infra/postgres/<db>/modules/<module>.sql","sha256":"<actual file SHA-256>"}]}. Name every prior module SQL file with its current hash. The receipt records the application's external review, not proof the database was migrated. Missing/stale declarations/receipt refuse with all existing application bytes preserved, even with --ack-extension-api=7. Namespace changes still require a fresh export and explicit data migration. Then run the staged checker/TypeScript migration with --ack-extension-api=7; bodies remain yours.

Purpose-bound signing/sealing settings are additive to API v7: import signingKeys(purpose) or sealingKeys(purpose) with declareSettings from the public API in a product operation module. Its private file is a JSON array of 1–8 {"id","key"} entries: unique 1–32 safe ASCII IDs and canonical unpadded base64url keys of 32–4096 bytes; the whole file is at most 64 KiB. Read it through JEEVES_SECRET_<NAME>_FILE or SECRET_DIR/<lower-case-hyphen-name>. Configuration reads each ring file once per process and supplies the same frozen opaque handles during setup. Only built-in setting descriptors and optional descriptors derived from them are accepted; structural copies and custom parse callbacks refuse before file access. Raw keyRing/secret/readSettings helpers and file handles are private. Policies receive no signing/sealing handle.

A signing handle offers sign(value, {scope,context}) and verify(envelope, {scope,context}); a sealing handle offers seal/open with the same arguments. Purpose is a fixed 1–64 lower-case ASCII identifier [a-z][a-z0-9.-]*; jeeves and the jeeves. prefix are reserved for private generated mechanisms. Supply a trusted account/tenant scope and operation context, each nonempty and at most 512 UTF-8 bytes; neither can be inferred from an untrusted envelope. Values are UTF-8 strings at most 16 KiB. Invalid writes throw a value-free error; invalid reads return undefined and log nothing. Verification is not expiry, authorization or schema validation: product code validates the verified value and any expiry. HMAC-SHA256 signatures and AES-256-GCM sealed envelopes authenticate version, key ID, purpose, scope and context with structured framing. HKDF-SHA256 separates purpose and signing/sealing keys. Envelopes use canonical unpadded base64url, at most 24 KiB. AES-GCM uses fresh 96-bit random nonces and 128-bit tags. Use high-entropy random ring keys. The first key writes, retained keys read, removed/unknown keys refuse. Rotate the shared secret file and restart each replica; in-process file watching is not provided. Private generated mechanisms use separate purposes; webhook ingress and sessions remain unavailable here.

Local idempotent operations are additive to API v8. In a route stub export const localOperation = defineLocalOperation<Input, Dependencies>({database: "databaseProperty", id: "stable-operation-id", version: 1, retentionSeconds: 86400, secret: true, validate, admit, mutate}). The finite declaration binds one writable database slot before clients open. validate is a synchronous bounded DTO policy; admit(input, dependencies, caller) may make permitted reads for new work only; mutate(input, commands, caller) receives immutable verified subject facts and registered same-database commands (use SQL RETURNING to select a result), without raw SQL, transaction controls or network capabilities. Each policy/operation must use application DTO contracts in src/contracts/ where shared. Export the normal route entrypoint calling localOperation.route(dependencies, request), or call localOperation.call(dependencies, {key, input}) in process under the received runtime context. Both require the verified account subject; callers cannot choose the replay scope, hash or database. The HTTP adapter accepts POST at the root and Idempotency-Key, returns only status/body and mandatory no-store. Authenticated ServiceTarget POST requests carry the same key through the finite key field; GET refuses keys, and arbitrary headers/credentials remain forbidden. Callable and HTTP results/identity/refusals match.

The framework validates authentication, key and bounded input, normalizes validated JSON (preserving absent versus null input) and computes canonical identity from it and stable process/module/operation/version, recovers committed replay before admission, then takes a transaction advisory lock and checks replay again. Competing holders refuse 409 IDEMPOTENCY_IN_PROGRESS; changed input conflicts 409; a still-retained expired row refuses 410. Retention is mandatory, 60 seconds through seven days. Once cleanup removes an expired committed row, the key is reusable; clients must not rely on replay beyond that horizon. Successful 2xx status and a JSON body up to 12 KiB commit with all product commands and mandatory codec/version/secret/retention metadata. Failure or invalid result rolls back both. Secret replay is AES-GCM sealed using private jeeves.replay.v1 keys bound to account/operation/key/input identity; ciphertext/key material never reaches product hooks or logs. Configure the private ring through JEEVES_SECRET_JEEVES_REPLAY_KEYS_FILE or SECRET_DIR/jeeves-replay-keys; mount it through your compose.override.yaml. Missing/invalid keys fail before connections, and the ring is snapshotted once. Rotate by restarting with the new key first and retained old keys; removed keys fail replay closed. No key handle is supplied to product policy.

The whole mutation callback runs under the product-only database role. Its commands close and all actual issued work settles before RESET ROLE and protected replay storage; caught command failures poison the transaction. Captured ordinary database handles refuse even for the same database, and captured service/queue/cache/object/search handles refuse network dispatch, including nested reads. Cross-database atomicity, external effects, automatic callback retries and distributed transactions are unavailable. A lost COMMIT response remains unknown; retrying the same identity recovers the durable replay without repeating the local mutation. The original connection stays owned until actual completion. The append-only 051 migration adds replay metadata without rewriting applied 050 SQL or records. Runtime-owned cleanup starts independently of traffic, every 60 seconds, at most 1,000 expired committed rows per sweep, with advisory coordination and SKIP LOCKED; status-zero/locked active work is never removed.

Stable identity protection also applies when the extension API version is unchanged: update refuses removed/replaced process, selection, target, resource or caller namespaces. Label edits preserve them. Snapshot Undo/import can restore historical IDs but never migrates an existing exported app. Export to a fresh directory and migrate application/data explicitly; --ack-extension-api cannot bypass this refusal.

API v4 unifies HTTP errors through one runtime classification. Every HTTP process imports the application-owned synchronous body formatter from src/http-errors.hooks.ts; it receives only frozen public status/code/message/retryability and request/correlation IDs. It cannot change status or mandatory headers; invalid/throwing/async/oversized output falls back safely. Keep this shared file and its imports pure; the offline boundary check follows them. Updates from v3 require explicit --ack-extension-api=4, preserve existing hooks and add the formatter scaffold without rewriting product code. Returned error bodies are replaced with generated safe defaults. Only genuine pre-dispatch admission refusal carries Retry-After: 1; a deadline, unknown outcome or generic failure never authorizes blind replay. Token/claim/signature failure is 401 with WWW-Authenticate: Bearer; unavailable JWKS/native read dependencies are 503.

HTTP /livez answers 200 while the process can answer requests, including drain. /readyz and the compatibility alias /healthz answer 200 only after successful initialization/listen, and 503 during drain. These routes bypass product admission/guards. Required dependency startup failure never becomes ready; this is not a continuous deep dependency probe. Structured completion/failure lines carry safe route patterns (no URL/query), status/code and request/correlation IDs; credentials, bodies and original exceptions are excluded. Process/HTTP drain milestones record admission stop, cancellation and completion within the existing final bound.

Generated HttpRoutes declarations support only 1 KiB, 16 KiB, 64 KiB and 1 MiB body limits (64 KiB default), enforced by Fastify before buffering beyond the bound. rawBody: true retains bytes as body/rawBody without JSON decoding for JSON, text or binary ingress. The operation budget starts after headers in onRequest; a stalled body gets the classified deadline response and unread input closes after flush. Expiry is rechecked before handler dispatch. Default routes still decode JSON/text. This is an internal generated adapter declaration, not a normal inspector setting or webhook authentication/storage.

API v3 adds runtime-owned OperationContext to ModuleRequest and ModuleMessage. Migrate application-created request/message values and test fixtures to supply the received context; keep its live signal and pass the received object through in-process calls. Context facts are immutable: request/correlation identity, verified caller facts, cancellation and remainingMs(). Only remaining durations are forwarded, clamped by the receiver (x-jeeves-remaining-ms); correlation uses x-correlation-id. HTTP retains its configured maximum. Queue delivery gets a fresh 30-second execution budget, ignoring any originating request deadline.

Adapters refuse dispatch after expiry/cancellation. OperationError.outcome distinguishes refused, definite-failure and unknown; a timed-out mutation/publish or lost COMMIT response is unknown even if cancellation or ROLLBACK was attempted. PostgreSQL/amqplib/Pub/Sub cannot cancel an already dispatched operation through the installed promise APIs; its actual driver promise remains tracked through drain. Fetch/S3/OpenSearch request cancellation is best effort. Publisher attributes have at most 32 entries, 64-byte names, 1024-byte values and 8192 total bytes; messageId is 1–128 safe ASCII characters and must remain stable during recovery. Runtime correlation/identity fields are reserved. SDK mutation retries are disabled. Private target transport allows only its declared origin, disables redirect following and credential overrides, and buffers at most 64 KiB of response data. Raw SQL and arbitrary external targets remain unavailable; registered product operations use the v7 boundary. Authenticated route-stub calls use the v8 boundary.

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

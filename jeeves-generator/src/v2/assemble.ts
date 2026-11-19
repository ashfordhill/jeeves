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
      ...(setting.input === "identity.provider" &&
        setting.origin === "descriptor-default" && {
          sourcePaths: setting.sourcePaths.map((path) => path.slice(0, -1)),
        }),
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

## Application-writing packet

1. Read .jeeves/report.json and the generated .slots.ts declarations. Required custom/unfinished gaps remain your work even when this guide, checker and TypeScript all pass. An unfilled hook still throws NotImplemented. Diagram validation cannot establish your product policy or inspect unwritten application semantics.
2. Edit only application-owned extensions: src/modules/<process>/*.ts, their hooks/helpers, src/contracts/, src/http-errors.hooks.ts and declared product SQL/migrations. The manifest identifies generated-extension versus template-owned generated-scaffold files. Change the diagram/template and regenerate scaffold files; do not patch them. Never copy a private implementation into a hook.
3. Import generated helpers/types from src/extension-api/index.ts and your generated sibling .slots.ts. Share pure DTOs/definitions through src/contracts/. Same-process application helpers stay in their own module directory. Direct drivers, runtime/features/processes, another process's modules, filesystem/env access, dynamic imports, timers and raw fetch are refused. The finite external import allowlist is zod, node:crypto, node:buffer and node:url; these imports do not grant credentials or effect authority.
4. Keep policy/mapping hooks synchronous and DTO-only. Operation entrypoints and read-only cache loaders carry the generated @jeeves-extension: operation marker and receive only their declared handles. The marker selects the source check; it does not override runtime effect guards, grants, caller checks or DTO validation. Shared contracts and the HTTP error formatter remain pure regardless of markers.
5. Register exact product tables/views, named parameterized queries/commands and appended checksummed migrations in products.json. Supply positional values through commands.call or the scoped query handle. Never interpolate SQL or touch protected framework tables. Run pnpm check:extensions, then pnpm build; run application tests for completed hooks and actual integrations separately.

| Effect/context | Allowed | Refused |
| --- | --- | --- |
| Pure policy/mapping | Immutable DTO validation, keys, eligibility, codec, request/response mapping | Async policies, clients, I/O, credentials, lifecycle/transaction/ACK controls |
| Read operation | Declared registered SELECT and installed read handles | Product commands, publish/cache/object/search writes, nested mutation handles |
| Local atomic mutation | Same-database registered commands supplied by generated callback | Captured ordinary DB handles, a second database, network (including remote GET), callback retry |
| Durable external work | Persisted intent and the installed generated workload-only ticket/recovery target | Arbitrary provider/URL, generic keyed POST retry, replacing expired/missing selected tickets, secret remote-result checkpoints |

Accepted operation shape (inside the generated module entrypoint; property names come from its .slots.ts):

~~~ts
const result = await dependencies.callee.operations.receive.read({ accept: "application/json" });
return serviceResponse(result, { result: result.body });
~~~

Accepted local mutation body (inside defineLocalOperation.mutate or defineDurableWork.complete):

~~~ts
await commands.call("insert_item", [input.id]);
// The framework drains commands and commits product state with replay/work completion.
~~~

Refused code and the boundary that refuses it:

~~~ts
import pg from "pg"; // Offline checker: direct driver import.
import { pool } from "../../runtime/private.ts"; // Offline checker: private runtime.
const eligible = async () => true; // Pure .hooks.ts: checker and runtime synchronous policy guard.
await dependencies.callee.operations.receive.mutate(input); // In a GET/read: runtime effect refusal.
await dependencies.otherDatabase.call("insert_item", [input.id]); // Inside local mutate: captured DB refusal.
await fetch("https://provider.example/effect"); // Checker; no installed recovery binding.
~~~

These are contextual examples, not declarations to paste over generated scaffolds. A receipt declaration must have retentionSeconds >= deliveryHorizonSeconds including delivery, retries and quarantine/operator delay; invalid declarations refuse before clients open. A cache loader for mutable data must choose versioned freshness and provide its version/absolute expiry policies. Immutable-positive is an application promise that records never change; neither the diagram nor the checker proves it. Mixing admission and either cache-reader mode on one store refuses because their eviction requirements conflict.

For upgrades, keep the old export/data and inventory the affected hook paths first. Run update:v2 --check against the new diagram to see the target API and identity changes. Migrate handwritten bodies/imports/DTOs and product SQL explicitly; drain or reconcile accepted work/session state under the old identities before any namespace/version change. Use --ack-extension-api=<reported target version> only for a genuine version change, then require the staged checker/TypeScript build. The updater never rewrites bodies, executes migrations, moves product data or lets acknowledgement bypass stable-identity refusal. Current extension API remains v8; saved design schema versions are separate. Label-only edits preserve IDs, mounts, credentials and durable namespaces.

## Installed mechanism reference

Import product types/helpers only through ${model.extensionApi.publicApi}. Shared application DTOs and pure definitions belong only in src/contracts/; same-service helpers stay inside their own src/modules/<process>/ directory. API v5 requires moving older shared src/helpers/ code into src/contracts/. Run pnpm check:extensions offline (also part of new-export build). The check rejects private cross-service/runtime/driver imports, forbidden policy effects and generated-file edits. Product policies are synchronous and receive copied DTOs; registered product SQL handles are scoped by module and compiled grants; authenticated route-stub target handles use the API v8 boundary below; other target adapters remain explicit gaps. Each process validates settings before connections, owns compatible clients by full configuration and credential identity, then stops admission and signals cancellation before reverse-order cleanup. The final shutdown budget is 10 seconds from first stop, including unfinished startup; expiry exits 1 and does not establish that effects rolled back. It checks cooperative mistakes, not hostile JavaScript.

API v1 is legacy-unrestricted. Migrating from v1 requires replacing raw pools, transactions, credentials, guard controls and arbitrary HTTP/SQL calls. Transaction policy/mapping hooks receive immutable DTO copies, never transaction controls. Raw SQL and arbitrary target calls remain unavailable. Authenticated route-stub targets use the API8 contract below. Registered SQL is available on declared stub database links and cache-reader source bindings. Legacy files remain readable; an acknowledgement does not rewrite them. Package files are application-owned: add the check:extensions script and build precheck from .jeeves/generated/package.json when updating an old export.

One independent lifecycle per process reuses clients only for equal resource/configuration/credential/access scopes. Configuration is validated before setup. Shutdown stops admission, aborts dependency waits, drains in reverse construction order, and exits 1 after a final 10-second deadline, including hung startup/hooks. Termination does not imply rollback or a known external outcome.

API v5 adds checked in-process Favorites handles to a Custom module's call link. New generated callers use dependencies.<callee>.add/remove/check/list with bounded DTOs and generated targets; they never construct /modules URLs or import private implementations. Calls inherit the runtime-owned verified subject, cancellation and effect authority. The existing Favorites selection alone mounts its four HTTP routes; a call link mounts none. src/contracts/ is the one application-owned shared DTO/pure definition directory; never import process-private code from it. Display renames now preserve all source IDs, target addresses, durable namespaces and extension paths, including newly created designs. Explicit identity changes require application migration. Updates from v4 require --ack-extension-api=8 and a successful staged build; handwritten files are preserved.

API v6 requires exact product-table operations and named published-view audiences through ownership.grants[].product. shareOwner explicitly gives a worker its API's logical owner; it does not share credentials or merge unrelated owned state. The declared product schema p_<logical owner> is shared by its modules and is separate from template implementation tables. Application roles receive no CREATE, ownership or migration credentials. Existing undeclared product tables/views receive no product grants. Move existing module-schema data explicitly before selecting a shared product namespace; export to a fresh directory for namespace changes. API v7 adds versioned product migrations and registered SQL execution below; earlier updates require explicit acknowledgement and staged checking and never rewrite handwritten product SQL or hook bodies.

RG21 adds generated ServiceTarget.operations.<stable-module-id>.read(headers?) and .mutate(body,key?) handles for actual declared callee route roots. Existing call(operation, request) remains the same bounded JSON@1 root-operation contract. Generated slot types enumerate available operation identities; runtime refuses every other target/operation. read is GET with no body/key and runtime read effect authority on both ends; registered SQL commands, publish/cache/object/search mutation wrappers and nested mutation capabilities refuse under it. mutate is POST, never automatically retried, even with an arbitrary supplied key. Application routes and composite bodies remain product code; serviceResponse(result, body?) composes bounded DTOs while preserving the genuine generated result status and finite metadata. Product cannot manufacture that provenance.

Browser session can call only a declared matching-Identity bearer Auth guard HTTP route-stub callee, with separate workload slots on both processes. Cookie-session callees, missing/mismatched user verification, background user authority and unavailable template operations refuse. Private generated access-token validation uses pinned JOSE against the exact selected HTTPS issuer, its discovered JWKS, ${model.selections.some((s) => s.identity?.provider === "auth0") ? "selected user API audience" : "compiled <identity>-web audience"}, stored subject and no workload claim. ${model.selections.some((s) => s.identity?.provider === "auth0") ? "Configure the exact issuer and API audience across every linked browser and bearer guard. The deployed provider must issue that user audience. See deploy/README.md for Auth0 and Keycloak registration." : "Callees receiving session calls require that compiled audience and HTTPS /realms/<identity> issuer path; configure both sides to the exact same issuer. The confidential browser client's audience mapper/registration must issue that user audience; optional authorization audience must match it when supplied."} Tokens never reach product DTOs, hooks, settings or logs. ${model.selections.some((s) => s.binding.kind === "browser-session") ? "An admitted Optional guest call carries workload identity alone. The receiving Auth guard applies its own user policy. A supplied invalid user identity is refused." : "Absent/invalid identity does not authorize forwarding."} Independent background scopes cannot inherit the provider.

Forwarding accepts only Accept/If-Match/If-None-Match/If-Modified-Since headers, bounded ASCII with case-insensitive duplicate refusal, plus the separate bounded idempotency key. Generated Content-Type, workload/user credentials, correlation and remaining duration cannot be replaced. Returned finite ETag/Allow/JSON content-type/Retry-After metadata has the same byte/control bounds; credentials, cookies, redirects and framework auth/outcome markers never become product headers. Definite HTTP refusals preserve finite metadata through the shared safe formatter; unknown mutation results remain unknown. Only a generated pre-product USER verification refusal marker on a GET permits one coordinated refresh and retry. A rejected fresh-looking generation is rotated, while a newer committed winner is reused. Workload401/403, product401, dependency failures, network/unknown outcomes and all POSTs are never refresh/retry triggers. Both attempts use the same captured target/operation/input and the request's remaining budget; there is no public refresh control or arbitrary proxy.

API v8 changes application HttpTarget dependencies to scoped ServiceTarget.call(operation, {method: "GET" | "POST", body?, key?}) handles. Updates from earlier versions require --ack-extension-api=8 plus staged checker/TypeScript validation; migrate each affected handwritten call explicitly. Hooks are never rewritten. Connect workload slots on the actual caller and callee modules to the same installed Identity (local Keycloak/OIDC), independently of browser Sign-in. The emitted operation is each route stub's existing entrypoint, addressed internally at /internal/modules/<stable-module-id>, GET/POST root only, with bounded JSON DTOs. Internal request/response DTOs share finite validation; primitive strings are JSON-encoded, empty results normalize to null, and no-content responses have no body. Both request path fields are the operation root; GET has no body. Internal framing accepts only finite ETag/Allow/content-type/Retry-After response metadata and always sets Cache-Control: no-store. HEAD and other methods are refused before product dispatch. Finite contract response headers are returned to callers; redirects are never followed. Installed template operations without an authenticated cross-process adapter remain unavailable. Declared links establish the maximum callers/operations; export const allowedCallers = ["stable-process-id"] in a callee module may only narrow its maximum (empty denies all). Internal-only callees do not mount legacy /modules aliases, including wildcard/method alternatives. Explicitly public ingress retains /modules routes under its user policy; internal routes always require the dedicated workload credential, including on private networks. Required end-user identities remain separate. A verified incoming user bearer is forwarded privately only to compiled recipients sharing the user issuer; workload-marked tokens cannot establish users. No raw bearer reaches product DTOs. Browser session forwarding uses the private request bridge described below.

The finite issuer contract uses confidential service-account client credentials, RS256, a signed jeeves_workload process ID and matching azp=jeeves-workload-<process-id>, and audience jeeves-service-<target-id>. User grants are disabled on those clients. Each process validates its initial workload client secret before opening clients. Optional JEEVES_WORKLOAD_SECRET_FILE names an absolute private credential path read again for every new token request; otherwise the existing per-client credential is snapshotted at startup. JEEVES_WORKLOAD_ISSUER, JEEVES_WORKLOAD_TOKEN_URL and JEEVES_WORKLOAD_JWKS_URL are validated deployment endpoints; JEEVES_REQUIRE_TLS applies to all three. Compose supplies only local test endpoints and fresh setup secrets. Token/JWKS responses are at most 64 KiB; JWKS has 1–16 keys. Token/JWKS caches belong to one process: at most 16 fixed target audiences, one refresh per target, a 2s acquisition/JWKS bound, 1s failed-refresh cooldown, 300s maximum token lifetime, 5s early token refresh, 60s maximum cached-key age and 30s unknown-key cooldown. A valid cached token may be used after refresh failure only until its verified exp; expired or absent credentials never become anonymous. Key removal may take 60s to reach readers; issuer outage never extends that key window. Replacing the configured workload secret file rotates credentials at the next token refresh. Later unreadable or invalid file contents fail like an issuer request, without stopping the process or extending cached-token validity. Invalid workload identity answers safe 401, disallowed caller 403, issuer/key dependency failure 503. GET is read; POST is an external mutation with unknown outcomes after timeout/loss/oversized/invalid replies or remote uncertainty. Ordinary workload/bearer calls never retry automatically; the sole Browser session GET exception is described above. No network call is allowed in a local atomic effect, including nested reads.

Keycloak --import-realm provisions only the first startup, never an existing realm update. The local runner checks .runtime/workload-contract.json against the exact compiled client/audience contract and refuses missing/changed setup before starting services. Use a fresh disposable local runtime or an externally reviewed issuer/client migration; the local record is an operator attestation, not proof of issuer state. No automatic reset, provisioning of a production issuer, general managed-provider compatibility, or deployment is claimed.

API v7 replaces re-runnable module SQL with infra/postgres/<database>/products.json and ordered four-digit migrations per compiled product namespace. One protected ledger in public.jeeves_product_migrations tracks (namespace, version, sha256); the setup transaction locks the database and namespace, checks all applied checksums, applies only appended versions, and commits product DDL and ledger together. Any failure rolls both back. Missing/edited applied migrations refuse; no reset is inferred. Module SQL files remain preserved and are never executed. Product migrations run under a NOLOGIN, NOINHERIT role with CREATE only in their product schema, without template-table or ledger access. Setup alone switches roles and writes the ledger. It then publishes declared product-schema views into published with compiled audiences. Migration roles have no CREATE on published.

The finite products.json declares namespaces/migrations, tables, published view name/source, and named operations (module, host, query/command, SQL file, 0..32 positional parameters, relation operations). Declarations can only narrow compiled ownership.grants[].product and actual module/database links. SQL files are application-owned. Register ordinary SELECT or INSERT/UPDATE/DELETE statements with $1..$n placeholders; product code calls dependencies.<database>.call(name, values). A call never accepts SQL or transaction handles. Each registered query runs BEGIN READ ONLY; commands use the generated transaction with poisoned-failure/unknown-COMMIT semantics. Only null/string/finite number/boolean parameters are accepted. Returned rows are copied/frozen. Pure policy hooks receive no handle.

All declarations, operation SQL, endpoints and product credentials are checked before any process client opens. Product-only logins/pools remain distinct from template credentials and grant scopes, with no protected template state, DDL, ledger authority or default grants. Configuration uses bounded lexical control refusals, not a complete SQL parser or hostile SQL/JavaScript sandbox. PostgreSQL privileges and READ ONLY enforce the boundary; application-owned code/SQL is still reviewed. Cache-reader loaders use their generated read-only product binding; other template loader placeholders remain explicit gaps.

Migrating v6 or older is explicit: preserve/export the old application and database first; inventory old modules/*.sql and actual schema/data; write a reviewed versioned initial baseline and subsequent migrations in a fresh export, preserving the intended namespace. Perform any existing-database baseline/data movement separately under operator review; never run legacy re-runnable files through the new runner. This updater never executes SQL, copies data or infers a schema conversion. To acknowledge a prepared external baseline without renaming namespaces, supply products.json, its migration files and .jeeves/product-sql-migration.json: {"version":1,"mode":"external-reviewed","legacy":[{"file":"infra/postgres/<db>/modules/<module>.sql","sha256":"<actual file SHA-256>"}]}. Name every prior module SQL file with its current hash. The receipt records the application's external review, not proof the database was migrated. Missing/stale declarations/receipt refuse with all existing application bytes preserved, even with --ack-extension-api=${model.extensionApi.version}. Namespace changes still require a fresh export and explicit data migration. Then run the staged checker/TypeScript migration with --ack-extension-api=${model.extensionApi.version}; bodies remain yours.

Purpose-bound signing/sealing settings are additive to API v7: import signingKeys(purpose) or sealingKeys(purpose) with declareSettings from the public API in a product operation module. Its private file is a JSON array of 1–8 {"id","key"} entries: unique 1–32 safe ASCII IDs and canonical unpadded base64url keys of 32–4096 bytes; the whole file is at most 64 KiB. Read it through JEEVES_SECRET_<NAME>_FILE or SECRET_DIR/<lower-case-hyphen-name>. Configuration reads each ring file once per process and supplies the same frozen opaque handles during setup. Only built-in setting descriptors and optional descriptors derived from them are accepted; structural copies and custom parse callbacks refuse before file access. Raw keyRing/secret/readSettings helpers and file handles are private. Policies receive no signing/sealing handle.

A signing handle offers sign(value, {scope,context}) and verify(envelope, {scope,context}); a sealing handle offers seal/open with the same arguments. Purpose is a fixed 1–64 lower-case ASCII identifier [a-z][a-z0-9.-]*; jeeves and the jeeves. prefix are reserved for private generated mechanisms. Supply a trusted account/tenant scope and operation context, each nonempty and at most 512 UTF-8 bytes; neither can be inferred from an untrusted envelope. Values are UTF-8 strings at most 16 KiB. Invalid writes throw a value-free error; invalid reads return undefined and log nothing. Verification is not expiry, authorization or schema validation: product code validates the verified value and any expiry. HMAC-SHA256 signatures and AES-256-GCM sealed envelopes authenticate version, key ID, purpose, scope and context with structured framing. HKDF-SHA256 separates purpose and signing/sealing keys. Envelopes use canonical unpadded base64url, at most 24 KiB. AES-GCM uses fresh 96-bit random nonces and 128-bit tags. Use high-entropy random ring keys. The first key writes, retained keys read, removed/unknown keys refuse. Rotate the shared secret file and restart each replica; in-process file watching is not provided. Private generated mechanisms use separate purposes; webhook ingress uses its own private ring consumer below. Browser sessions use separate private purposes as described below.

Local idempotent operations are additive to API v8. In a route stub export const localOperation = defineLocalOperation<Input, Dependencies>({database: "databaseProperty", id: "stable-operation-id", version: 1, retentionSeconds: 86400, secret: true, validate, admit, mutate}). The finite declaration binds one writable database slot before clients open. validate is a synchronous bounded DTO policy; admit(input, dependencies, caller) may make permitted reads for new work only; mutate(input, commands, caller) receives immutable verified subject facts and registered same-database commands (use SQL RETURNING to select a result), without raw SQL, transaction controls or network capabilities. Each policy/operation must use application DTO contracts in src/contracts/ where shared. Export the normal route entrypoint calling localOperation.route(dependencies, request), or call localOperation.call(dependencies, {key, input}) in process under the received runtime context. Both require the verified account subject; callers cannot choose the replay scope, hash or database. The HTTP adapter accepts POST at the root and Idempotency-Key, returns only status/body and mandatory no-store. Authenticated ServiceTarget POST requests carry the same key through the finite key field; GET refuses keys, and arbitrary headers/credentials remain forbidden. Callable and HTTP results/identity/refusals match.

Webhook receiver is installed in Service with one writable owned state slot and Runnable processes. It mounts only POST /modules/<module-id> and runs its durable processor independently of HTTP arrivals in that Service lifecycle. A Required user Auth guard in the same host is incompatible and refuses composition; use a separate Service. bodyLimitBytes is 1024, 16384 or 65536; replayWindowSeconds is 30..300 (default 300), applied symmetrically to past/future Unix seconds using the receiver clock. This exact generic protocol is not Stripe or another provider signature format. There is no verifier override, public replay/admin route or unsigned acceptance API.

Browser session is installed only in Service with its own Identity and writable owned state. It refuses bearer Auth guards, webhook ingress and JWT-only Required-user template combinations (Favorites, Rate limiter, Multipart uploads); session forwarding requires a declared matching-Identity bearer-guard callee as described above. Sign-in Required/Optional, idle expiry60..86400s, absolute expiry60..604800s (idle<=absolute), guest context and offline-access requests are normal supported choices. Optional absent identity is anonymous; every supplied invalid/expired cookie refuses401 and clears it, including background product requests. Required product routes refuse absent identity. Bootstrap GET login/callback/session and POST logout are generated explicit exceptions; GET session without identity returns signedIn:false even on Required tiles.

${model.selections.some((s) => s.identity?.provider === "auth0") ? "For Auth0, see deploy/README.md for this export's exact confidential browser client environment names, HTTPS callback/logout URLs, audience and private secret files. The Auth0 logout POST clears the shared local session and returns a provider logout URL for browser navigation." : `For lead sign-in on browser-api bound to Identity identity, configure JEEVES_BROWSER_IDENTITY_IDENTITY_ISSUER as the selected Keycloak realm's trusted HTTPS URL ending exactly /realms/identity, and JEEVES_BROWSER_SIGN_IN_CALLBACK as the exact registered HTTPS public callback ending /modules/sign-in/callback (including the public edge prefix when used). The compiled confidential client is jeeves-browser-browser-api-sign-in; register code flow, S256 and the exact callback. Other names derive from stable host/module/Identity IDs. Optional JEEVES_BROWSER_SIGN_IN_AUDIENCE is one bounded audience parameter, never an arbitrary URL-parameter map. Offline access adds only the offline_access scope. Client secret is read privately from SECRET_DIR/jeeves-browser-sign-in-client-secret, and the RG08 ring from SECRET_DIR/jeeves-browser-sign-in-keys; their absolute overrides are JEEVES_SECRET_JEEVES_BROWSER_SIGN_IN_CLIENT_SECRET_FILE and JEEVES_SECRET_JEEVES_BROWSER_SIGN_IN_KEYS_FILE. SECRET_DIR defaults to /run/secrets. The selected Identity/client registration and HTTPS front doors are explicit required integration work: local plain-HTTP Keycloak/edge defaults cannot supply secure cookies, and export does not provision production TLS or a different provider. Invalid configuration fails before any client. No insecure/test-clock production switch exists.`}

Routes under /modules/<lead>: GET /login accepts only a single bounded safe relative returnTo and redirects with code+PKCE/state/nonce; GET /callback atomically consumes the ten-minute database transaction bound to its unique browser cookie before exchanging the code once. Reuse, wrong browser, expired state, nonce/PKCE/signature/issuer/audience mismatch refuse. A failed/uncertain exchange requires a new login; it never retries the grant. Issuer discovery/signature/JWKS validation is openid-client6.8.9, RS256, HTTPS-only with fixed3s network and256KiB streamed response bounds;32 actual pending exchanges retain capacity past caller cancellation. Startup issuer outage fails readiness/startup. Safe metadata probes recover readiness after known later outage; local identity lookup needs no issuer round trip. No user-info request is issued.

Opaque256-bit session cookies are __Host-jeeves-<lead>-session with Secure, HttpOnly, Path=/, SameSite=Lax and bounded Max-Age; there is no Domain option. Only a hash reaches protected054 state; append-only055 adds private refresh coordination. Persisted namespaces include compiled Identity as well as owned store/owner/module; login/session rows and private seals additionally bind the exact issuer URL and client. Changing either authority never authenticates retained cookies or consumes retained login transactions. Revoke/drain the old compiled scope with its old export before changing the Identity link, then migrate/clean retained state explicitly; display-label renames preserve scope. Every successful login chooses a fresh cookie and atomically revokes its supplied previous session. Sealed access/refresh/ID material uses private RG08 purposes and namespace/session/field binding. Retained keys read/current keys write; removed keys invalidate sessions. Identity facts only (bounded subject/email/name) reach existing immutable caller DTOs. These sessions authenticate local browser operations independently of issuer access-token lifetime. A private generated refresh boundary coordinates provider-token availability for declared request-scoped forwarding; product hooks and public refresh routes cannot consume credentials. Local identity remains independent of forwarding availability. Idle seconds and absolute deadline persist per session; a later shorter policy does not erase an earlier session's declared bounds. Database expiry/revocation is irreversible and erases sealed material; no clock-return concession exists.

Private refresh protocol: a committed per-session attempt marker precedes dispatch. A second transaction reacquires the bounded row lock and rechecks authority, generation, token freshness and its exact attempt before one openid-client refreshTokenGrant. Waiters coordinate without repeating a dispatched callback and reuse the committed winner. The issuer call deliberately holds this per-session lock; product local transactions still cannot call the network. Lock waits are4500ms, statement bounds5000ms, private client query timeout5500ms, idle-in-transaction5000ms, SDK/transport3000ms and the entire internal attempt6500ms including completion. A hard watchdog destroys its checked-out connection;32 actual pending attempts retain capacity past caller cancellation, including unresolved connects. No global lock, advisory lock or new service is used. Freshness is checked with store time after the lock; the10s margin exceeds the internal budget, and token expiry anchors to authoritative store time read before dispatch, so transport cannot extend it. Refresh grants require expires_in>20s and<=604800s; shorter successful grants remain uncertain without a rotation loop.

Browser cancellation while waiting prevents a new token POST. Once dispatched, recording received tokens uses the independent bounded internal budget despite browser disconnect, while process shutdown still cancels and remains bounded. Confirmed invalid_grant revokes/erases material and requires sign-in. A known OAuth temporary/provider refusal preserves the session and clears its safe attempt marker; availability failure is distinct from401. A lost/malformed/unknown token response retains durable uncertainty and never automatically repeats that token POST. Completion rollback/crash leaves the pre-dispatch marker uncertain; the lock/version cannot recover credentials lost after provider rotation. A committed new generation is reused after a lost COMMIT response. If the new credential is lost, reauthentication may be required. Uncertainty affects provider-token availability, not otherwise valid local identity. Refreshed optional ID-token claims must retain the stored subject and selected issuer/client; omitted refresh/ID tokens retain existing material, resealed with current keys. Revoked/expired/changed-authority/removed-key sessions cannot be restored by late credentials. No session-based background user authority is introduced.

GET /session returns safe identity and a CSRF proof, never tokens or cookie secrets. With Guest cookie context enabled it also establishes an expiring signed HttpOnly guest cookie and exposes only its stable opaque hash as caller.guest.id. Stateful unsafe requests require exact Origin plus X-CSRF-Token bound to the active session or guest context; a guest mutation without prior bootstrap refuses. A session supersedes guest identity; callback/session clears the guest cookie. POST /logout requires that same policy when a browser context is supplied; a truly cookieless request is204 with no Set-Cookie mutation. Supplied invalid identity is never anonymous. Common HTTP adapters enforce no-store and no-referrer, classified refusal statuses and cookie clears even when a product formatter changes the error body.

Owning-service revocation is the generated internal command node dist/operations/<process>-<lead>-revoke-subject.js <subject>. It revokes every currently existing local session in that compiled owner/module scope and drops sealed material, under the process's precise framework credentials; it requires no reachable issuer. This is local session invalidation, not issuer-wide logout, account deletion or a permanent sign-in ban. Product code never receives session-table, transaction, token or cookie controls. Protected054 and independent bounded maintenance are separate from product SQL/product credentials; co-owner Workers acquire no session grant merely by sharing ownership.

Generic Jeeves webhook v1: send exactly one X-Jeeves-Timestamp header containing canonical positive decimal Unix seconds (1..12 digits, no leading zero, whitespace, sign or fraction), and exactly one X-Jeeves-Signature header containing v1= followed by 64 lowercase hexadecimal characters. Duplicate/combined headers refuse. Derive 32 HMAC key bytes with HKDF-SHA256: input key is each decoded RG08 ring key, salt is UTF-8 jeeves.keys.v1, info is the exact UTF-8 JSON string ["sign","jeeves.webhook.v1"]. HMAC-SHA256 signs the concatenation of UTF-8 jeeves-webhook-v1, LF, stable module ID, LF, the exact timestamp header, LF, then the exact raw HTTP body bytes. There is no trailing delimiter, JSON canonicalization, text conversion, compression or BOM removal. All 1..8 retained keys are compared with constant-time equal-length digest comparisons without a match-position early exit. Sender uses its selected key; removed keys refuse. Keep clocks synchronized within the chosen window. Legitimate redelivery outside that window must use a fresh timestamp/signature over unchanged body bytes.

Configure the receiver ring privately before any client opens: for receive-events the name is JEEVES_WEBHOOK_RECEIVE_EVENTS_KEYS, its default file is SECRET_DIR/jeeves-webhook-receive-events-keys (/run/secrets by default), and its absolute-path override is JEEVES_SECRET_JEEVES_WEBHOOK_RECEIVE_EVENTS_KEYS_FILE. Other names replace the stable module ID hyphens with underscores and uppercase. The RG08 ring format and 64 KiB/1..8-key bounds apply; restart copies after rotation. Product settings/mappers receive no key material or verifier. Supply the secret file through your local private Compose override; export contains no signing secret.

Write the module's separate .mapping.hooks.ts pure synchronous mapEvent: authenticated, bounded, immutable JSON in; exact {id,type,payload} out. Validate product payload and stable identity here. id is 1..255 printable ASCII without spaces; type is 1..128 ASCII letters/digits/dot/underscore/colon/hyphen, beginning with a letter or digit. Existing bounded JSON DTO limits apply (64KiB total,16KiB strings,4096 nodes,16 levels,1024 array members). Invalid UTF-8/JSON/DTO/mapping refuses 400 after verification; unauthenticated bodies never reach decoding/product code. There are no credentials, clients, ACK or retry controls in the mapper. Its .ts operation exports opaque durableWork = defineWebhookWork({database,id,version,integration,complete}); no public accept/status methods are exposed. complete receives validated event facts, same-database registered commands, empty account facts and an optional safe declared remote result. Protected052 work records serve as the durable inbox; no parallel lease/receipt engine is added. Private registration binds its namespace to database, logical owner, the webhook-v1 domain, compiled receiver module ID and application-chosen work ID. Public generic durable work retains its original namespace and cannot insert/claim an inbox by copying its ID; two receiver modules also remain distinct when their work IDs are copied.

After acceptance COMMIT, POST returns 202 {accepted:true,id}; this means durable acceptance, not completed business effects. A lost response/redelivery returns the same acceptance while the identity is retained, including completed/failed work. The stored identity includes SHA256 of original raw bytes plus mapped event/declared remote input. Different bytes under the same event ID refuse 409 WORK_IDENTITY_CONFLICT even if JSON decodes equivalently; the first record stays unchanged. Signature timestamps are excluded so fresh signatures can redeliver unchanged bytes. Ambiguous storage COMMIT returns 503/unknown; no speculative dispatch/early acknowledgement follows. The sender must retry with the same event identity and body.

The common durable engine owns startup/polling, recovery, DB-time leases/exact fences, final product-command drain/atomic commit, four attempts with bounded backoff, safe failure logs and completed-only cleanup. Completed identities remain seven days after completion; after cleanup they can be accepted as a new generation. Set the sender's delivery/replay horizon within that retention or add application-owned permanent product dedupe; there is no forever-dedupe claim. Accepted/unfinished/failed/unknown records are never cleaned by this lifecycle. Terminal failures remain visible in protected records and fixed work-handler failure logs; explicit operator data migration/reconciliation is required, with no reset UI. Callback/version/namespace changes require draining/resolving old intent and explicit retained-record migration. Local same-owner roles retain precise separate credentials. Remote work keeps RG15's actual compiled executing-process identity affinity, explicit workload-only callee opt-in, fixed stored recovery ticket/input, Required-user refusal and pre-effect secret-result checkpoint refusal. No separate Worker handoff, arbitrary provider, cross-database atomic completion or exactly-once remote claim is introduced.

The declared horizon bounds total original delivery, retries, quarantine/operator delay and subsequent delivery together. Event counter declares deliveryHorizonSeconds (1..604800) and keeps completed receipts seven days after database-time completion. Receipt identity is global to that consumer, independent of aggregate/date partitions; different effect-relevant mapped content conflicts. Append-only 101 receipt migration refuses pre-existing duplicate event IDs across aggregates (COUNTER_LEGACY_DUPLICATE_ID_REQUIRES_RECONCILIATION); reconcile those rows/product totals explicitly before migration. Existing applied 100 SQL stays unchanged. Legacy completed rows receive a conservative seven-day window from migration. Never edit applied migration bytes.

A standalone database-backed delivery loop may export receiptConsumer = defineReceiptConsumer<Dependencies>({database:"stateProperty",deliveryHorizonSeconds:86400,retentionSeconds:604800,map,complete}) through API v8. Event consumer has an optional owned writable state slot. map(input,messageId) returns exact {id:messageId,payload}; both input and output are bounded immutable JSON, validated synchronously in a pure scope. Omit only transport timestamps irrelevant to the effect. complete(event,commands) receives frozen mapped facts and same-database registered commands only. The generated loop bypasses the legacy entry only when this opaque declaration is present. Framework 053 consumer receipts, product-only callback role, actual issued-command drain, receipt result and durable-progress update commit together before ACK. The declaration has no raw SQL/client, network, ACK, transaction, lease or accept handle. Route modules, missing writable state and unsupported providers refuse; existing void loops remain readable with durable progress unknown.

Retention must be at least the declared horizon (finite 1..2592000s retention). Each completed receipt stores its own immutable database-time retain_until; shorter later configuration cannot erase an accepted promise. Indexed independent maintenance deletes at most 100 expired completed receipts per 15s sweep, skipping locked/unfinished rows; no ingestion-capacity guarantee follows. Cleanup backlog is an observed boolean (more eligible work), with database last-success time; failed sweeps retain the old observation. Worker heartbeat, transactionally committed last durable progress, in-flight count, broker backlog (unknown when unsupported) and stale status are separate. Heartbeats older than 45s are stale even after a quick last event. Status reads cap at 100 workers and explicitly indicate truncation. Bounded maintenance removes status rows older than one day, so missing observations are unknown, never healthy zero. Required receipt schema/grants must pass startup before subscribing; recurring observation failure can make the last record stale.

Quarantine means the existing confirmed .failed queue/topic copy, retaining original body/message identity and safe terminal code; it is not a new public administration service. Malformed/conflicting input is poison, a definitely unreachable store keeps its attempt and waits, and uncertain COMMIT is quarantined as OUTCOME_UNKNOWN. Explicit internal counter command: node dist/operations/<worker>-<counter-module>-receipts.js status, or requeue <head-message-id>. Database-backed loop stubs expose bounded status with node dist/operations/<worker>-<module>-receipt-status.js (no arguments), using the existing precise framework login without creating a worker heartbeat. Worker rows are filtered by compiled consumer ID, while cleanupScope=database-consumer-receipts explicitly covers all generic consumers in that database. They emit node dist/operations/<worker>-<module>-requeue-<index>.js <head-message-id>; it refuses absent receipt declarations. Run under the process's existing precise credentials after reconciling poison/configuration. Requeue reads one head message, requires the exact expected original ID, preserves body/identity/properties, resets only retry metadata, confirms persistence before source ACK, and closes transports. Wrong head/missing identity/OUTCOME_UNKNOWN/RECEIPT_IDENTITY_CONFLICT refuse. Lost confirmation can leave duplicate copies: receipt idempotency makes their product effects safe, with no exactly-once broker claim. Requeue is protected only inside the declared total delivery/replay horizon. After that horizon and receipt cleanup an effect may repeat; reconcile out-of-horizon deliveries before any operator action. Broker metadata does not reliably prove original age, so this command cannot infer or renew the horizon from sender timestamps. RabbitMQ is the supported internal requeue transport; Pub/Sub retains its existing provider retry/nack/ACK semantics and its emitted requeue operation explicitly refuses. Never substitute a new identity or reexecute an ambiguous external effect.

Scheduled task is supported in Service and Worker with a writable owned state slot and Runnable processes. intervalSeconds is the sole normal task control (1..604800). A Worker added from a lane includes a Scheduled task and no queue. The task module exports durableWork with its stable generated id/version and fixed seven-day retention. Write validate/complete in that scoped scaffold, use registered same-database commands, and keep retry/fence bookkeeping private. Database time selects the interval identity, a namespace transaction lock admits at most one unfinished tick across copies, and missed intervals coalesce to the current tick after existing intent settles. Execution is at least once; RG15 product-role command drain/final holder/fence/DB-time lease checks guard completion. Accepted ticks survive timers/process loss. Fixed safe logs distinguish failed/unknown halted tasks from storage unavailable. Failed/unknown tick records stop new admission until explicit migration; no normal reset/delete control exists. Interval changes keep accepted old input runnable and do not change the durable configuration digest. Handler/version/namespace changes require stopping old schedulers, draining/resolving old work, and explicitly migrating retained records or selecting a new stable work identity; incompatible retained definitions fail startup. Completed retention cannot reopen the current interval. During a mixed interval rollout either configured cadence may admit the next tick; stop old copies when a single cadence is required. Workload integrations retain same-compiled-process recovery affinity, explicit callee opt-in, Required-user refusal and secret-result checkpoint refusal. No cron, arbitrary timers, workflow language, cloud scheduler or exactly-once external claim.

Durable work is additive to API v8. Export durableWork = defineDurableWork<Input, Dependencies>({database:"databaseProperty",id:"stable-work-id",version:1,retentionSeconds:86400,maxAttempts:4,integration:null,validate,complete}) from a writable database-backed stub. validate is synchronous, pure bounded JSON; complete(input, commands, caller, remote) receives frozen DTOs and same-database registered commands only. Accept with durableWork.accept(dependencies,{key,input}); return acceptance only after it resolves. status(dependencies,key) returns scoped state/attempts/safe error, without holder/fence/input. Scope is the verified account when present, otherwise the process acceptance scope; stored subject facts authorize no remote account access. Accepted work survives process loss. A generated lifecycle-owned drain polls bounded batches independently of requests. Scheduled task modules use that same engine through compiled interval mounts; webhook ingress is a separate capability. Handler completion, issued command drain and holder/fence/unexpired database-time lease check commit together. No cross-database atomic mutation, raw SQL/client, transaction/lease/ACK control or network effect is available in complete. Captured handles also refuse. The handler may run again after failure; only the final fenced product transaction commits.

For the sole supported external mutation, set integration:{target:"declaredServiceProperty",operation:"calleeModuleId",map} and explicitly opt the callee into defineWorkloadOperation (export its opaque descriptor as localOperation; it has no public call/route methods). The target must be an actual generated authenticated ServiceTarget on a declared link. map is pure JSON mapping, persisted canonically at acceptance; remote input must be JSON, not undefined. The callee receives {processId} workload facts, independently verifies audience/caller allowlists and uses a separate workload replay scope. Required-user Auth guards cannot become workload-only targets. No saved user bearer, account impersonation, arbitrary URL/header, provider adapter or general delegation is supported. The generated /internal/work/<module> protocol owns ticket/replay enforcement independently of the arbitrary stub entrypoint; normal module calls cannot start a new ticketed mutation.

Each accepted work row has a unique generation UUID. Its remote identity remains stable across retries, holders and fences; key reuse after completed retention creates a new generation. The callee issues an opaque ticket with its own database-time deadline, using the operation retention duration. The caller MUST durably persist the selected ticket before effect dispatch. Unknown ticket-persistence COMMIT never dispatches; reclaim first reads durable state. Once selected, no replacement ticket is ever prepared, including after expiry or cleanup. Execution and replay use the same ticket, canonical input and key. The callee checks ticket ownership/input/version/expiry inside the local mutation transaction before new work. A committed retained replay may recover after expiry; an expired or missing ticket with no retained replay refuses execution. This does not compare clocks across databases. The framework prepare response supplies the validated protocol/version and declares secret handling; these values commit with the selected ticket. The initial durable-work checkpoint refuses secret:true workload operations before effect dispatch (WORK_SECRET_CHECKPOINT_UNSUPPORTED); account-authorized sealed replay remains supported. Remote results persist before local completion, so another holder can complete known results without redispatch. A timeout is unknown, not proof of no effect. Retry/backoff is finite; unrecovered external outcomes persist as unknown, never blind replay or an exactly-once external claim.

Work bookkeeping is private: 30-second database leases, batches at most25 (drain10 sequentially), 250ms doubling backoff capped30s, 1..20 attempts, and 60-second..7-day completed retention. Only expired completed work is cleaned (100 per drain); accepted/retry/running/failed/unknown records remain. Callee expired tickets are cleaned in batches1000 with replay cleanup every60s. The private caller invariant above prevents ticket cleanup from reopening an old execution window. Changing work IDs/database/owner/handler mapping or version requires an explicit application migration: drain old work with its old handler or externally review/migrate its records; configuration mismatches cannot claim old intent. Remote work configuration also binds the compiled process identity: recovery is supported across replicas of that same identity; another logical-owner role cannot claim it and colliding acceptance reports WORK_CONFIGURATION_CONFLICT. Credentials are never merged or impersonated. Local-only work remains claimable by compatible shared-owner roles. Changing a remote process identity requires explicit draining/migration. Display names do not define namespaces. Existing keys dedupe only while completed records are retained. Inputs/results are application data in the protected database, not a token/secret vault; credentials never enter those DTOs. Existing handwritten bodies are preserved; no automatic hook/data rewrite occurs. Frozen exports remain unchanged.

Cache reader exposes the installed cache-reader.read@1 contract through Custom/standalone Data access read slots. Call dependencies.<reader>.read({key}) under the received operation context; wiring supplies a handle and never invokes unfinished product operations. In-process exposure mounts no reader HTTP route. Explicit HTTP exposure preserves GET /modules/<reader>/:key and its record-only body, adds Cache-Control: no-store plus X-Jeeves-Cache-Freshness, X-Jeeves-Valid-Until (when finite), X-Jeeves-Cache-Version (when versioned). Missing records remain 404. In-process results are immutable {record, freshness, version, validUntil, source} or null; callers must recheck the absolute UTC validUntil after another awaited operation. Clocks must agree. Legacy absent freshness/exposure retains immutable-positive/http; choose versioned explicitly for mutable data and supply canonical uint64 decimal version plus finite source expiresAt policies. Existing key/codec/eligible/load/expiresAt hooks remain application-owned. The loader receives only registered read-only source queries, bound to the reader lead's stable module ID in products.json. Declare exact source product table/view grants and SELECT relations before use; the callback receives no pool/SQL/transaction authority. Policy snapshots, DTOs, codecs, keys, eligibility, versions and expiry run synchronously under pure guards. Never cache private or request-ineligible records; every waiter rechecks identity/eligibility.

The optional cache has a 150ms phase bound, no automatic retry, and a monotonic five-second bypass after failure; malformed entries bypass just that entry, healthy saturation does not trip a breaker. One unsettled cache phase blocks further cache dispatch from this reader until actual settlement; authoritative reads continue within 32 actual unsettled fills, 128 total waiting callers, 32 per compatible input/key/subject and a two-second caller bound clamped to the received budget. Timeouts remove waiters, not actual work; full capacity refuses. The first fill's context governs shared work, so its cancellation may fail compatible waiters conservatively. Coalescing is only an optimization; no correctness state lives in its map. Unknown cache-fill outcomes remain unknown internally and never retry; authoritative success may still be delivered. Cache failure logs contain classified codes, never cached record bytes.

Generated cache entries use private jeeves:reader namespaces including stable process/module/source ID, contract, freshness and TTL; product keys cannot use the reserved jeeves: prefix. Newly generated readers ignore old unnamespaced entries; no automatic key/data or hook rewrite occurs. Display renames preserve the namespace; changing TTL/freshness/identity creates a separate cache scope. Immutable positive mode permits records that never mutate, with optional record expiry. Versioned mode compares versions in the shared store, serializes canonical DTO bytes, refuses equal-version conflicting contents, and fixes validity before fill at the earlier of source expiry and authoritative-read start plus cache TTL. Hits never renew expiry. A fenced old fill recovers an eligible newer value or refuses; it never returns known-superseded data after a failed reread. This fences only while the key is retained, not after eviction, expiry or data loss; it is bounded snapshot freshness, not linearizable invalidation. Both reader modes retain the existing LRU cache contract and refuse sharing with no-eviction admission. Cross-process template calls, L1/negative caches, stale serving/refresh, general cache policies and other providers remain unavailable.

Rate limiter (when selected) is callable-only: connect a Custom/standalone Data access admission slot and call dependencies.<limiter>.admit({}) inside localOperation.admit. A Data access used as another template’s part has no standalone operation and refuses an admission link. Wiring does not complete or invoke the product operation for you. Its key hook receives only an immutable verified subject and returns 1–256 well-formed UTF-8 bytes without control characters; no request, address, forwarding header or client is supplied. Required sign-in and one required self-hosted standalone Valkey are checked. One store-TIME rolling log removes entries at or before now-window, admits at most the configured limit, and never extends expiry on denial. Success returns count/remaining/absolute resetAt/retryAfterMs=0; denial throws protected 429 with remaining wait clamped to the window at delivery and Retry-After rounded up to seconds. Saturation/unavailable decisions throw typed 503; uncertain dispatched decisions preserve unknown and never retry automatically. No per-copy fallback. Public CacheClient get/set/delete refuse the reserved literal jeeves: prefix before driver dispatch; generated admission state is private even when product cache handles share its resource. Existing application keys under that prefix need an explicit application-owned migration to a product namespace; no automatic remapping/deletion occurs. The immutable positive reader requires a separate cache because it uses LRU eviction and admission requires no eviction. Pure policy and local mutation scopes cannot call a captured admission handle or raw cache/network handle. The private coordination write is read-like only to product new-work admission, not arbitrary product writes.

All copies enforcing one policy must share stable process/module IDs, limit/window, contract and key policy. Changing IDs, limit/window or contract starts a distinct log; changing the key policy can change which log a request uses. Mixed old/new policies do not share one combined bound. Display renames preserve IDs and namespaces. Local admission Valkey uses noeviction, AOF and appendfsync always. Bounds assume a compatible store clock and retained acknowledged store state; disk/data loss or deliberate policy migration cannot preserve a lost log. Native crash/competing-process verification is separate from offline contract proof. Unsupported saved algorithm/store/key/provider choices require explicit migration; headers never establish address trust.

The framework validates authentication, key and bounded input, normalizes validated JSON (preserving absent versus null input) and computes canonical identity from it and stable process/module/operation/version, recovers committed replay before admission, then takes a transaction advisory lock and checks replay again. Competing holders refuse 409 IDEMPOTENCY_IN_PROGRESS; changed input conflicts 409; a still-retained expired row refuses 410. Retention is mandatory, 60 seconds through seven days. Once cleanup removes an expired committed row, the key is reusable; clients must not rely on replay beyond that horizon. Successful 2xx status and a JSON body up to 12 KiB commit with all product commands and mandatory codec/version/secret/retention metadata. Failure or invalid result rolls back both. Secret replay is AES-GCM sealed using private jeeves.replay.v1 keys bound to account/operation/key/input identity; ciphertext/key material never reaches product hooks or logs. Configure the private ring through JEEVES_SECRET_JEEVES_REPLAY_KEYS_FILE or SECRET_DIR/jeeves-replay-keys; mount it through your compose.override.yaml. Missing/invalid keys fail before connections, and the ring is snapshotted once. Rotate by restarting with the new key first and retained old keys; removed keys fail replay closed. No key handle is supplied to product policy.

The whole mutation callback runs under the product-only database role. Its commands close and all actual issued work settles before RESET ROLE and protected replay storage; caught command failures poison the transaction. Captured ordinary database handles refuse even for the same database, and captured service/queue/cache/object/search handles refuse network dispatch, including nested reads. Cross-database atomicity, external effects, automatic callback retries and distributed transactions are unavailable. A lost COMMIT response remains unknown; retrying the same identity recovers the durable replay without repeating the local mutation. The original connection stays owned until actual completion. The append-only 051 migration adds replay metadata without rewriting applied 050 SQL or records. Runtime-owned cleanup starts independently of traffic, every 60 seconds, at most 1,000 expired committed rows per sweep, with advisory coordination and SKIP LOCKED; status-zero/locked active work is never removed.

Stable identity protection also applies when the extension API version is unchanged: update refuses removed/replaced process, selection, target, resource or caller namespaces. Label edits preserve them. Snapshot Undo/import can restore historical IDs but never migrates an existing exported app. Export to a fresh directory and migrate application/data explicitly; --ack-extension-api cannot bypass this refusal.

API v4 unifies HTTP errors through one runtime classification. Every HTTP process imports the application-owned synchronous body formatter from src/http-errors.hooks.ts; it receives only frozen public status/code/message/retryability and request/correlation IDs. It cannot change status or mandatory headers; invalid/throwing/async/oversized output falls back safely. Keep this shared file and its imports pure; the offline boundary check follows them. When migrating older HTTP hooks, acknowledge the reported target API version, preserve existing bodies and add the formatter scaffold explicitly. Returned error bodies are replaced with generated safe defaults. Only genuine pre-dispatch admission refusal carries Retry-After: 1; a deadline, unknown outcome or generic failure never authorizes blind replay. Token/claim/signature failure is 401 with WWW-Authenticate: Bearer; unavailable JWKS/native read dependencies are 503.

HTTP /livez answers 200 while the process can answer requests, including drain. /readyz and the compatibility alias /healthz answer 200 only after successful initialization/listen, and 503 during drain. These routes bypass product admission/guards. Required dependency startup failure never becomes ready; this is not a continuous deep dependency probe. Structured completion/failure lines carry safe route patterns (no URL/query), status/code and request/correlation IDs; credentials, bodies and original exceptions are excluded. Process/HTTP drain milestones record admission stop, cancellation and completion within the existing final bound.

Generated HttpRoutes declarations support only 1 KiB, 16 KiB, 64 KiB and 1 MiB body limits (64 KiB default), enforced by Fastify before buffering beyond the bound. rawBody: true retains bytes as body/rawBody without JSON decoding for JSON, text or binary ingress. The operation budget starts after headers in onRequest; a stalled body gets the classified deadline response and unread input closes after flush. Expiry is rechecked before handler dispatch. Default routes still decode JSON/text. This is an internal generated adapter declaration, not a normal inspector setting or webhook authentication/storage.

API v3 adds runtime-owned OperationContext to ModuleRequest and ModuleMessage. Migrate application-created request/message values and test fixtures to supply the received context; keep its live signal and pass the received object through in-process calls. Context facts are immutable: request/correlation identity, verified caller facts, cancellation and remainingMs(). Only remaining durations are forwarded, clamped by the receiver (x-jeeves-remaining-ms); correlation uses x-correlation-id. HTTP retains its configured maximum. Queue delivery gets a fresh 30-second execution budget, ignoring any originating request deadline.

Adapters refuse dispatch after expiry/cancellation. OperationError.outcome distinguishes refused, definite-failure and unknown; a timed-out mutation/publish or lost COMMIT response is unknown even if cancellation or ROLLBACK was attempted. PostgreSQL/amqplib/Pub/Sub cannot cancel an already dispatched operation through the installed promise APIs; its actual driver promise remains tracked through drain. Fetch/S3/OpenSearch request cancellation is best effort. Publisher attributes have at most 32 entries, 64-byte names, 1024-byte values and 8192 total bytes; messageId is 1–128 safe ASCII characters and must remain stable during recovery. Runtime correlation/identity fields are reserved. SDK mutation retries are disabled. Private target transport allows only its declared origin, disables redirect following and credential overrides, and buffers at most 64 KiB of response data. Raw SQL and arbitrary external targets remain unavailable; registered product operations use the v7 boundary. Authenticated route-stub calls use the v8 boundary.

Unknown queue effects are sent to .failed with OUTCOME_UNKNOWN instead of intentionally retried by the current runner. This is not durable recovery: a crash/broker redelivery can still repeat an unguarded Custom effect. Such effects require an actual installed idempotency/recovery binding and remain unsupported custom gaps until explicitly migrated to it. Do not blindly replay them. The process waits for actual unsettled driver operations until its existing 10-second final shutdown bound; termination never establishes rollback or absence of an effect.

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

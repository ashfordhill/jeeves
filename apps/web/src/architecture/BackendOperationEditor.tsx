import {
  type Architecture,
  type BackendOperation,
  type BackendReference,
  backendEntityFields,
  backendQuerySources,
  contractKey,
  type DesignDocument,
} from "@jeeves/spec";
import { Checkbox, NativeSelect, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { BackendActionEditor, type BehaviorNavigation } from "./BackendActionEditor.tsx";
import {
  Count,
  type DataNavigation,
  DataRows,
  exact,
  Many,
  namedOptions,
  Pick,
  RecordHeader,
} from "./BackendFields.tsx";
import {
  type BehaviorContext,
  GuardFields,
  inputPaths,
  inputValue,
  operationContract,
  ValueMappings,
  ValueSourceFields,
} from "./BehaviorValueFields.tsx";

export function providedOperations(
  draft: Architecture,
  owner: BackendOperation["target"]["owner"],
) {
  const seen = new Set<string>();
  return (draft.interfaces ?? [])
    .filter(
      (i) => i.direction === "provided" && i.owner.kind === owner.kind && i.owner.id === owner.id,
    )
    .flatMap((i) =>
      (
        draft.contracts?.find((c) => contractKey(c) === contractKey(i.contract))?.shape
          ?.operations ?? []
      ).flatMap((o) => {
        const value = `${contractKey(i.contract)}/${o.id}`;
        if (seen.has(value)) return [];
        seen.add(value);
        return [
          {
            value,
            label: `${i.name} · ${o.name} · ${contractKey(i.contract)} / ${o.id}`,
            target: { contract: exact(i.contract), operation: o.id, owner },
          },
        ];
      }),
    );
}
export function commandKeyPolicy(
  key: string[],
  hashInputs: string[][],
): Extract<BackendOperation["idempotency"], { kind: "command-key" }> {
  return {
    kind: "command-key",
    key,
    identity: "operation-version-scope-principal-key",
    hash: "canonical-normalized-input-sha256",
    hashInputs,
    retentionSeconds: 604800,
    publishedWindow: true,
    expired: "new-command",
    receipt: "terminal-result-in-same-transaction",
    concurrent: "one-writer-bounded-wait-or-retry",
    replay: "current-policy-before-result",
    cleanup: "separate-controlled-policy",
  };
}
export function BackendOperationEditor({
  design,
  draft,
  operation: o,
  onChange,
  navigate,
  onNavigate,
  onInspect,
  sectionRequest,
}: {
  design: DesignDocument;
  draft: Architecture;
  operation: BackendOperation;
  onChange: (v: BackendOperation) => void;
  navigate: DataNavigation;
  onNavigate: BehaviorNavigation;
  onInspect: () => void;
  sectionRequest?: { section: string };
}) {
  const [section, setSection] = useState("target");
  useEffect(() => {
    if (sectionRequest) setSection(sectionRequest.section);
  }, [sectionRequest]);
  const model = draft.backend;
  const aggregate = model?.aggregates.find((a) => contractKey(a) === contractKey(o.aggregate));
  const entities = model?.entities ?? [];
  const root = entities.find((e) => aggregate && contractKey(e) === contractKey(aggregate.root));
  const ctx: BehaviorContext = { design, draft, operation: o, navigate };
  const contract = operationContract(ctx);
  const wire = contract?.shape?.operations.find((w) => w.id === o.target.operation);
  const query = model?.queries?.find((q) => o.query && contractKey(q) === contractKey(o.query));
  const querySources = query
    ? backendQuerySources({ ...design, architecture: draft }, query)
    : undefined;
  const update = (p: Partial<BackendOperation>) => onChange({ ...o, ...p });
  const fields = entities.flatMap((e) =>
    backendEntityFields({ ...design, architecture: draft }, e).map((f) => ({
      value: `${contractKey(e)}/${f.id}`,
      label: `${e.name} · ${f.name}`,
      ref: { entity: exact(e), field: f.id },
    })),
  );
  const policyFields = (
    access: BackendOperation["access"],
    change: (v: BackendOperation["access"]) => void,
    resource: BackendReference | undefined,
    label: string,
  ) => (
    <>
      <Pick
        label={`${label} policy`}
        value={access.policy.reference ? contractKey(access.policy.reference) : ""}
        options={namedOptions(
          (model?.accessPolicies ?? []).filter(
            (p) => resource && contractKey(p.resource) === contractKey(resource),
          ),
        )}
        onChange={(key) => {
          const p = model?.accessPolicies?.find((p) => contractKey(p) === key);
          change({
            ...access,
            policy: p ? { kind: "policy", reference: exact(p) } : { kind: "unresolved" },
            readProjection: undefined,
            writeProjection: undefined,
          });
        }}
        onOpen={() => {
          if (access.policy.reference) navigate("policies", contractKey(access.policy.reference));
        }}
      />
      <Pick
        label={`${label} action`}
        value={access.action}
        options={[
          ...new Set(
            model?.accessPolicies
              ?.find(
                (p) =>
                  access.policy.reference &&
                  contractKey(p) === contractKey(access.policy.reference),
              )
              ?.rules.flatMap((r) => r.actions) ?? [],
          ),
        ].map((value) => ({ value, label: value }))}
        onChange={(action) => change({ ...access, action })}
      />
      {(["read", "write"] as const).map((mode) => (
        <Pick
          key={mode}
          label={`${label} ${mode} projection`}
          value={access[`${mode}Projection`] ?? ""}
          options={(
            model?.accessPolicies?.find(
              (p) =>
                access.policy.reference && contractKey(p) === contractKey(access.policy.reference),
            )?.projections ?? []
          )
            .filter((p) => p.mode === mode)
            .map((p) => ({ value: p.id, label: p.id }))}
          onChange={(value) => change({ ...access, [`${mode}Projection`]: value || undefined })}
        />
      ))}
    </>
  );
  return (
    <Stack gap="sm">
      <RecordHeader label="Command" name={o.name} version={o.version} onChange={update} />
      <Text size="xs">
        Exact operation: {contractKey(o)} · {contractKey(o.target.contract)} / {o.target.operation}
      </Text>
      <NativeSelect
        label="Command section"
        value={section}
        data={[
          { value: "target", label: "Target & aggregate" },
          { value: "access", label: "Current access & participants" },
          { value: "guards", label: "Finite guards" },
          { value: "actions", label: "Ordered actions & declared writes" },
          { value: "transaction", label: "Identity, concurrency & transaction" },
          { value: "retry", label: "Idempotency & cancellation" },
          { value: "outcomes", label: "Declared outcomes & mappings" },
          ...(o.kind === "query" ? [{ value: "query", label: "Bounded query inputs" }] : []),
        ]}
        onChange={(e) => setSection(e.currentTarget.value)}
      />
      {section === "target" ? (
        <>
          <Pick
            label="Provided command target"
            value={`${contractKey(o.target.contract)}/${o.target.operation}`}
            options={providedOperations(draft, o.target.owner)}
            onChange={(key) => {
              const t = providedOperations(draft, o.target.owner).find((t) => t.value === key);
              if (t) update({ target: t.target });
            }}
            onOpen={onInspect}
          />
          <Pick
            label="Command aggregate"
            value={contractKey(o.aggregate)}
            options={namedOptions(model?.aggregates ?? [])}
            onChange={(key) => {
              const a = model?.aggregates.find((a) => contractKey(a) === key);
              if (a) update({ aggregate: exact(a) });
            }}
            onOpen={() => navigate("aggregates", contractKey(o.aggregate))}
          />
          <NativeSelect
            label="Executable intent"
            data={["command", "query"]}
            value={o.kind}
            onChange={(e) => {
              const kind = e.currentTarget.value as BackendOperation["kind"];
              update({
                kind,
                transaction: { ...o.transaction, kind: kind === "query" ? "read-only" : "local" },
                ...(kind === "query"
                  ? {
                      actions: [],
                      writes: [],
                      identity: undefined,
                      expectedVersion: { kind: "none" },
                      idempotency: { kind: "read-only" },
                      cancellation: { ...o.cancellation, startsWork: false },
                    }
                  : {
                      query: undefined,
                      queryInputs: undefined,
                      idempotency: commandKeyPolicy(["unselected"], []),
                    }),
              });
            }}
          />
          <Text size="sm">
            Target operations are exact provided contracts of this owner. Contract shapes and
            declared outcome meanings are inspected separately. Changing a selection does not
            retarget other consumers or repair its mappings.
          </Text>
        </>
      ) : null}
      {section === "access" ? (
        <>
          {policyFields(
            o.access,
            (access) => update({ access }),
            aggregate?.root,
            "Command access",
          )}
          <Text size="sm">
            The root policy never grants access to a private child. Each written or observed child
            needs its own current policy and projections, including replay.
          </Text>
          <DataRows<NonNullable<BackendOperation["access"]["participants"]>[number]>
            label="Participant access"
            rows={o.access.participants ?? []}
            max={30}
            create={() => ({
              entity: exact(aggregate?.children[0] ?? root ?? { id: "unselected", version: "v1" }),
              policy: { kind: "unresolved" },
              action: o.access.action,
            })}
            onChange={(participants) => update({ access: { ...o.access, participants } })}
          >
            {(p, i, change) => (
              <>
                <Pick
                  label={`Participant ${i + 1} entity`}
                  value={contractKey(p.entity)}
                  options={namedOptions(entities)}
                  onChange={(key) => {
                    const e = entities.find((e) => contractKey(e) === key);
                    if (e) change({ ...p, entity: exact(e) });
                  }}
                  onOpen={() => navigate("entities", contractKey(p.entity))}
                />
                {policyFields(p, (v) => change({ ...p, ...v }), p.entity, `Participant ${i + 1}`)}
              </>
            )}
          </DataRows>
        </>
      ) : null}
      {section === "guards" ? (
        <GuardFields guards={o.guards} onChange={(guards) => update({ guards })} context={ctx} />
      ) : null}
      {section === "actions" ? (
        <>
          <BackendActionEditor
            context={ctx}
            actions={o.actions}
            onChange={(actions) => update({ actions })}
            onNavigate={onNavigate}
          />
          <Many
            label="Declared write fields"
            value={o.writes.map((w) => `${contractKey(w.entity)}/${w.field}`)}
            options={fields}
            max={100}
            onChange={(values) =>
              update({ writes: fields.filter((f) => values.includes(f.value)).map((f) => f.ref) })
            }
          />
          <Text size="sm">
            Declare every finite action writer, including the lifecycle state and server version
            writer. Shared validation checks exact agreement and one writer per field. External
            calls stay outside the local transaction.
          </Text>
        </>
      ) : null}
      {section === "transaction" ? (
        <>
          <ValueMappings
            label="Root identity"
            rows={o.identity ?? []}
            options={root?.primaryKey.map((value) => ({ value, label: value })) ?? []}
            context={ctx}
            max={10}
            onChange={(identity) => update({ identity: identity.length ? identity : undefined })}
          />
          <NativeSelect
            label="Expected version source"
            value={o.expectedVersion.kind}
            data={[
              { value: "none", label: "None · row locking / read only" },
              { value: "input", label: "Typed input · optimistic CAS" },
            ]}
            onChange={(e) =>
              update({
                expectedVersion:
                  e.currentTarget.value === "input"
                    ? { kind: "input", path: ["unselected"] }
                    : { kind: "none" },
              })
            }
          />
          {o.expectedVersion.kind === "input" ? (
            <Pick
              label="Expected version input"
              value={o.expectedVersion.path.join("/")}
              options={inputPaths(ctx)}
              onChange={(p) => update({ expectedVersion: { kind: "input", path: p.split("/") } })}
            />
          ) : null}
          <Text size="sm">
            Aggregate concurrency: {aggregate?.concurrency.kind ?? "unresolved"}. Optimistic
            commands require the typed expected version and exactly one root version writer; inserts
            expect 0 and start at 1. Row locks use entity-ID / primary-key order.
          </Text>
          <NativeSelect
            label="Transaction kind"
            value={o.transaction.kind}
            data={["local", "read-only"]}
            onChange={(e) =>
              update({
                transaction: {
                  ...o.transaction,
                  kind: e.currentTarget.value as typeof o.transaction.kind,
                },
              })
            }
          />
          <Pick
            label="Transaction authority store"
            value={o.transaction.store}
            options={design.elements.map((e) => ({ value: e.id, label: e.name }))}
            onChange={(store) => update({ transaction: { ...o.transaction, store } })}
          />
          <Many
            label="Transaction participants"
            value={o.transaction.participants.map(contractKey)}
            options={namedOptions(entities)}
            max={31}
            onChange={(values) =>
              update({
                transaction: {
                  ...o.transaction,
                  participants: entities.filter((e) => values.includes(contractKey(e))).map(exact),
                },
              })
            }
          />
          <Text size="sm">
            Fixed contract: single connection; no external I/O; access rechecked against current
            state in the transaction; aggregate concurrency; confirmed local failure rolls back;
            disconnect may leave commit unknown. These guarantees are design requirements.
          </Text>
        </>
      ) : null}
      {section === "retry" ? (
        <>
          <NativeSelect
            label="Idempotency mode"
            value={o.idempotency.kind}
            data={["command-key", "read-only"]}
            onChange={(e) =>
              update({
                idempotency:
                  e.currentTarget.value === "read-only"
                    ? { kind: "read-only" }
                    : commandKeyPolicy(["unselected"], []),
              })
            }
          />
          {o.idempotency.kind === "command-key" ? (
            <>
              <Pick
                label="Command key input"
                value={o.idempotency.key.join("/")}
                options={inputPaths(ctx)}
                onChange={(p) => {
                  if (o.idempotency.kind === "command-key")
                    update({ idempotency: { ...o.idempotency, key: p.split("/") } });
                }}
              />
              <Many
                label="Canonical hash input fields"
                value={o.idempotency.hashInputs.map((p) => p.join("/"))}
                options={(wire?.input ?? []).map((f) => ({ value: f.id, label: f.name }))}
                max={40}
                onChange={(values) => {
                  if (o.idempotency.kind === "command-key")
                    update({
                      idempotency: { ...o.idempotency, hashInputs: values.map((v) => [v]) },
                    });
                }}
              />
              <Count
                label="Published replay window (seconds)"
                value={o.idempotency.retentionSeconds}
                min={1}
                max={31536000}
                onChange={(retentionSeconds) => {
                  if (o.idempotency.kind === "command-key")
                    update({ idempotency: { ...o.idempotency, retentionSeconds } });
                }}
              />
              <Text size="sm">
                Identity includes operation version, authenticated scope, principal and key. Key is
                required bounded text (1–200). SHA-256 covers all normalized top-level inputs except
                the distinct key once. One writer, bounded wait/retry; changed inputs conflict.
                Terminal receipt and mutation share a commit. Recheck current policy before replay;
                expired keys are new commands; cleanup is separately controlled.
              </Text>
            </>
          ) : null}
          <Checkbox
            label="Command starts work"
            checked={o.cancellation.startsWork}
            onChange={(e) =>
              update({ cancellation: { ...o.cancellation, startsWork: e.currentTarget.checked } })
            }
          />
          <Count
            label="Cooperative cancellation deadline (seconds)"
            value={o.cancellation.deadlineSeconds}
            min={1}
            max={3600}
            onChange={(deadlineSeconds) =>
              update({ cancellation: { ...o.cancellation, deadlineSeconds } })
            }
          />
          <Text size="sm">
            Cancellation before commit rolls back; after commit it preserves the committed or
            unknown result. This declaration supplies no worker, forced interruption or external
            cancellation.
          </Text>
        </>
      ) : null}
      {section === "outcomes" ? (
        <>
          <Text size="sm">
            Map finite triggers to exact declared wire outcomes. Missing decisions remain findings.
            Unknown commit requires Failure / Unknown / Reconcile first; pre-commit cancellation
            stays unchanged.
          </Text>
          <DataRows<BackendOperation["outcomes"][number]>
            label="Command outcome"
            rows={o.outcomes}
            max={20}
            create={() => ({
              outcome: wire?.outcomes?.[0]?.id ?? "unselected",
              trigger: "success",
              values: [],
            })}
            onChange={(outcomes) => update({ outcomes })}
          >
            {(v, i, change) => {
              const outcome = wire?.outcomes?.find((w) => w.id === v.outcome);
              const success = v.trigger === "success" || v.trigger === "unchanged";
              return (
                <>
                  <NativeSelect
                    label={`Outcome ${i + 1} trigger`}
                    value={v.trigger}
                    data={[
                      "success",
                      "unchanged",
                      "conflict",
                      "rejected",
                      "failed",
                      "unavailable",
                      "cancelled",
                      "uncertain",
                    ]}
                    onChange={(e) =>
                      change({ ...v, trigger: e.currentTarget.value as typeof v.trigger })
                    }
                  />
                  <Pick
                    label={`Outcome ${i + 1} declaration`}
                    value={v.outcome}
                    options={(wire?.outcomes ?? []).map((w) => ({
                      value: w.id,
                      label: `${w.name} · ${w.kind} / ${w.state} / ${w.retry} · ${w.id}`,
                    }))}
                    onChange={(outcome) => change({ ...v, outcome })}
                    onOpen={onInspect}
                  />
                  {outcome ? (
                    <Text size="sm">
                      {outcome.condition} · HTTP {outcome.status ?? "unspecified"}
                    </Text>
                  ) : null}
                  <ValueMappings
                    label={`Outcome ${i + 1} value`}
                    rows={v.values}
                    options={(outcome?.payload ?? (success ? wire?.output : []) ?? []).map((f) => ({
                      value: f.id,
                      label: `${f.name} · ${f.type}`,
                    }))}
                    max={40}
                    onChange={(values) => change({ ...v, values })}
                    context={{ ...ctx, before: success ? o.actions.length : 0 }}
                  />
                </>
              );
            }}
          </DataRows>
        </>
      ) : null}
      {section === "query" ? (
        <>
          <Pick
            label="Read-only bounded query"
            value={o.query ? contractKey(o.query) : ""}
            options={namedOptions(model?.queries ?? [])}
            onChange={(key) => {
              const q = model?.queries?.find((q) => contractKey(q) === key);
              update({ query: q ? exact(q) : undefined });
            }}
            onOpen={() => {
              if (o.query) navigate("queries", contractKey(o.query));
            }}
          />
          <DataRows<NonNullable<BackendOperation["queryInputs"]>[number]>
            label="Query input"
            rows={o.queryInputs ?? []}
            max={20}
            create={() => ({
              filter: query?.filters[0]?.id ?? "unselected",
              operator: "eq",
              value: inputValue(),
            })}
            onChange={(queryInputs) => update({ queryInputs })}
          >
            {(v, i, change) => (
              <>
                <Pick
                  label={`Query input ${i + 1} filter`}
                  value={v.filter}
                  options={(query?.filters ?? []).map((f) => ({
                    value: f.id,
                    label: `${querySources?.get(f.field.source)?.entity.name ?? f.field.source} · ${f.field.field} · ${f.id}`,
                  }))}
                  onChange={(filter) => change({ ...v, filter })}
                />
                <NativeSelect
                  label={`Query input ${i + 1} comparison`}
                  value={v.operator}
                  data={query?.filters.find((f) => f.id === v.filter)?.comparisons ?? [v.operator]}
                  onChange={(e) => {
                    const operator = e.currentTarget.value as typeof v.operator;
                    change({
                      ...v,
                      operator,
                      value: operator === "is-null" ? undefined : (v.value ?? inputValue()),
                    });
                  }}
                />
                {v.operator !== "is-null" ? (
                  <ValueSourceFields
                    label={`Query input ${i + 1}`}
                    value={v.value ?? inputValue()}
                    context={ctx}
                    onChange={(value) => change({ ...v, value })}
                  />
                ) : null}
              </>
            )}
          </DataRows>
        </>
      ) : null}
    </Stack>
  );
}

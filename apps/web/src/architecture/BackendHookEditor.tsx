import {
  type Architecture,
  type BackendHook,
  backendEntityFields,
  contractKey,
  type DesignDocument,
  validateBackendEffectsTransition,
} from "@jeeves/spec";
import { Button, Checkbox, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import {
  type BackendNavigation,
  ExactPick,
  missingReference,
  operationOutcomes,
  RecoveryFields,
  ReferenceLinks,
} from "./BackendEffectFields.tsx";
import {
  Count,
  DataRows,
  exact,
  Many,
  namedOptions,
  Pick,
  RecordHeader,
} from "./BackendFields.tsx";

export function hookProtected(design: DesignDocument, hook: BackendHook) {
  const next = structuredClone(design);
  if (!next.architecture?.backend) return false;
  next.architecture.backend.hooks = next.architecture.backend.hooks?.filter(
    (h) => contractKey(h) !== contractKey(hook),
  );
  return validateBackendEffectsTransition(design, next).some(
    (f) => f.target.path?.[3] === contractKey(hook),
  );
}
export function BackendHookEditor({
  design,
  draft,
  hook: h,
  onChange,
  navigate,
  sectionRequest,
}: {
  design: DesignDocument;
  draft: Architecture;
  hook: BackendHook;
  onChange: (v: BackendHook) => void;
  navigate: BackendNavigation;
  sectionRequest?: { section: string; path?: (string | number)[] };
}) {
  const [section, setSection] = useState("signature");
  useEffect(() => {
    if (sectionRequest) setSection(sectionRequest.section);
  }, [sectionRequest]);
  const locked = hookProtected(design, h),
    model = draft.backend;
  const source = model?.operations?.find((o) => contractKey(o) === contractKey(h.operation));
  const failure = model?.operations?.find(
    (o) => contractKey(o) === contractKey(h.failure.operation),
  );
  const update = (patch: Partial<BackendHook>) => onChange({ ...h, ...patch });
  const data = (draft.contracts ?? []).filter((c) => c.kind === "data");
  const refs = (keys: string[], items: { id: string; version: string }[]) =>
    keys.flatMap((key) => {
      const item = items.find((v) => contractKey(v) === key);
      return item ? [exact(item)] : [];
    });
  const fields = (model?.entities ?? []).flatMap((e) =>
    backendEntityFields({ ...design, architecture: draft }, e).map((f) => ({
      value: `${contractKey(e)}/${f.id}`,
      label: `${e.name} · ${f.name}`,
      ref: { entity: exact(e), field: f.id },
    })),
  );
  return (
    <Stack gap="md">
      <RecordHeader
        label="Hook"
        name={h.name}
        version={h.version}
        versionDisabled={locked}
        onChange={update}
      />
      <Text size="xs">
        Hook identity: {contractKey(h)} · owner {h.owner.kind} / {h.owner.id}
      </Text>
      {locked ? (
        <Text size="sm">
          Referenced hook semantics are protected. Create a successor, then deliberately retarget
          exact consumers. Display names remain editable.
        </Text>
      ) : null}
      <NativeSelect
        label="Hook section"
        value={section}
        data={[
          { value: "signature", label: "Source, signature & supplied context" },
          { value: "dependencies", label: "Dependencies & allowed proposals" },
          { value: "failure", label: "Safe unavailable & failure outcomes" },
          { value: "acceptance", label: "Acceptance & project seam" },
          { value: "recovery", label: "Failure paths & recovery" },
        ]}
        onChange={(e) => setSection(e.currentTarget.value)}
      />
      <fieldset className="backend-hook-fields" disabled={locked}>
        <legend>Hook declaration</legend>
        <Stack gap="md">
          {section === "signature" ? (
            <>
              <ExactPick
                label="Hook source command"
                value={h.operation}
                items={(model?.operations ?? []).filter((o) => o.kind === "command")}
                onChange={(operation) => {
                  const o = model?.operations?.find(
                    (o) => contractKey(o) === contractKey(operation),
                  );
                  update({
                    operation,
                    ...(o ? { owner: o.target.owner } : {}),
                    ...(h.kind === "pure" ? { failure: { ...h.failure, operation } } : {}),
                  });
                }}
              />
              <NativeSelect
                label="Hook kind"
                value={h.kind}
                data={["pure", "effectful"]}
                onChange={(event) => {
                  const kind = event.currentTarget.value as typeof h.kind;
                  update({
                    kind,
                    boundary: kind === "pure" ? "before-commit" : "after-commit",
                    failure: {
                      ...h.failure,
                      scope: kind === "pure" ? "source-transaction" : "separate-delivery-attempt",
                      operation: kind === "pure" ? h.operation : missingReference(),
                    },
                    context:
                      kind === "effectful"
                        ? [...h.context.filter((v) => v !== "service-purpose"), "service-purpose"]
                        : h.context.filter((v) => v !== "service-purpose"),
                  });
                }}
              />
              <Text size="sm">
                Boundary: {h.boundary}. Pure hooks use supplied snapshots and return validated
                proposals. Effectful hooks run through explicit after-commit effects; source state
                is already committed.
              </Text>
              {(["input", "output", "error"] as const).map((key) => (
                <ExactPick
                  key={key}
                  label={`Hook ${key} contract`}
                  value={h.contracts[key]}
                  items={data}
                  onChange={(v) => update({ contracts: { ...h.contracts, [key]: v } })}
                />
              ))}
              <Many
                label="Hook supplied context"
                value={h.context}
                options={[
                  "principal-provenance",
                  "authorized-scope",
                  "correlation",
                  "service-purpose",
                  "cancellation",
                  "deadline",
                ].map((value) => ({ value, label: value }))}
                max={6}
                onChange={(v) => update({ context: v as typeof h.context })}
              />
              <NativeSelect
                label="Hook private data"
                value={h.privateData}
                data={["none", "authorized-input-only", "current-policy-recheck"]}
                onChange={(e) =>
                  update({ privateData: e.currentTarget.value as typeof h.privateData })
                }
              />
              <Checkbox
                label="Hook is required"
                checked={h.required}
                onChange={(e) => update({ required: e.currentTarget.checked })}
              />
              <Text size="sm">
                Current policy controls observation. Initiating principal is provenance, never
                permanent authority. Required readiness is checked before any mutation.
              </Text>
            </>
          ) : null}
          {section === "dependencies" ? (
            <>
              <Many
                label="Hook dependencies"
                value={h.dependencies.map(contractKey)}
                options={namedOptions(
                  (model?.hooks ?? []).filter(
                    (v) =>
                      contractKey(v) !== contractKey(h) &&
                      contractKey(v.operation) === contractKey(h.operation),
                  ),
                )}
                max={20}
                onChange={(keys) => update({ dependencies: refs(keys, model?.hooks ?? []) })}
              />
              <Many
                label="Hook bounded repository queries"
                value={h.repositories.map(contractKey)}
                options={namedOptions(model?.queries ?? [])}
                max={20}
                onChange={(keys) => update({ repositories: refs(keys, model?.queries ?? []) })}
              />
              <Many
                label="Hook service operations"
                value={h.services.map(contractKey)}
                options={namedOptions(model?.operations ?? [])}
                max={20}
                onChange={(keys) => update({ services: refs(keys, model?.operations ?? []) })}
              />
              <Many
                label="Hook allowed effects"
                value={h.allowedEffects.map(contractKey)}
                options={namedOptions(model?.effects ?? [])}
                max={20}
                onChange={(keys) => update({ allowedEffects: refs(keys, model?.effects ?? []) })}
              />
              <Many
                label="Hook proposed write fields"
                value={h.allowedWrites.map((w) => `${contractKey(w.entity)}/${w.field}`)}
                options={fields}
                max={100}
                onChange={(keys) =>
                  update({
                    allowedWrites: keys.flatMap(
                      (key) => fields.find((v) => v.value === key)?.ref ?? [],
                    ),
                  })
                }
              />
              <Text size="sm">
                Dependencies must run earlier. Pure hooks cannot query repositories, call services
                or cause effects. Bounded repository reads require verified service purpose and
                current read projection. Source writes are validated proposals applied by explicit
                finite actions. After-commit hooks cannot write the source transaction. Cycles and
                protected field writes block Save.
              </Text>
            </>
          ) : null}
          {section === "failure" ? (
            <>
              <Pick
                label="Hook unavailable outcome"
                value={h.unavailable.outcome}
                options={operationOutcomes(draft, source)}
                onChange={(outcome) => update({ unavailable: { ...h.unavailable, outcome } })}
              />
              <NativeSelect
                label="Hook unavailable HTTP status"
                value={String(h.unavailable.status)}
                data={["501", "503"]}
                onChange={(e) =>
                  update({
                    unavailable: {
                      ...h.unavailable,
                      status: Number(e.currentTarget.value) as 501 | 503,
                    },
                  })
                }
              />
              <Text size="sm">
                Unavailable must be an exact unchanged Failure with HTTP 501 or 503 and no writes. A
                missing or malformed hook cannot report success.
              </Text>
              <ExactPick
                label="Hook failure operation"
                value={h.failure.operation}
                items={model?.operations ?? []}
                onChange={(operation) => update({ failure: { ...h.failure, operation } })}
              />
              <Text size="sm">
                Failure scope: {h.failure.scope}. Pure failures roll back the source. Effectful
                failures belong to a separate delivery attempt and preserve the source commit.
              </Text>
              {(["error", "invalidResult", "timeout", "cancelled"] as const).map((key) => (
                <Pick
                  key={key}
                  label={`Hook ${key} outcome`}
                  value={h.failure[key]}
                  options={operationOutcomes(draft, failure)}
                  onChange={(outcome) => update({ failure: { ...h.failure, [key]: outcome } })}
                />
              ))}
              <Count
                label="Hook timeout (seconds)"
                value={h.timeoutSeconds}
                min={1}
                max={3600}
                onChange={(timeoutSeconds) => update({ timeoutSeconds })}
              />
              <Text size="sm">
                Cooperative cancellation; no forced termination. Pure timeout must fit the command
                deadline. Validate the exact result contract before use; results do not write
                directly.
              </Text>
            </>
          ) : null}
          {section === "acceptance" ? (
            <>
              <DataRows<string>
                label="Hook acceptance reference"
                rows={h.acceptance}
                max={60}
                create={() => ""}
                onChange={(acceptance) => update({ acceptance })}
              >
                {(v, i, change) => (
                  <TextInput
                    label={`Hook acceptance reference ${i + 1}`}
                    maxLength={160}
                    value={v}
                    onChange={(e) => change(e.currentTarget.value)}
                  />
                )}
              </DataRows>
              <TextInput
                label="Hook project-owned TypeScript file"
                value={h.seam.file}
                maxLength={240}
                onChange={(e) => update({ seam: { ...h.seam, file: e.currentTarget.value } })}
              />
              <Text size="sm">
                Relative TypeScript file under a directory; no traversal. Scaffold once, then
                project owned. Acceptance identities name required checks; they are not pass
                records. This editor writes no implementation file.
              </Text>
            </>
          ) : null}
          {section === "recovery" ? (
            <RecoveryFields
              draft={draft}
              rows={h.recovery}
              operation={h.operation}
              focusTrigger={String(sectionRequest?.path?.[1] ?? "")}
              navigate={navigate}
              onChange={(recovery) => update({ recovery })}
            />
          ) : null}
        </Stack>
      </fieldset>
      <section aria-label="Hook reference navigation">
        <Text size="sm">Exact definitions and dependencies</Text>
        <ReferenceLinks
          label="Hook source command"
          refs={[h.operation]}
          items={model?.operations ?? []}
          kind="operations"
          navigate={navigate}
        />
        <ReferenceLinks
          label="Hook contract"
          refs={Object.values(h.contracts)}
          items={data}
          kind="contracts"
          navigate={navigate}
        />
        <ReferenceLinks
          label="Hook dependency"
          refs={h.dependencies}
          items={model?.hooks ?? []}
          kind="hooks"
          navigate={navigate}
        />
        <ReferenceLinks
          label="Hook repository query"
          refs={h.repositories}
          items={model?.queries ?? []}
          kind="queries"
          navigate={navigate}
        />
        <ReferenceLinks
          label="Hook service operation"
          refs={h.services}
          items={model?.operations ?? []}
          kind="operations"
          navigate={navigate}
        />
        <ReferenceLinks
          label="Hook allowed effect"
          refs={h.allowedEffects}
          items={model?.effects ?? []}
          kind="effects"
          navigate={navigate}
        />
        <ReferenceLinks
          label="Hook failure operation"
          refs={[h.failure.operation]}
          items={model?.operations ?? []}
          kind="operations"
          navigate={navigate}
        />
        <ReferenceLinks
          label="Recovery operation"
          refs={h.recovery.flatMap((r) => [
            r.operation,
            ...(r.reconcileOperation ? [r.reconcileOperation] : []),
          ])}
          items={model?.operations ?? []}
          kind="operations"
          navigate={navigate}
        />
        <ReferenceLinks
          label="Recovery aggregate"
          refs={h.recovery.flatMap((r) => r.invariants.map((i) => i.aggregate))}
          items={model?.aggregates ?? []}
          kind="aggregates"
          navigate={navigate}
        />
        {h.recovery.map((r) => (
          <Text size="sm" key={r.trigger}>
            {r.trigger}:{" "}
            <Button
              size="compact-xs"
              variant="default"
              onClick={() => navigate("scenarios", r.scenario.id, [r.scenario.outcome])}
            >
              Open recovery scenario {r.scenario.id} / {r.scenario.outcome}
            </Button>
          </Text>
        ))}
      </section>
    </Stack>
  );
}

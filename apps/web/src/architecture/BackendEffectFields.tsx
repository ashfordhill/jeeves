import {
  type Architecture,
  type BackendOperation,
  type BackendRecovery,
  type BackendReference,
  contractKey,
} from "@jeeves/spec";
import { Button, NativeSelect, Stack, Text } from "@mantine/core";
import {
  type DataNavigation,
  DataRows,
  exact,
  Many,
  namedOptions,
  Pick,
} from "./BackendFields.tsx";

export type BackendArea =
  | Parameters<DataNavigation>[0]
  | "operations"
  | "lifecycles"
  | "effects"
  | "hooks"
  | "scenarios";
export type BackendNavigation = (
  kind: BackendArea,
  key: string,
  path?: (string | number)[],
) => void;
export type BackendNavigationRequest = {
  kind: BackendArea;
  key: string;
  path?: (string | number)[];
};
export const missingReference = (): BackendReference => ({ id: "unselected", version: "v1" });
export function ExactPick({
  label,
  value,
  items,
  onChange,
  onOpen,
}: {
  label: string;
  value: BackendReference | undefined;
  items: (BackendReference & { name: string })[];
  onChange: (v: BackendReference) => void;
  onOpen?: () => void;
}) {
  return (
    <Pick
      label={label}
      value={value ? contractKey(value) : ""}
      options={namedOptions(items)}
      onChange={(key) =>
        onChange(exact(items.find((v) => contractKey(v) === key) ?? missingReference()))
      }
      onOpen={onOpen}
    />
  );
}
export function ReferenceLinks({
  label,
  refs,
  items,
  kind,
  navigate,
}: {
  label: string;
  refs: BackendReference[];
  items: (BackendReference & { name: string })[];
  kind: BackendArea;
  navigate: BackendNavigation;
}) {
  return (
    <Stack gap={4} role="group" aria-label={`${label} links`}>
      {refs
        .filter((r, i) => refs.findIndex((v) => contractKey(v) === contractKey(r)) === i)
        .map((r) => (
          <Button
            key={contractKey(r)}
            size="compact-xs"
            variant="default"
            onClick={() => navigate(kind, contractKey(r))}
          >
            Open {label.toLowerCase()}{" "}
            {items.find((v) => contractKey(v) === contractKey(r))?.name ?? "missing"} ·{" "}
            {contractKey(r)}
          </Button>
        ))}
    </Stack>
  );
}
export function operationOutcomes(draft: Architecture, operation: BackendOperation | undefined) {
  const wire = draft.contracts
    ?.find((c) => operation && contractKey(c) === contractKey(operation.target.contract))
    ?.shape?.operations.find((o) => o.id === operation?.target.operation);
  return (operation?.outcomes ?? []).map((o) => {
    const w = wire?.outcomes?.find((w) => w.id === o.outcome);
    return {
      value: o.outcome,
      label: `${o.outcome} · ${o.trigger} · ${w?.kind ?? "missing"} / ${w?.state ?? "missing"} / ${w?.retry ?? "missing"} · HTTP ${w?.status ?? "unspecified"}`,
    };
  });
}
export function RecoveryFields({
  draft,
  rows,
  onChange,
  navigate,
  operation,
  focusTrigger,
}: {
  draft: Architecture;
  rows: BackendRecovery[];
  onChange: (v: BackendRecovery[]) => void;
  navigate: BackendNavigation;
  operation: BackendReference;
  focusTrigger?: string;
}) {
  const model = draft.backend;
  const invariants = (model?.aggregates ?? []).flatMap((a) =>
    a.invariants.map((i) => ({
      value: `${contractKey(a)}/${i.id}`,
      label: `${a.name} · ${i.id}`,
      ref: { aggregate: exact(a), invariant: i.id },
    })),
  );
  return (
    <>
      <Text size="sm">
        Recovery links existing operation outcomes, scenario paths and aggregate invariants. Unknown
        commit or acknowledgement preserves Unknown / Reconcile first. These are design
        declarations, not observed recovery.
      </Text>
      <DataRows<BackendRecovery>
        label="Recovery"
        rows={rows}
        max={10}
        onChange={onChange}
        focusIndex={rows.findIndex((r) => r.trigger === focusTrigger)}
        create={() => ({
          trigger: "uncertain-commit",
          strategy: "same-command-key",
          operation,
          outcome: "unselected",
          scenario: { id: "unselected", outcome: "unselected" },
          invariants: [],
        })}
      >
        {(r, i, change) => {
          const source = model?.operations?.find(
            (o) => contractKey(o) === contractKey(r.operation),
          );
          const scenario = draft.scenarios?.find((s) => s.id === r.scenario.id);
          return (
            <>
              <NativeSelect
                label={`Recovery ${i + 1} trigger`}
                value={r.trigger}
                data={[
                  "uncertain-commit",
                  "lost-acknowledgement",
                  "partial-bytes",
                  "external-timeout",
                  "hook-failure",
                ]}
                onChange={(e) =>
                  change({ ...r, trigger: e.currentTarget.value as typeof r.trigger })
                }
              />
              <NativeSelect
                label={`Recovery ${i + 1} strategy`}
                value={r.strategy}
                data={[
                  "same-command-key",
                  "same-delivery-identity",
                  "reconcile-before-retry",
                  "cleanup-unattached-bytes",
                  "confirmed-rollback",
                ]}
                onChange={(e) => {
                  const strategy = e.currentTarget.value as typeof r.strategy;
                  change({
                    ...r,
                    strategy,
                    reconcileOperation:
                      strategy === "reconcile-before-retry" ? missingReference() : undefined,
                  });
                }}
              />
              <ExactPick
                label={`Recovery ${i + 1} operation`}
                value={r.operation}
                items={model?.operations ?? []}
                onChange={(operation) => change({ ...r, operation })}
                onOpen={() => navigate("operations", contractKey(r.operation), ["outcomes"])}
              />
              <Pick
                label={`Recovery ${i + 1} outcome`}
                value={r.outcome}
                options={operationOutcomes(draft, source)}
                onChange={(outcome) => change({ ...r, outcome })}
              />
              <Pick
                label={`Recovery ${i + 1} scenario`}
                value={r.scenario.id}
                options={(draft.scenarios ?? []).map((s) => ({ value: s.id, label: s.name }))}
                onChange={(id) => change({ ...r, scenario: { id, outcome: "unselected" } })}
                onOpen={() => navigate("scenarios", r.scenario.id, [r.scenario.outcome])}
              />
              <Pick
                label={`Recovery ${i + 1} scenario outcome`}
                value={r.scenario.outcome}
                options={(scenario?.outcomes ?? []).map((o) => ({
                  value: o.id,
                  label: `${o.id} · ${o.text}`,
                }))}
                onChange={(outcome) => change({ ...r, scenario: { ...r.scenario, outcome } })}
                onOpen={() => navigate("scenarios", r.scenario.id, [r.scenario.outcome])}
              />
              <Many
                label={`Recovery ${i + 1} invariants`}
                value={r.invariants.map((v) => `${contractKey(v.aggregate)}/${v.invariant}`)}
                options={invariants}
                max={20}
                onChange={(keys) =>
                  change({
                    ...r,
                    invariants: keys.flatMap(
                      (key) => invariants.find((v) => v.value === key)?.ref ?? [],
                    ),
                  })
                }
              />
              <ReferenceLinks
                label={`Recovery ${i + 1} aggregate`}
                refs={r.invariants
                  .map((v) => v.aggregate)
                  .filter(
                    (v, i, all) => all.findIndex((r) => contractKey(r) === contractKey(v)) === i,
                  )}
                items={model?.aggregates ?? []}
                kind="aggregates"
                navigate={navigate}
              />
              {r.reconcileOperation ? (
                <ExactPick
                  label={`Recovery ${i + 1} reconciliation operation`}
                  value={r.reconcileOperation}
                  items={model?.operations ?? []}
                  onChange={(reconcileOperation) => change({ ...r, reconcileOperation })}
                  onOpen={() =>
                    r.reconcileOperation &&
                    navigate("operations", contractKey(r.reconcileOperation))
                  }
                />
              ) : null}
            </>
          );
        }}
      </DataRows>
    </>
  );
}

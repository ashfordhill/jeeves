import {
  type Architecture,
  type BackendAccessBinding,
  backendEntityFields,
  backendRecheckSiteSchema,
  contractKey,
  type DesignDocument,
} from "@jeeves/spec";
import { NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import {
  type DataNavigation,
  exact,
  Many,
  namedOptions,
  Pick,
  RecordHeader,
} from "./BackendFields.tsx";
import { PayloadFields } from "./ContractFields.tsx";
export function BackendAccessUseEditor({
  design,
  draft,
  binding: b,
  onChange,
  navigate,
}: {
  design: DesignDocument;
  draft: Architecture;
  binding: BackendAccessBinding;
  onChange: (b: BackendAccessBinding) => void;
  navigate: DataNavigation;
}) {
  const entities = draft.backend?.entities ?? [];
  const resource = entities.find((e) => contractKey(e) === contractKey(b.resource));
  const policies = (draft.backend?.accessPolicies ?? []).filter(
    (p) => contractKey(p.resource) === contractKey(b.resource),
  );
  const selected = policies.find(
    (p) => b.policy.reference && contractKey(p) === contractKey(b.policy.reference),
  );
  const fields = resource ? backendEntityFields({ ...design, architecture: draft }, resource) : [];
  const operations = (draft.interfaces ?? [])
    .filter((i) => i.direction === "provided" && i.owner.kind !== "external-system")
    .flatMap((i) =>
      (
        draft.contracts?.find((c) => contractKey(c) === contractKey(i.contract))?.shape
          ?.operations ?? []
      ).map((o) => ({
        value: `${i.id}/${o.id}`,
        label: `${i.name} · ${o.name} · ${contractKey(i.contract)}`,
        target: {
          kind: "operation" as const,
          contract: exact(i.contract),
          operation: o.id,
          owner: i.owner as Extract<BackendAccessBinding["target"], { kind: "operation" }>["owner"],
        },
      })),
    );
  const target = b.target;
  const operation =
    target.kind === "operation"
      ? draft.contracts
          ?.find((c) => contractKey(c) === contractKey(target.contract))
          ?.shape?.operations.find((o) => o.id === target.operation)
      : undefined;
  const update = (patch: Partial<BackendAccessBinding>) => onChange({ ...b, ...patch });
  return (
    <Stack gap="sm">
      <RecordHeader label="Access use" name={b.name} version={b.version} onChange={update} />
      <Pick
        label="Access use resource entity"
        value={contractKey(b.resource)}
        options={namedOptions(entities)}
        onChange={(key) => {
          const e = entities.find((e) => contractKey(e) === key);
          if (e)
            update({
              resource: exact(e),
              policy: { kind: "unresolved" },
              projection: undefined,
              ...(b.target.kind === "projection"
                ? { target: { ...b.target, entity: exact(e), fields: [] } }
                : {}),
            });
        }}
        onOpen={() => navigate("entities", contractKey(b.resource))}
      />
      <NativeSelect
        label="Sensitive target kind"
        data={["projection", "operation"]}
        value={b.target.kind}
        onChange={(e) =>
          update({
            target:
              e.currentTarget.value === "operation"
                ? (operations[0]?.target ?? {
                    kind: "operation",
                    contract: { id: "unselected", version: "v1" },
                    operation: "unselected",
                    owner: { kind: "element", id: "unselected" },
                  })
                : { kind: "projection", entity: b.resource, fields: [] },
          })
        }
      />
      {b.target.kind === "projection" ? (
        <Many
          label="Sensitive observed fields"
          value={b.target.fields}
          options={fields.map((f) => ({ value: f.id, label: f.name }))}
          onChange={(fields) => {
            if (b.target.kind === "projection") update({ target: { ...b.target, fields } });
          }}
        />
      ) : (
        <Pick
          label="Provided exact operation"
          value={
            operations.find(
              (o) =>
                b.target.kind === "operation" &&
                contractKey(o.target.contract) === contractKey(b.target.contract) &&
                o.target.operation === b.target.operation &&
                o.target.owner.kind === b.target.owner.kind &&
                o.target.owner.id === b.target.owner.id,
            )?.value ?? ""
          }
          options={operations}
          onChange={(key) => {
            const o = operations.find((o) => o.value === key);
            if (o) update({ target: o.target });
          }}
        />
      )}
      {operation && target.kind === "operation" ? (
        <details className="policy-group">
          <summary>Inspect exact operation</summary>
          <Text size="sm">
            {contractKey(target.contract)} / {target.operation} · {target.owner.kind}{" "}
            {target.owner.id}
          </Text>
          <PayloadFields
            label="Operation input"
            fields={operation.input}
            disabled
            onChange={() => {}}
          />
          <PayloadFields
            label="Operation output"
            fields={operation.output}
            disabled
            onChange={() => {}}
          />
        </details>
      ) : null}
      <Pick
        label="Access use policy"
        value={b.policy.reference ? contractKey(b.policy.reference) : ""}
        options={namedOptions(policies)}
        onChange={(key) => {
          const p = policies.find((p) => contractKey(p) === key);
          update({
            policy: p ? { kind: "policy", reference: exact(p) } : { kind: "unresolved" },
            projection: undefined,
          });
        }}
        onOpen={() => {
          if (b.policy.reference) navigate("policies", contractKey(b.policy.reference));
        }}
      />
      <TextInput
        label="Access use action"
        value={b.action}
        maxLength={63}
        onChange={(e) => update({ action: e.currentTarget.value })}
      />
      <NativeSelect
        label="Access use recheck site"
        value={b.site}
        data={backendRecheckSiteSchema.options}
        onChange={(e) => update({ site: e.currentTarget.value as typeof b.site })}
      />
      <Pick
        label="Access use field projection"
        value={b.projection ?? ""}
        options={(selected?.projections ?? []).map((p) => ({
          value: p.id,
          label: `${p.id} · ${p.mode}`,
        }))}
        onChange={(projection) => update({ projection: projection || undefined })}
      />
      <Pick
        label="Relationship access intent (optional)"
        value={b.relationshipBinding ?? ""}
        options={(draft.bindings ?? []).map((r) => ({ value: r.id, label: r.name }))}
        onChange={(relationshipBinding) =>
          update({ relationshipBinding: relationshipBinding || undefined })
        }
      />
      <Text size="sm">
        This exact access selection describes a sensitive byte/output/operation path. Current-state
        policy must be checked at this site. It supplies no runtime behavior. Operation value
        mappings are authored separately.
      </Text>
    </Stack>
  );
}

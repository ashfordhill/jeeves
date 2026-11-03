import {
  type Architecture,
  type ArchitectureDataset,
  containerClassification,
  contractKey,
  type DesignDocument,
  tenantScopeSchema,
} from "@jeeves/spec";
import { Button, MultiSelect, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import { type DataNavigation, Pick } from "./BackendFields.tsx";
export function BackendDatasetEditor({
  design,
  draft,
  dataset,
  onChange,
  navigate,
}: {
  design: DesignDocument;
  draft: Architecture;
  dataset: ArchitectureDataset;
  onChange: (dataset: ArchitectureDataset) => void;
  navigate: DataNavigation;
}) {
  const update = (patch: Partial<ArchitectureDataset>) => onChange({ ...dataset, ...patch });
  const owners = [
    ...design.elements.map((e) => ({
      value: `element:${e.id}`,
      label: `${e.name} · container`,
      owner: { kind: "element" as const, id: e.id },
    })),
    ...(draft.components ?? []).map((c) => ({
      value: `component:${c.id}`,
      label: `${c.name} · component`,
      owner: { kind: "component" as const, id: c.id },
    })),
  ];
  return (
    <Stack gap="sm">
      <TextInput
        label="Dataset name"
        value={dataset.name}
        maxLength={120}
        onChange={(e) => update({ name: e.currentTarget.value })}
      />
      <Pick
        label="Dataset data contract"
        value={contractKey(dataset.contract)}
        options={(draft.contracts ?? [])
          .filter((c) => c.kind === "data")
          .map((c) => ({ value: contractKey(c), label: `${c.name} · ${c.version}` }))}
        onChange={(v) => {
          const c = draft.contracts?.find((c) => contractKey(c) === v);
          if (c) update({ contract: { id: c.id, version: c.version } });
        }}
        onOpen={() => navigate("contracts", contractKey(dataset.contract))}
      />
      <Pick
        label="Authoritative store"
        value={dataset.store ?? ""}
        options={design.elements
          .filter((e) => containerClassification(e).kind === "Data store")
          .map((e) => ({ value: e.id, label: e.name }))}
        onChange={(store) => update({ store: store || undefined })}
      />
      <Pick
        label="Dataset authority"
        value={dataset.owners[0] ? `${dataset.owners[0].kind}:${dataset.owners[0].id}` : ""}
        options={owners}
        onChange={(v) =>
          update({ owners: owners.filter((o) => o.value === v).map((o) => o.owner) })
        }
      />
      <Text size="sm">
        Persisted entities require one application authority. Shared ownership decisions remain
        available in Data responsibilities.
      </Text>
      {(["readers", "writers"] as const).map((key) => (
        <MultiSelect
          key={key}
          label={`Dataset ${key}`}
          data={owners}
          value={dataset[key].map((o) => `${o.kind}:${o.id}`)}
          onChange={(values) =>
            update({ [key]: owners.filter((o) => values.includes(o.value)).map((o) => o.owner) })
          }
        />
      ))}
      <NativeSelect
        label="Dataset scope"
        data={[...tenantScopeSchema.options]}
        value={dataset.tenant}
        onChange={(e) => update({ tenant: e.currentTarget.value as ArchitectureDataset["tenant"] })}
      />
      <NativeSelect
        label="Dataset deletion"
        data={["Unknown", "Delete", "Anonymize", "Retain"]}
        value={dataset.deletion}
        onChange={(e) =>
          update({ deletion: e.currentTarget.value as ArchitectureDataset["deletion"] })
        }
      />
      <NativeSelect
        label="Dataset export access"
        data={["Unknown", "None", "Owner", "Tenant admin", "Authorized staff"]}
        value={dataset.exportAccess}
        onChange={(e) =>
          update({ exportAccess: e.currentTarget.value as ArchitectureDataset["exportAccess"] })
        }
      />
      <Button variant="subtle" onClick={() => navigate("contracts", contractKey(dataset.contract))}>
        Inspect exact data shape
      </Button>
    </Stack>
  );
}

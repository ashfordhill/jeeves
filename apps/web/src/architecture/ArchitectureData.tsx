import {
  type ArchitectureDataset,
  type ArchitectureObjective,
  type ContractOwner,
  containerClassification,
  contractKey,
  type DesignDocument,
} from "@jeeves/spec";
import {
  Button,
  Group,
  MultiSelect,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import {
  Amount,
  ArchitectureDraftErrors,
  architectureId,
  Choice,
  tenantChoices,
  useArchitectureDraft,
} from "./RelationshipBindings.tsx";

const ownerKey = (owner: ContractOwner) => `${owner.kind}:${owner.id}`;
export function ArchitectureData({
  design,
  onClose,
}: {
  design: DesignDocument;
  onClose: () => void;
}) {
  const { draft, setDraft, saving, error, issues, review, save } = useArchitectureDraft(
    design,
    onClose,
  );
  const [datasetId, setDatasetId] = useState(draft.datasets?.[0]?.id ?? "");
  const [objectiveId, setObjectiveId] = useState(draft.objectives?.[0]?.id ?? "");
  const dataset = draft.datasets?.find((item) => item.id === datasetId);
  const objective = draft.objectives?.find((item) => item.id === objectiveId);
  const updateData = (patch: Partial<ArchitectureDataset>) =>
    setDraft({
      ...draft,
      datasets: draft.datasets?.map((item) =>
        item.id === datasetId ? { ...item, ...patch } : item,
      ),
    });
  const updateObjective = (patch: Partial<ArchitectureObjective>) =>
    setDraft({
      ...draft,
      objectives: draft.objectives?.map((item) =>
        item.id === objectiveId ? { ...item, ...patch } : item,
      ),
    });
  const owners: { owner: ContractOwner; label: string }[] = [
    ...design.elements.map((item) => ({
      owner: { kind: "element" as const, id: item.id },
      label: `${item.name} · container`,
    })),
    ...(draft.components ?? []).map((item) => ({
      owner: { kind: "component" as const, id: item.id },
      label: `${item.name} · component`,
    })),
    ...draft.nodes
      .filter((item) => item.kind === "external-system")
      .map((item) => ({
        owner: { kind: "external-system" as const, id: item.id },
        label: `${item.name} · external system`,
      })),
  ];
  const access = (key: "owners" | "readers" | "writers", label: string) => (
    <MultiSelect
      label={label}
      searchable
      data={owners.map((item) => ({ value: ownerKey(item.owner), label: item.label }))}
      value={dataset?.[key].map(ownerKey) ?? []}
      onChange={(values) =>
        updateData({
          [key]: values.flatMap((value) => {
            const found = owners.find((item) => ownerKey(item.owner) === value);
            return found ? [found.owner] : [];
          }),
        })
      }
    />
  );
  const scopeOptions = [
    { value: "system", label: "System" },
    ...design.elements.map((item) => ({
      value: `element:${item.id}`,
      label: `${item.name} · container`,
    })),
    ...(draft.components ?? []).map((item) => ({
      value: `component:${item.id}`,
      label: `${item.name} · component`,
    })),
    ...(draft.bindings ?? []).map((item) => ({
      value: `binding:${item.id}`,
      label: `${item.name} · interaction`,
    })),
    ...(draft.datasets ?? []).map((item) => ({
      value: `dataset:${item.id}`,
      label: `${item.name} · dataset`,
    })),
  ];
  return (
    <ConfigurationDialog
      title="Data responsibilities and objectives"
      size="lg"
      onClose={onClose}
      footer={
        <Group justify="flex-end">
          <Button variant="default" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="cyan.9"
            disabled={!!issues.length}
            loading={saving}
            onClick={() => void save()}
          >
            Save data and objectives
          </Button>
        </Group>
      }
    >
      <Stack gap="md">
        <Text size="sm">
          Logical authority and design targets. Reuse a data contract or existing resource
          reference; this is not a SQL schema or measured performance.
        </Text>
        <section className="policy-group" aria-label="Logical datasets">
          <h3>Logical datasets</h3>
          <Stack gap="sm">
            <NativeSelect
              label="Dataset"
              value={datasetId}
              data={[
                { value: "", label: "Select dataset" },
                ...(draft.datasets ?? []).map((item) => ({ value: item.id, label: item.name })),
              ]}
              onChange={(e) => setDatasetId(e.currentTarget.value)}
            />
            <Button
              variant="default"
              onClick={() => {
                const id = architectureId("dataset");
                const contract = draft.contracts?.find((item) => item.kind === "data");
                setDraft({
                  ...draft,
                  datasets: [
                    ...(draft.datasets ?? []),
                    {
                      id,
                      name: "New dataset",
                      contract: contract
                        ? { id: contract.id, version: contract.version }
                        : { id: "unselected", version: "v1" },
                      owners: [],
                      ownershipDecision: "",
                      readers: [],
                      writers: [],
                      tenant: "Unknown",
                      deletion: "Unknown",
                      exportAccess: "Unknown",
                    },
                  ],
                });
                setDatasetId(id);
              }}
            >
              Add dataset
            </Button>
            {dataset ? (
              <>
                <TextInput
                  label="Dataset name"
                  value={dataset.name}
                  maxLength={120}
                  onChange={(e) => updateData({ name: e.currentTarget.value })}
                />
                <NativeSelect
                  label="Data contract"
                  value={contractKey(dataset.contract)}
                  data={[
                    { value: "", label: "Select a data contract" },
                    ...(draft.contracts ?? [])
                      .filter((item) => item.kind === "data")
                      .map((item) => ({
                        value: contractKey(item),
                        label: `${item.name} · ${item.version}${item.source ? " · resource source" : " · planned"}`,
                      })),
                  ]}
                  onChange={(e) => {
                    const contract = draft.contracts?.find(
                      (item) => contractKey(item) === e.currentTarget.value,
                    );
                    if (contract)
                      updateData({ contract: { id: contract.id, version: contract.version } });
                  }}
                />
                {access("owners", "Authoritative owners")}
                <Textarea
                  label="Shared ownership decision"
                  description="Required when more than one responsibility has authority"
                  value={dataset.ownershipDecision}
                  maxLength={1200}
                  onChange={(e) => updateData({ ownershipDecision: e.currentTarget.value })}
                />
                <NativeSelect
                  label="Authoritative store"
                  value={dataset.store ?? ""}
                  data={[
                    { value: "", label: "Unknown" },
                    ...design.elements
                      .filter((item) => containerClassification(item).kind === "Data store")
                      .map((item) => ({ value: item.id, label: item.name })),
                  ]}
                  onChange={(e) => updateData({ store: e.currentTarget.value || undefined })}
                />
                {access("readers", "Permitted readers")}
                {access("writers", "Permitted writers")}
                <Choice
                  label="Dataset tenant scope"
                  value={dataset.tenant}
                  options={tenantChoices}
                  onChange={(v) => updateData({ tenant: v as ArchitectureDataset["tenant"] })}
                />
                <Amount
                  label="Retention (days)"
                  value={dataset.retentionDays}
                  min={0.001}
                  max={36500}
                  onChange={(v) => updateData({ retentionDays: v })}
                />
                <Choice
                  label="Deletion policy"
                  value={dataset.deletion}
                  options={["Unknown", "Delete", "Anonymize", "Retain"]}
                  onChange={(v) => updateData({ deletion: v as ArchitectureDataset["deletion"] })}
                />
                <Choice
                  label="Export access"
                  value={dataset.exportAccess}
                  options={["Unknown", "None", "Owner", "Tenant admin", "Authorized staff"]}
                  onChange={(v) =>
                    updateData({ exportAccess: v as ArchitectureDataset["exportAccess"] })
                  }
                />
                <Button
                  variant="subtle"
                  color="red"
                  onClick={() => {
                    setDraft({
                      ...draft,
                      datasets: draft.datasets?.filter((item) => item.id !== datasetId),
                    });
                    setDatasetId("");
                  }}
                >
                  Remove dataset
                </Button>
              </>
            ) : null}
          </Stack>
        </section>
        <section className="policy-group" aria-label="Workload and service objectives">
          <h3>Workload and service objectives</h3>
          <Stack gap="sm">
            <Text size="sm">
              Unverified design targets. Give redirect response time, analytics lag and background
              completion their own scope and measurement boundary.
            </Text>
            <NativeSelect
              label="Objective"
              value={objectiveId}
              data={[
                { value: "", label: "Select objective" },
                ...(draft.objectives ?? []).map((item) => ({ value: item.id, label: item.name })),
              ]}
              onChange={(e) => setObjectiveId(e.currentTarget.value)}
            />
            <Button
              variant="default"
              onClick={() => {
                const id = architectureId("objective");
                setDraft({
                  ...draft,
                  objectives: [
                    ...(draft.objectives ?? []),
                    {
                      id,
                      name: "New objective",
                      scope: { kind: "system" },
                      metric: "response-time",
                      boundary: "",
                      window: "",
                    },
                  ],
                });
                setObjectiveId(id);
              }}
            >
              Add objective
            </Button>
            {objective ? (
              <>
                <TextInput
                  label="Objective name"
                  value={objective.name}
                  maxLength={120}
                  onChange={(e) => updateObjective({ name: e.currentTarget.value })}
                />
                <NativeSelect
                  label="Objective scope"
                  value={
                    objective.scope.kind === "system"
                      ? "system"
                      : `${objective.scope.kind}:${objective.scope.id}`
                  }
                  data={scopeOptions}
                  onChange={(e) => {
                    const [kind, id] = e.currentTarget.value.split(":");
                    updateObjective({
                      scope:
                        kind === "system"
                          ? { kind }
                          : {
                              kind: kind as "element" | "component" | "binding" | "dataset",
                              id: id!,
                            },
                    });
                  }}
                />
                <Choice
                  label="Objective metric"
                  value={objective.metric}
                  options={[
                    "response-time",
                    "analytics-lag",
                    "job-completion",
                    "throughput",
                    "availability",
                    "recovery-time",
                    "recovery-point",
                  ]}
                  onChange={(v) =>
                    updateObjective({ metric: v as ArchitectureObjective["metric"] })
                  }
                />
                <Amount
                  label="Target value"
                  value={objective.value}
                  min={0.001}
                  max={1e12}
                  onChange={(v) => updateObjective({ value: v })}
                />
                <NativeSelect
                  label="Target unit"
                  value={objective.unit ?? ""}
                  data={[
                    { value: "", label: "Unknown" },
                    ...[
                      "milliseconds",
                      "seconds",
                      "minutes",
                      "requests/second",
                      "events/second",
                      "percent",
                      "days",
                    ].map((value) => ({ value, label: value })),
                  ]}
                  onChange={(e) =>
                    updateObjective({
                      unit: (e.currentTarget.value || undefined) as ArchitectureObjective["unit"],
                    })
                  }
                />
                <Textarea
                  label="Measurement boundary"
                  placeholder="P95 from redirect ingress to Location response"
                  value={objective.boundary}
                  maxLength={240}
                  onChange={(e) => updateObjective({ boundary: e.currentTarget.value })}
                />
                <Textarea
                  label="Measurement window"
                  placeholder="5 minutes at peak workload"
                  value={objective.window}
                  maxLength={240}
                  onChange={(e) => updateObjective({ window: e.currentTarget.value })}
                />
                <Button
                  variant="subtle"
                  color="red"
                  onClick={() => {
                    setDraft({
                      ...draft,
                      objectives: draft.objectives?.filter((item) => item.id !== objectiveId),
                    });
                    setObjectiveId("");
                  }}
                >
                  Remove objective
                </Button>
              </>
            ) : null}
          </Stack>
        </section>
        <ArchitectureDraftErrors error={error} issues={issues} />
        <section aria-label="Data and objective design review">
          <h3>Design review</h3>
          {review
            .filter((item) => item.dataset || item.objective)
            .map((item) => (
              <p className="contract-review" key={`${item.code}:${item.message}`}>
                {item.message}
              </p>
            ))}
        </section>
      </Stack>
    </ConfigurationDialog>
  );
}

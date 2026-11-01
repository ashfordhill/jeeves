import { builtinRegistry } from "@jeeves/registry";
import {
  type Architecture,
  type ArchitectureContract,
  type ArchitectureInterface,
  architectureContractReview,
  architectureSchema,
  type ContractOwner,
  type ContractShape,
  contractCanonical,
  contractKey,
  contractSources,
  type DesignDocument,
  resolveContractSource,
  sameContractOwner,
  validateArchitecture,
  validateContractTransition,
} from "@jeeves/spec";
import {
  Alert,
  Button,
  Checkbox,
  Group,
  MultiSelect,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { useApiPreview } from "../api-reference/preview.tsx";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useDraw } from "../draw/store.ts";

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const emptyShape = (): ContractShape => ({ operations: [], payload: [] });

function PayloadFields({
  label,
  fields,
  onChange,
  disabled,
}: {
  label: string;
  fields: ContractShape["payload"];
  onChange: (fields: ContractShape["payload"]) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="contract-payload" disabled={disabled}>
      <legend>{label}</legend>
      {!fields.length ? (
        <Text size="sm">No fields declared. Empty payloads may remain a draft.</Text>
      ) : null}
      {fields.map((field, index) => {
        const change = (patch: Partial<typeof field>) =>
          onChange(fields.map((item, i) => (i === index ? { ...item, ...patch } : item)));
        return (
          <div className="contract-field" key={field.id}>
            <TextInput
              label={`${label} field ${index + 1} name`}
              value={field.name}
              maxLength={64}
              onChange={(e) => change({ name: e.currentTarget.value })}
            />
            <NativeSelect
              label={`${label} field ${index + 1} type`}
              value={field.type}
              data={["unresolved", "text", "integer", "boolean", "uuid", "http-url", "timestamp"]}
              onChange={(e) => change({ type: e.currentTarget.value as typeof field.type })}
            />
            <TextInput
              label={`${label} field ${index + 1} description`}
              value={field.description}
              maxLength={1200}
              onChange={(e) => change({ description: e.currentTarget.value })}
            />
            <Group justify="space-between">
              <Checkbox
                label={`${label} field ${index + 1} required`}
                checked={field.required}
                onChange={(e) => change({ required: e.currentTarget.checked })}
              />
              <Button
                size="compact-xs"
                color="red"
                variant="subtle"
                onClick={() => onChange(fields.filter((_, i) => i !== index))}
              >
                Remove {label.toLowerCase()} field {index + 1}
              </Button>
            </Group>
          </div>
        );
      })}
      <Button
        size="xs"
        variant="default"
        disabled={disabled || fields.length >= 40}
        onClick={() =>
          onChange([
            ...fields,
            {
              id: newId("field"),
              name: `field${fields.length + 1}`,
              type: "unresolved",
              required: true,
              description: "",
            },
          ])
        }
      >
        Add {label.toLowerCase()} field
      </Button>
    </fieldset>
  );
}

export function InterfaceSummary({ owner }: { owner: ContractOwner }) {
  const design = useDraw((state) => state.loaded)!.design;
  const [open, setOpen] = useState(false);
  const uses =
    design.architecture?.interfaces?.filter((item) => sameContractOwner(item.owner, owner)) ?? [];
  const review = architectureContractReview(design);
  return (
    <section className="interface-summary" aria-label="Provided and required interfaces">
      <h3>Interfaces</h3>
      {uses.length ? (
        <ul>
          {uses.map((use) => {
            const def = design.architecture?.contracts?.find(
              (item) => contractKey(item) === contractKey(use.contract),
            );
            return (
              <li key={use.id}>
                <strong>
                  {use.direction === "provided" ? "Provides" : "Requires"}: {use.name}
                </strong>
                <span>
                  {def?.name ?? use.contract.id} · {use.contract.version} ·{" "}
                  {def?.source ? "Source reference" : "Planned"}
                  {use.direction === "required" ? ` · ${use.necessity}` : ""}
                </span>
                {review
                  .filter(
                    (item) =>
                      item.interface === use.id || item.contract === contractKey(use.contract),
                  )
                  .map((item) => (
                    <span className="contract-review" key={item.code}>
                      {item.message}
                    </span>
                  ))}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No interfaces declared.</p>
      )}
      <Button variant="default" fullWidth onClick={() => setOpen(true)}>
        Manage interfaces
      </Button>
      {open ? (
        <InterfaceEditor
          key={`${owner.kind}:${owner.id}`}
          design={design}
          owner={owner}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </section>
  );
}

export function InterfaceEditor({
  design: initialDesign,
  owner,
  onClose,
}: {
  design: DesignDocument;
  owner: ContractOwner;
  onClose: () => void;
}) {
  const [design] = useState(initialDesign);
  const projectName = useDraw((state) => state.loaded)!.project.name;
  const { preview } = useApiPreview();
  const [draft, setDraft] = useState<Architecture>(() =>
    structuredClone(
      design.architecture ?? {
        system: { name: projectName, description: "" },
        nodes: [],
        relationships: [],
      },
    ),
  );
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const contracts = draft.contracts ?? [];
  const interfaces = draft.interfaces ?? [];
  const contract = contracts[selected];
  const original = design.architecture?.contracts?.find(
    (item) => contract && contractKey(item) === contractKey(contract),
  );
  const locked =
    !!original &&
    !!design.architecture?.interfaces?.some(
      (item) => contractKey(item.contract) === contractKey(original),
    );
  const sources = contractSources(design);
  const uses = interfaces.filter((item) => sameContractOwner(item.owner, owner));
  const updateContract = (patch: Partial<ArchitectureContract>) =>
    setDraft({
      ...draft,
      contracts: contracts.map((item, i) => (i === selected ? { ...item, ...patch } : item)),
    });
  const updateInterface = (id: string, patch: Partial<ArchitectureInterface>) =>
    setDraft({
      ...draft,
      interfaces: interfaces.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  const parsed = architectureSchema.safeParse(draft);
  const nextDesign = { ...design, architecture: draft };
  const problems = parsed.success
    ? [
        ...validateArchitecture({ ...design, architecture: parsed.data }, builtinRegistry()).filter(
          (item) => item.severity === "error" && item.code !== "NEEDS_TEMPLATE",
        ),
        ...validateContractTransition(design, { ...design, architecture: parsed.data }),
      ]
    : [];
  const review = parsed.success ? architectureContractReview(nextDesign) : [];
  const sourceShape = contract?.source ? resolveContractSource(design, contract.source) : undefined;
  const sourceOperation =
    contract?.source?.kind === "rest-operation"
      ? (() => {
          const source = contract.source;
          if (source.kind !== "rest-operation") return undefined;
          const member = source.member;
          return preview?.apis
            .find((api) => api.element === source.element && api.attachment === source.attachment)
            ?.operations.find((op) =>
              member.kind === "extension"
                ? op.extension === member.ref
                : member.kind === "session"
                  ? op.id === member.operation
                  : op.resource === member.ref && op.id.startsWith(member.operation),
            );
        })()
      : undefined;
  const peers = contract
    ? (design.architecture?.interfaces ?? []).filter(
        (item) => item.contract.id === contract.id && item.contract.version !== contract.version,
      )
    : [];
  const save = async () => {
    if (!parsed.success || problems.length || saving) return;
    if (useDraw.getState().loaded?.design.revision !== design.revision) {
      setError(
        "The design changed. Your draft has been retained. Cancel and reopen to review the current revision.",
      );
      return;
    }
    setSaving(true);
    const ok = await useDraw
      .getState()
      .edit([{ op: "setArchitecture", architecture: parsed.data }]);
    setSaving(false);
    if (ok) onClose();
    else setError(useDraw.getState().notice?.message ?? "Could not save interfaces.");
  };
  return (
    <ConfigurationDialog
      title="Manage interfaces"
      size="xl"
      onClose={onClose}
      footer={
        <Group justify="flex-end">
          <Button variant="default" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="cyan.9"
            loading={saving}
            disabled={!parsed.success || problems.length > 0}
            onClick={() => void save()}
          >
            Save interfaces
          </Button>
        </Group>
      }
    >
      <Stack gap="md" className="interface-editor">
        <Text size="sm">
          Project-local definitions are reused by exact version. Planned declarations document
          intent. Existing source shapes are read-only; bindings follow separately.
        </Text>
        <section aria-label="Contract definitions">
          <h3>Contract definitions</h3>
          <Group align="end">
            <NativeSelect
              label="Definition"
              value={String(selected)}
              data={
                contracts.length
                  ? contracts.map((item, i) => ({
                      value: String(i),
                      label: `${item.name} · ${item.version || "new version"}`,
                    }))
                  : [{ value: "0", label: "No definitions" }]
              }
              onChange={(e) => setSelected(Number(e.currentTarget.value))}
            />
            <Button
              variant="default"
              disabled={contracts.length >= 200}
              onClick={() => {
                setDraft({
                  ...draft,
                  contracts: [
                    ...contracts,
                    {
                      id: newId("contract"),
                      version: "v1",
                      name: "New contract",
                      kind: "api",
                      description: "",
                      shape: emptyShape(),
                    },
                  ],
                });
                setSelected(contracts.length);
              }}
            >
              New definition
            </Button>
          </Group>
          {contract ? (
            <Stack mt="md" gap="sm">
              <TextInput
                label="Contract name"
                required
                value={contract.name}
                maxLength={120}
                onChange={(e) => updateContract({ name: e.currentTarget.value })}
              />
              <div className="architecture-form-pair">
                <TextInput
                  label="Exact version"
                  required
                  disabled={locked}
                  value={contract.version}
                  maxLength={40}
                  onChange={(e) => {
                    const version = e.currentTarget.value;
                    const oldKey = contractKey(contract);
                    setDraft({
                      ...draft,
                      contracts: contracts.map((item, i) =>
                        i === selected ? { ...item, version } : item,
                      ),
                      interfaces: interfaces.map((item) =>
                        contractKey(item.contract) === oldKey
                          ? { ...item, contract: { ...item.contract, version } }
                          : item,
                      ),
                    });
                  }}
                />
                <NativeSelect
                  label="Contract kind"
                  disabled={locked || !!contract.source}
                  value={contract.kind}
                  data={[
                    { value: "api", label: "API" },
                    { value: "in-process", label: "In-process interface" },
                    { value: "event", label: "Event payload" },
                    { value: "data", label: "Logical dataset" },
                  ]}
                  onChange={(e) =>
                    updateContract({
                      kind: e.currentTarget.value as ArchitectureContract["kind"],
                      shape: emptyShape(),
                    })
                  }
                />
              </div>
              <Textarea
                label="Contract description"
                maxLength={1200}
                value={contract.description}
                onChange={(e) => updateContract({ description: e.currentTarget.value })}
              />
              <NativeSelect
                label="Definition source"
                disabled={locked}
                value={contract.source ? contractCanonical(contract.source) : "planned"}
                data={[
                  { value: "planned", label: "Planned structured shape" },
                  ...sources.map((item) => ({
                    value: contractCanonical(item.source),
                    label: item.label,
                  })),
                  ...(contract.source &&
                  !sources.some(
                    (item) => contractCanonical(item.source) === contractCanonical(contract.source),
                  )
                    ? [
                        {
                          value: contractCanonical(contract.source),
                          label: "Missing source · stale",
                        },
                      ]
                    : []),
                ]}
                onChange={(e) => {
                  const picked = sources.find(
                    (item) => contractCanonical(item.source) === e.currentTarget.value,
                  );
                  updateContract(
                    picked
                      ? {
                          source: picked.source,
                          kind: picked.kind,
                          shape: undefined,
                          sourceSnapshot: contractCanonical(
                            resolveContractSource(design, picked.source),
                          ),
                          sourceDesignRevision: design.revision,
                        }
                      : {
                          source: undefined,
                          sourceSnapshot: undefined,
                          sourceDesignRevision: undefined,
                          shape: emptyShape(),
                        },
                  );
                }}
              />
              {locked ? (
                <Text size="sm">
                  This version is referenced. Its shape is protected. Rename it freely or create an
                  explicit new version to change the shape.
                </Text>
              ) : null}
              {contract.source ? (
                <>
                  <Text size="sm">
                    Authoritative source · authored from saved design revision{" "}
                    {contract.sourceDesignRevision}. Inspect current source below. A saved snapshot
                    records the referenced revision; it does not prove compatibility.
                  </Text>
                  {review
                    .filter((item) => item.contract === contractKey(contract))
                    .map((item) => (
                      <Alert color="yellow" key={item.code}>
                        {item.message}
                      </Alert>
                    ))}
                  <details>
                    <summary>Current authoritative shape (read-only)</summary>
                    <pre className="contract-source">
                      {sourceShape === undefined
                        ? "Source is missing."
                        : JSON.stringify(sourceOperation ?? sourceShape, null, 2)}
                    </pre>
                  </details>
                  <details>
                    <summary>Saved source revision (read-only)</summary>
                    <pre className="contract-source">{contract.sourceSnapshot}</pre>
                  </details>
                </>
              ) : contract.shape ? (
                <>
                  <Text size="sm">Planned shape · unresolved drafts are saveable.</Text>
                  {["api", "in-process"].includes(contract.kind) ? (
                    <>
                      {contract.shape.operations.map((operation, index) => {
                        const changeOperation = (patch: Partial<typeof operation>) =>
                          updateContract({
                            shape: {
                              ...contract.shape!,
                              operations: contract.shape!.operations.map((item, i) =>
                                i === index ? { ...item, ...patch } : item,
                              ),
                            },
                          });
                        return (
                          <fieldset
                            className="contract-operation"
                            key={operation.id}
                            disabled={locked}
                          >
                            <legend>Operation {index + 1}</legend>
                            <TextInput
                              label={`Operation ${index + 1} name`}
                              required
                              value={operation.name}
                              maxLength={120}
                              onChange={(e) => changeOperation({ name: e.currentTarget.value })}
                            />
                            <Textarea
                              label={`Operation ${index + 1} description`}
                              value={operation.description}
                              maxLength={1200}
                              onChange={(e) =>
                                changeOperation({ description: e.currentTarget.value })
                              }
                            />
                            <PayloadFields
                              label={`Operation ${index + 1} input`}
                              fields={operation.input}
                              disabled={locked}
                              onChange={(input) => changeOperation({ input })}
                            />
                            <PayloadFields
                              label={`Operation ${index + 1} output`}
                              fields={operation.output}
                              disabled={locked}
                              onChange={(output) => changeOperation({ output })}
                            />
                            <Button
                              size="xs"
                              color="red"
                              variant="subtle"
                              onClick={() =>
                                updateContract({
                                  shape: {
                                    ...contract.shape!,
                                    operations: contract.shape!.operations.filter(
                                      (_, i) => i !== index,
                                    ),
                                  },
                                })
                              }
                            >
                              Remove operation {index + 1}
                            </Button>
                          </fieldset>
                        );
                      })}
                      <Button
                        variant="default"
                        size="xs"
                        disabled={locked || contract.shape.operations.length >= 30}
                        onClick={() =>
                          updateContract({
                            shape: {
                              ...contract.shape!,
                              operations: [
                                ...contract.shape!.operations,
                                {
                                  id: newId("operation"),
                                  name: "NewOperation",
                                  description: "",
                                  input: [],
                                  output: [],
                                },
                              ],
                            },
                          })
                        }
                      >
                        Add operation
                      </Button>
                    </>
                  ) : (
                    <PayloadFields
                      label="Payload"
                      fields={contract.shape.payload}
                      disabled={locked}
                      onChange={(payload) =>
                        updateContract({ shape: { ...contract.shape!, payload } })
                      }
                    />
                  )}
                </>
              ) : null}
              <Group>
                <Button
                  variant="default"
                  disabled={contracts.length >= 200}
                  onClick={() => {
                    const current = contract.source
                      ? resolveContractSource(design, contract.source)
                      : undefined;
                    setDraft({
                      ...draft,
                      contracts: [
                        ...contracts,
                        {
                          ...structuredClone(contract),
                          version: "",
                          ...(contract.source && current !== undefined
                            ? {
                                sourceSnapshot: contractCanonical(current),
                                sourceDesignRevision: design.revision,
                              }
                            : {}),
                        },
                      ],
                    });
                    setSelected(contracts.length);
                  }}
                >
                  Create version
                </Button>
                <Button
                  variant="subtle"
                  color="red"
                  disabled={interfaces.some(
                    (item) => contractKey(item.contract) === contractKey(contract),
                  )}
                  onClick={() => {
                    setDraft({ ...draft, contracts: contracts.filter((_, i) => i !== selected) });
                    setSelected(0);
                  }}
                >
                  Remove unreferenced definition
                </Button>
              </Group>
              {peers.length ? (
                <section aria-label="Consumer update preview">
                  <h4>Consumer update preview</h4>
                  <Text size="sm">
                    Existing instances keep their exact versions. Select only the instances to
                    update after reviewing this shape.
                  </Text>
                  <ul>
                    {peers.map((item) => (
                      <li key={item.id}>
                        {item.name} · {item.owner.id} · {item.direction} · {item.contract.version}
                      </li>
                    ))}
                  </ul>
                  <MultiSelect
                    searchable
                    label="Update selected instances to this version"
                    disabled={!contract.version || !!original}
                    data={peers.map((item) => ({
                      value: item.id,
                      label: `${item.name} · ${item.owner.id} · ${item.contract.version}`,
                    }))}
                    value={interfaces
                      .filter(
                        (item) =>
                          peers.some((peer) => peer.id === item.id) &&
                          contractKey(item.contract) === contractKey(contract),
                      )
                      .map((item) => item.id)}
                    onChange={(ids) =>
                      setDraft({
                        ...draft,
                        interfaces: interfaces.map((item) => {
                          const peer = peers.find((peer) => peer.id === item.id);
                          return peer
                            ? {
                                ...item,
                                contract: ids.includes(item.id)
                                  ? { id: contract.id, version: contract.version }
                                  : peer.contract,
                              }
                            : item;
                        }),
                      })
                    }
                  />
                </section>
              ) : null}
            </Stack>
          ) : null}
        </section>
        <section aria-label="Interface instances">
          <h3>Interfaces for {owner.id}</h3>
          {uses.map((use, index) => (
            <fieldset className="contract-operation" key={use.id}>
              <legend>Interface {index + 1}</legend>
              <TextInput
                label={`Interface ${index + 1} name`}
                value={use.name}
                maxLength={120}
                required
                onChange={(e) => updateInterface(use.id, { name: e.currentTarget.value })}
              />
              <NativeSelect
                label={`Interface ${index + 1} direction`}
                value={use.direction}
                data={[
                  { value: "provided", label: "Provides" },
                  { value: "required", label: "Requires" },
                ]}
                onChange={(e) =>
                  updateInterface(use.id, {
                    direction: e.currentTarget.value as ArchitectureInterface["direction"],
                  })
                }
              />
              <NativeSelect
                label={`Interface ${index + 1} contract`}
                value={contractKey(use.contract)}
                data={contracts.map((item) => ({
                  value: contractKey(item),
                  label: `${item.name} · ${item.version || "enter a version"}`,
                }))}
                onChange={(e) => {
                  const def = contracts.find((item) => contractKey(item) === e.currentTarget.value);
                  if (def)
                    updateInterface(use.id, { contract: { id: def.id, version: def.version } });
                }}
              />
              {use.direction === "required" ? (
                <NativeSelect
                  label={`Interface ${index + 1} use`}
                  value={use.necessity}
                  data={[
                    { value: "required", label: "Required · unbound" },
                    { value: "optional", label: "Optional use" },
                  ]}
                  onChange={(e) =>
                    updateInterface(use.id, {
                      necessity: e.currentTarget.value as ArchitectureInterface["necessity"],
                    })
                  }
                />
              ) : null}
              <Button
                size="xs"
                color="red"
                variant="subtle"
                onClick={() =>
                  setDraft({
                    ...draft,
                    interfaces: interfaces.filter((item) => item.id !== use.id),
                  })
                }
              >
                Remove interface {index + 1}
              </Button>
            </fieldset>
          ))}
          <Button
            mt="sm"
            variant="default"
            disabled={!contract || !contract.version || interfaces.length >= 500}
            onClick={() => {
              if (contract)
                setDraft({
                  ...draft,
                  interfaces: [
                    ...interfaces,
                    {
                      id: newId("interface"),
                      name: contract.name,
                      owner,
                      direction: "provided",
                      necessity: "required",
                      contract: { id: contract.id, version: contract.version },
                    },
                  ],
                });
            }}
          >
            Add interface
          </Button>
        </section>
        {review.length ? (
          <details open>
            <summary>Design review ({review.length})</summary>
            <ul>
              {review.map((item) => (
                <li key={`${item.code}:${item.interface ?? item.contract}`}>{item.message}</li>
              ))}
            </ul>
          </details>
        ) : null}
        {!parsed.success ? (
          <Alert color="red" role="alert">
            {parsed.error.issues[0]?.message}
          </Alert>
        ) : null}
        {problems[0] || error ? (
          <Alert color="red" role="alert">
            {error ?? problems[0]?.message}
          </Alert>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}

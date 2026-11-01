import {
  type Architecture,
  architectureSchema,
  containerClassification,
  type DeploymentEndpoint,
  type DeploymentEnvironment,
  type DesignDocument,
  deploymentEnvironmentSchema,
  deploymentExternalChoices,
  deploymentProjection,
  isDeployableElement,
  isExternalResponsibility,
  validateArchitectureDeployments,
} from "@jeeves/spec";
import {
  Alert,
  Button,
  Group,
  Menu,
  NativeSelect,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useDraw } from "../draw/store.ts";
import { ArchitectureGraph } from "./ArchitectureGraph.tsx";
import { ArchitectureHandoff } from "./ArchitectureHandoff.tsx";
import { useEditorDraft } from "./editor-drafts.tsx";
import "./deployments.css";

const identity = (kind: string) => `deploy-${kind}-${crypto.randomUUID().slice(0, 8)}`;
const endpointKey = (e: DeploymentEndpoint) => `${e.kind}:${e.id}`;
const endpointValue = (value: string): DeploymentEndpoint => {
  const [kind, id] = value.split(":");
  return { kind: kind as DeploymentEndpoint["kind"], id: id ?? "" };
};

const placementChoices = [
  {
    kind: "deployment",
    name: "Kubernetes cluster",
    technology: "Kubernetes",
    responsibility: "Cluster placement, region and failure boundaries.",
  },
  {
    kind: "deployment",
    name: "Application pods",
    technology: "OCI container image · Kubernetes Deployment",
    responsibility:
      "Application replica placement. Set image, resource requests and scaling policy in the design decisions.",
  },
  {
    kind: "deployment",
    name: "Docker host",
    technology: "Docker Engine",
    responsibility: "Host for application container instances.",
  },
  {
    kind: "deployment",
    name: "Virtual machine",
    technology: "Virtual machine",
    responsibility: "VM placement; choose instance size and availability requirements.",
  },
  {
    kind: "deployment",
    name: "Managed database",
    technology: "Managed PostgreSQL",
    responsibility: "Database placement, writer/reader roles, backup and failover.",
  },
  {
    kind: "infrastructure",
    name: "Load balancer",
    technology: "HTTP / WebSocket load balancer",
    responsibility: "TLS termination, health checks and routing to healthy application instances.",
  },
  {
    kind: "infrastructure",
    name: "Kubernetes Service",
    technology: "Kubernetes Service",
    responsibility: "Stable service address and routing to ready pods.",
  },
  {
    kind: "infrastructure",
    name: "Message broker",
    technology: "Broker technology undecided",
    responsibility: "Hosts named C2 queues/topics; replication belongs to this infrastructure.",
  },
] as const;

export function ArchitectureDeployments({
  design,
  projectName,
  onClose,
}: {
  design: DesignDocument;
  projectName: string;
  onClose: () => void;
}) {
  const incoming =
    design.architecture ?? architectureSchema.parse({ system: { name: projectName } });
  const { draft, setDraft, baseRevision, resetDraft } = useEditorDraft<Architecture>(
    "deployments",
    incoming,
    design.revision,
  );
  const [environment, setEnvironment] = useState(draft.deployments?.[0]?.id ?? "");
  const [editing, setEditing] = useState(!draft.deployments?.length);
  const [selected, setSelected] = useState("environment");
  const [diagramSelected, setDiagramSelected] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const env = draft.deployments?.find((e) => e.id === environment);
  const savedEnv = design.architecture?.deployments?.find((e) => e.id === environment);
  const view = savedEnv ? deploymentProjection(design, savedEnv) : undefined;
  const inspectedNode = view?.nodes.find((n) => n.id === diagramSelected);
  const inspectedEdge = view?.edges.find((e) => e.id === diagramSelected);
  const inspectedInteraction = savedEnv?.interactions.find((interaction) =>
    inspectedEdge?.id.startsWith(`deployment:${savedEnv.id}:${interaction.id}:`),
  );
  const parsed = architectureSchema.safeParse(draft);
  const problems = parsed.success
    ? validateArchitectureDeployments({ ...design, architecture: parsed.data })
    : [];
  const dirty = JSON.stringify(draft) !== JSON.stringify(incoming);
  const update = (next: DeploymentEnvironment) =>
    setDraft({
      ...draft,
      deployments: draft.deployments?.map((e) => (e.id === next.id ? next : e)),
    });
  const create = () => {
    const next = deploymentEnvironmentSchema.parse({
      id: identity("environment"),
      name: "Hosted plan",
      kind: "Hosted",
    });
    setDraft({ ...draft, deployments: [...(draft.deployments ?? []), next] });
    setEnvironment(next.id);
    setSelected("environment");
    setEditing(true);
  };
  const save = async () => {
    if (!parsed.success || problems.length || saving) return;
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError(
        "The design changed while this draft was open. Cancel changes to load the current design, then review your placements again.",
      );
      return;
    }
    setSaving(true);
    const ok = await useDraw
      .getState()
      .edit([{ op: "setArchitecture", architecture: parsed.data }]);
    setSaving(false);
    if (ok) {
      const saved = useDraw.getState().loaded!.design;
      resetDraft(saved.architecture!, saved.revision);
      setEditing(false);
      setError(undefined);
    } else
      setError(
        useDraw.getState().notice?.message ??
          "The deployment plan could not be saved. Your draft is retained.",
      );
  };
  const cancel = () => {
    resetDraft(incoming, design.revision);
    setEditing(false);
    setError(undefined);
    setEnvironment(design.architecture?.deployments?.[0]?.id ?? "");
    setSelected("environment");
  };
  return (
    <ConfigurationDialog
      title="Deployment"
      size="xl"
      fullScreen
      onClose={onClose}
      footer={
        <Group justify="flex-end">
          <Button
            color="cyan.9"
            disabled={!view || editing || dirty}
            onClick={() => setHandoffOpen(true)}
            aria-label="Export deployment handoff"
          >
            Export
          </Button>
          <Button variant="default" onClick={onClose} disabled={saving}>
            Done
          </Button>
          {editing || dirty ? (
            <>
              <Button
                variant="default"
                onClick={cancel}
                disabled={saving}
                aria-label="Cancel changes"
              >
                Cancel
              </Button>
              <Button
                color="cyan.9"
                className="deployment-plan-action"
                onClick={() => void save()}
                loading={saving}
                disabled={!dirty || !parsed.success || problems.length > 0}
                aria-label="Save deployment plan"
              >
                Save
              </Button>
            </>
          ) : (
            <Button
              color="cyan.9"
              className="deployment-plan-action"
              disabled={!env}
              onClick={() => setEditing(true)}
              aria-label="Edit deployment plan"
            >
              Edit
            </Button>
          )}
        </Group>
      }
    >
      {handoffOpen && view ? (
        <ArchitectureHandoff
          projection={view}
          view={`deployment:${savedEnv?.id}`}
          diagramRoot=".deployment-plan-diagram"
          onClose={() => setHandoffOpen(false)}
        />
      ) : null}
      <Stack gap="md" className="deployment-planning">
        <Group align="end" className="deployment-toolbar">
          <NativeSelect
            label="Environment"
            value={environment}
            data={[
              { value: "", label: "Choose an environment" },
              ...(draft.deployments ?? []).map((e) => ({
                value: e.id,
                label: e.name,
              })),
            ]}
            onChange={(e) => {
              setEnvironment(e.currentTarget.value);
              setSelected("environment");
            }}
          />
          <Button
            variant="default"
            disabled={(draft.deployments?.length ?? 0) >= 12}
            onClick={create}
          >
            Add environment
          </Button>
        </Group>
        {!env ? null : editing ? (
          <DeploymentFields
            design={design}
            env={env}
            selected={selected}
            onSelect={setSelected}
            onChange={update}
            onRemove={() => {
              setDraft({
                ...draft,
                deployments: draft.deployments?.filter((e) => e.id !== env.id),
              });
              setEnvironment(draft.deployments?.find((e) => e.id !== env.id)?.id ?? "");
            }}
          />
        ) : savedEnv ? (
          <>
            <NativeSelect
              aria-label="Inspect deployment object"
              value={diagramSelected}
              data={[
                { value: "", label: "Find an object or connection…" },
                ...(view?.nodes ?? []).map((n) => ({
                  value: n.id,
                  label: `${n.name}${n.parent ? ` · ${view?.groups?.find((g) => g.id === n.parent)?.name ?? ""}` : ""}`,
                })),
                ...(view?.edges ?? []).map((e) => ({
                  value: e.id,
                  label: `${e.description} · ${e.connection ?? e.context ?? "deployment only"}`,
                })),
              ]}
              onChange={(event) => setDiagramSelected(event.currentTarget.value)}
            />
            {inspectedNode ? (
              <Text size="sm">
                <strong>{inspectedNode.name}</strong>
                {[inspectedNode.description, inspectedNode.technology]
                  .filter(Boolean)
                  .map((text) => ` · ${text}`)
                  .join("")}
              </Text>
            ) : null}
            {inspectedEdge ? (
              <Text size="sm">
                <strong>{inspectedEdge.description}</strong> · {inspectedEdge.protocol} ·{" "}
                {inspectedEdge.connection
                  ? `C2 relationship ${inspectedEdge.connection}`
                  : inspectedEdge.context
                    ? `Context relationship ${inspectedEdge.context}`
                    : inspectedInteraction?.kind === "replica"
                      ? "Replica communication"
                      : "Infrastructure connection"}
              </Text>
            ) : null}
            <div className="deployment-plan-diagram">
              <ArchitectureGraph
                projection={view!}
                viewKey={`deployment:${savedEnv.id}`}
                selected={diagramSelected}
                onSelect={setDiagramSelected}
              />
            </div>
            <details>
              <summary>Notes & references</summary>
              {savedEnv.description ? <p>{savedEnv.description}</p> : null}
              <PlacementTree env={savedEnv} design={design} />
              {savedEnv.interactions.map((i) => (
                <p key={i.id}>
                  {i.id}:{" "}
                  {i.kind === "logical"
                    ? `Logical ${i.relationship.kind} ${i.relationship.id}`
                    : `${i.kind === "replica" ? "Replica communication" : "Deployment only"} · ${i.description} · ${i.protocol}`}
                </p>
              ))}
            </details>
          </>
        ) : (
          <Text>Save the draft to inspect its diagram.</Text>
        )}
        {editing && !parsed.success ? (
          <Alert color="red">
            {parsed.error.issues.map((i) => `${i.path.join(" / ")}: ${i.message}`).join("; ")}
          </Alert>
        ) : null}
        {editing && problems.length ? (
          <Alert color="red">{problems.map((p) => p.message).join(" ")}</Alert>
        ) : null}
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}

function PlacementTree({ env, design }: { env: DeploymentEnvironment; design: DesignDocument }) {
  const branch = (parent?: string) => (
    <ul>
      {env.nodes
        .filter((n) => n.parent === parent)
        .map((n) => (
          <li key={n.id}>
            <strong>{n.name}</strong> · {n.kind} · {n.technology || "Technology undecided"} ·{" "}
            {n.region || "Region undecided"} / {n.zone || "Zone undecided"} · {n.operation} ·{" "}
            {n.replicas} declared copies
            <p>
              {n.responsibility || "Responsibility undecided"}
              {n.legacyElement
                ? ` · Reviewed C2 mapping: ${n.legacyElement}. ${n.mappingReason}`
                : ""}
            </p>
            {env.instances
              .filter((i) => i.node === n.id)
              .map((i) => (
                <p key={i.id}>
                  {design.elements.find((e) => e.id === i.element)?.name} · C2 {i.element} ·{" "}
                  {i.replicas} instance(s)
                </p>
              ))}
            {branch(n.id)}
          </li>
        ))}
    </ul>
  );
  return <section aria-label="Nested deployment placements">{branch()}</section>;
}

function DeploymentFields({
  design,
  env,
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  design: DesignDocument;
  env: DeploymentEnvironment;
  selected: string;
  onSelect: (id: string) => void;
  onChange: (env: DeploymentEnvironment) => void;
  onRemove: () => void;
}) {
  const node = env.nodes.find((n) => `node:${n.id}` === selected);
  const instance = env.instances.find((i) => `instance:${i.id}` === selected);
  const external = env.externals.find((e) => `external:${e.id}` === selected);
  const interaction = env.interactions.find((i) => `interaction:${i.id}` === selected);
  const addNode = (
    kind: "deployment" | "infrastructure",
    preset?: (typeof placementChoices)[number],
  ) => {
    const next: DeploymentEnvironment = {
      ...env,
      nodes: [
        ...env.nodes,
        {
          id: identity("node"),
          name: preset?.name ?? (kind === "deployment" ? "Hosting boundary" : "Infrastructure"),
          kind,
          replicas: 1,
          technology: preset?.technology ?? "",
          region: "",
          zone: "",
          responsibility: preset?.responsibility ?? "",
          operation: "Unspecified",
          mappingReason: "",
        },
      ],
    };
    onChange(next);
    onSelect(`node:${next.nodes.at(-1)!.id}`);
  };
  const placements = [
    { value: "", label: "Choose placement" },
    ...env.nodes.map((n) => ({ value: n.id, label: `${n.name} · ${n.kind}` })),
  ];
  const endpoints = [
    ...env.instances.map((i) => ({
      value: `instance:${i.id}`,
      label: `${design.elements.find((e) => e.id === i.element)?.name ?? i.element} · instance group`,
    })),
    ...env.nodes
      .filter((n) => n.kind === "infrastructure")
      .map((n) => ({ value: `node:${n.id}`, label: `${n.name} · infrastructure` })),
    ...env.externals.map((x) => ({
      value: `external:${x.id}`,
      label: `${deploymentExternalChoices(design).find((c) => c.value === `${x.reference.kind}:${x.reference.id}`)?.label ?? x.reference.id} · external`,
    })),
  ];
  const changeNode = (patch: Partial<NonNullable<typeof node>>) =>
    onChange({ ...env, nodes: env.nodes.map((n) => (n.id === node?.id ? { ...n, ...patch } : n)) });
  const changeInstance = (patch: Partial<NonNullable<typeof instance>>) =>
    onChange({
      ...env,
      instances: env.instances.map((i) => (i.id === instance?.id ? { ...i, ...patch } : i)),
    });
  return (
    <Stack gap="sm">
      <Group gap="xs">
        {(["deployment", "infrastructure"] as const).map((kind) => (
          <Menu key={kind} withinPortal>
            <Menu.Target>
              <Button size="xs" variant="default" disabled={env.nodes.length >= 100}>
                {kind === "deployment" ? "Add placement" : "Add infrastructure"}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {placementChoices
                .filter((choice) => choice.kind === kind)
                .map((choice) => (
                  <Menu.Item key={choice.name} onClick={() => addNode(kind, choice)}>
                    {choice.name}
                  </Menu.Item>
                ))}
              <Menu.Divider />
              <Menu.Item onClick={() => addNode(kind)}>
                Custom {kind === "deployment" ? "placement" : "infrastructure"}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ))}
        <Button
          size="xs"
          variant="default"
          disabled={
            !env.nodes.length ||
            !design.elements.some(isDeployableElement) ||
            env.instances.length >= 100
          }
          onClick={() => {
            const item = {
              id: identity("instance"),
              element: design.elements.find(isDeployableElement)!.id,
              node: env.nodes[0]!.id,
              replicas: 1,
            };
            onChange({ ...env, instances: [...env.instances, item] });
            onSelect(`instance:${item.id}`);
          }}
        >
          Add instance
        </Button>
        <Button
          size="xs"
          variant="default"
          disabled={!deploymentExternalChoices(design).length || env.externals.length >= 50}
          onClick={() => {
            const item = {
              id: identity("external"),
              reference: deploymentExternalChoices(design)[0]!.reference,
            };
            onChange({ ...env, externals: [...env.externals, item] });
            onSelect(`external:${item.id}`);
          }}
        >
          Add external
        </Button>
        <Button
          size="xs"
          variant="default"
          disabled={endpoints.length < 2 || env.interactions.length >= 200}
          onClick={() => {
            const item = {
              id: identity("interaction"),
              kind: "infrastructure" as const,
              from: endpointValue(endpoints[0]!.value),
              to: endpointValue(endpoints[1]!.value),
              description: "Routes traffic",
              protocol: "HTTPS",
            };
            onChange({ ...env, interactions: [...env.interactions, item] });
            onSelect(`interaction:${item.id}`);
          }}
        >
          Add interaction
        </Button>
      </Group>
      <NativeSelect
        label="Plan object"
        value={selected}
        data={[
          { value: "environment", label: "Environment settings" },
          ...env.nodes.map((n) => ({ value: `node:${n.id}`, label: `${n.name} · ${n.kind}` })),
          ...env.instances.map((i) => ({
            value: `instance:${i.id}`,
            label: `${design.elements.find((e) => e.id === i.element)?.name ?? i.element} · instance group`,
          })),
          ...env.externals.map((x) => ({
            value: `external:${x.id}`,
            label: `${x.reference.id} · external`,
          })),
          ...env.interactions.map((i, index) => ({
            value: `interaction:${i.id}`,
            label: `Interaction ${index + 1} · ${i.kind}`,
          })),
        ]}
        onChange={(e) => onSelect(e.currentTarget.value)}
      />
      {selected === "environment" ? (
        <>
          <TextInput
            label="Environment name"
            value={env.name}
            required
            maxLength={120}
            onChange={(e) => onChange({ ...env, name: e.currentTarget.value })}
          />
          <NativeSelect
            label="Delivery alternative"
            value={env.kind}
            data={["Hosted", "Private"]}
            onChange={(e) =>
              onChange({ ...env, kind: e.currentTarget.value as DeploymentEnvironment["kind"] })
            }
          />
          <Textarea
            label="Environment responsibility"
            value={env.description}
            maxLength={240}
            onChange={(e) => onChange({ ...env, description: e.currentTarget.value })}
          />
          <Button color="red" variant="subtle" onClick={onRemove}>
            Remove environment
          </Button>
        </>
      ) : null}
      {node ? (
        <>
          <TextInput
            label="Placement name"
            required
            maxLength={120}
            value={node.name}
            onChange={(e) => changeNode({ name: e.currentTarget.value })}
          />
          <NativeSelect
            label="Parent placement"
            value={node.parent ?? ""}
            data={[
              { value: "", label: "Environment root" },
              ...env.nodes
                .filter((n) => n.kind === "deployment" && n.id !== node.id)
                .map((n) => ({ value: n.id, label: n.name })),
            ]}
            onChange={(e) => changeNode({ parent: e.currentTarget.value || undefined })}
          />
          <TextInput
            label="Technology"
            value={node.technology}
            maxLength={240}
            onChange={(e) => changeNode({ technology: e.currentTarget.value })}
          />
          <Group grow>
            <TextInput
              label="Region"
              value={node.region}
              maxLength={240}
              onChange={(e) => changeNode({ region: e.currentTarget.value })}
            />
            <TextInput
              label="Zone / failure domain"
              value={node.zone}
              maxLength={240}
              onChange={(e) => changeNode({ zone: e.currentTarget.value })}
            />
          </Group>
          <Textarea
            label="Placement responsibility"
            value={node.responsibility}
            maxLength={240}
            onChange={(e) => changeNode({ responsibility: e.currentTarget.value })}
          />
          <NativeSelect
            label="Service operation"
            value={node.operation}
            data={["Unspecified", "Self operated", "Externally operated"]}
            onChange={(e) =>
              changeNode({ operation: e.currentTarget.value as typeof node.operation })
            }
          />
          {node.kind === "infrastructure" ? (
            <>
              <NumberInput
                label="Infrastructure replica count"
                value={node.replicas}
                min={1}
                max={32}
                allowDecimal={false}
                onChange={(value) => changeNode({ replicas: Number(value) })}
              />
              <NativeSelect
                label="Reviewed legacy C2 mapping"
                value={node.legacyElement ?? ""}
                data={[
                  { value: "", label: "New deployment-only infrastructure" },
                  ...design.elements
                    .filter(
                      (e) =>
                        containerClassification(e).kind === "Deployment infrastructure" &&
                        !isExternalResponsibility(e),
                    )
                    .map((e) => ({ value: e.id, label: e.name })),
                ]}
                onChange={(e) => changeNode({ legacyElement: e.currentTarget.value || undefined })}
              />
              {node.legacyElement ? (
                <>
                  <Text size="sm">
                    The C2 identity and its relationships stay intact. Review their meaning before
                    mapping this placement.
                  </Text>
                  <Textarea
                    label="Mapping review reason"
                    required
                    value={node.mappingReason}
                    maxLength={240}
                    onChange={(e) => changeNode({ mappingReason: e.currentTarget.value })}
                  />
                </>
              ) : null}
            </>
          ) : null}
          <Button
            color="red"
            variant="subtle"
            onClick={() => {
              onChange({ ...env, nodes: env.nodes.filter((n) => n.id !== node.id) });
              onSelect("environment");
            }}
          >
            Remove placement
          </Button>
        </>
      ) : null}
      {instance ? (
        <>
          <NativeSelect
            label="Logical C2 identity"
            value={instance.element}
            data={design.elements
              .filter(isDeployableElement)
              .map((e) => ({ value: e.id, label: e.name }))}
            onChange={(e) => changeInstance({ element: e.currentTarget.value })}
          />
          <NativeSelect
            label="Instance placement"
            value={instance.node}
            data={placements}
            onChange={(e) => changeInstance({ node: e.currentTarget.value })}
          />
          <NumberInput
            label="Replica count"
            value={instance.replicas}
            allowDecimal={false}
            min={1}
            max={32}
            onChange={(value) => changeInstance({ replicas: Number(value) })}
          />
          <Button
            color="red"
            variant="subtle"
            onClick={() => {
              onChange({ ...env, instances: env.instances.filter((i) => i.id !== instance.id) });
              onSelect("environment");
            }}
          >
            Remove instance group
          </Button>
        </>
      ) : null}
      {external ? (
        <>
          <NativeSelect
            label="External product"
            value={`${external.reference.kind}:${external.reference.id}`}
            data={deploymentExternalChoices(design)}
            onChange={(e) => {
              const reference = deploymentExternalChoices(design).find(
                (c) => c.value === e.currentTarget.value,
              )!.reference;
              onChange({
                ...env,
                externals: env.externals.map((x) =>
                  x.id === external.id ? { ...x, reference } : x,
                ),
              });
            }}
          />
          <Button
            color="red"
            variant="subtle"
            onClick={() => {
              onChange({ ...env, externals: env.externals.filter((x) => x.id !== external.id) });
              onSelect("environment");
            }}
          >
            Remove external reference
          </Button>
        </>
      ) : null}
      {interaction ? (
        <>
          <NativeSelect
            label="Interaction meaning"
            value={interaction.kind}
            data={[
              { value: "logical", label: "Trace logical relationship" },
              { value: "infrastructure", label: "Deployment-only infrastructure wiring" },
              {
                value: "replica",
                label: "Replica communication",
              },
            ]}
            onChange={(e) => {
              const common = { id: interaction.id, from: interaction.from, to: interaction.to };
              const next =
                e.currentTarget.value === "logical"
                  ? {
                      ...common,
                      kind: "logical" as const,
                      relationship: {
                        kind: "connection" as const,
                        id: design.connections[0]?.id ?? "",
                      },
                    }
                  : {
                      ...common,
                      kind:
                        e.currentTarget.value === "replica"
                          ? ("replica" as const)
                          : ("infrastructure" as const),
                      description:
                        e.currentTarget.value === "replica"
                          ? "Synchronizes replicas"
                          : "Routes traffic",
                      protocol: "Undecided",
                    };
              onChange({
                ...env,
                interactions: env.interactions.map((i) => (i.id === interaction.id ? next : i)),
              });
            }}
          />
          {(["from", "to"] as const).map((side) => (
            <NativeSelect
              key={side}
              label={`Interaction ${side}`}
              value={endpointKey(interaction[side])}
              data={endpoints}
              onChange={(e) =>
                onChange({
                  ...env,
                  interactions: env.interactions.map((i) =>
                    i.id === interaction.id
                      ? { ...i, [side]: endpointValue(e.currentTarget.value) }
                      : i,
                  ),
                })
              }
            />
          ))}
          {interaction.kind === "logical" ? (
            <NativeSelect
              label="Logical relationship"
              value={`${interaction.relationship.kind}:${interaction.relationship.id}`}
              data={[
                { value: "connection:", label: "Choose an existing relationship" },
                ...design.connections.map((c) => ({
                  value: `connection:${c.id}`,
                  label: `${c.id} · ${c.from.element} → ${c.to.element}`,
                })),
                ...(design.architecture?.relationships ?? []).map((c) => ({
                  value: `context:${c.id}`,
                  label: `${c.description} · context`,
                })),
              ]}
              onChange={(e) => {
                const [kind, id] = e.currentTarget.value.split(":");
                onChange({
                  ...env,
                  interactions: env.interactions.map((i) =>
                    i.id === interaction.id
                      ? {
                          ...interaction,
                          relationship: { kind: kind as "connection" | "context", id: id ?? "" },
                        }
                      : i,
                  ),
                });
              }}
            />
          ) : (
            <>
              <TextInput
                label="Deployment interaction purpose"
                value={interaction.description}
                maxLength={240}
                required
                onChange={(e) =>
                  onChange({
                    ...env,
                    interactions: env.interactions.map((i) =>
                      i.id === interaction.id
                        ? { ...interaction, description: e.currentTarget.value }
                        : i,
                    ),
                  })
                }
              />
              <TextInput
                label="Deployment protocol"
                value={interaction.protocol}
                maxLength={120}
                required
                onChange={(e) =>
                  onChange({
                    ...env,
                    interactions: env.interactions.map((i) =>
                      i.id === interaction.id
                        ? { ...interaction, protocol: e.currentTarget.value }
                        : i,
                    ),
                  })
                }
              />
            </>
          )}
          <Button
            color="red"
            variant="subtle"
            onClick={() => {
              onChange({
                ...env,
                interactions: env.interactions.filter((i) => i.id !== interaction.id),
              });
              onSelect("environment");
            }}
          >
            Remove deployment interaction
          </Button>
        </>
      ) : null}
    </Stack>
  );
}

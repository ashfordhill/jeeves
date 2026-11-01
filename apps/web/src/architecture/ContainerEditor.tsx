import {
  type ConfigValues,
  plannedCapability,
  plannedConfigSchema,
  plannedConnectionSchema,
} from "@jeeves/spec";
import { Alert, Button, Group, NativeSelect, Stack, Textarea, TextInput } from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { uniqueId, uniqueName } from "../draw/ids.ts";
import { useDraw } from "../draw/store.ts";
import { CapabilityFields } from "./CapabilityFields.tsx";

/** Create intent directly from the library, without requiring an invisible placement tool. */
export function ContainerEditor({
  capability: id,
  onClose,
  onSaved,
}: {
  capability: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { design } = useDraw((state) => state.loaded)!;
  const capability = plannedCapability(id)!;
  const [baseRevision] = useState(design.revision);
  const [name, setName] = useState(uniqueName(design, capability.name));
  const [description, setDescription] = useState(capability.description);
  const [technology, setTechnology] = useState("");
  const [config, setConfig] = useState<ConfigValues>({});
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError(
        "The design changed. Your draft is retained; reopen it against the latest revision.",
      );
      return;
    }
    setSaving(true);
    const elementId = uniqueId(design, name);
    const ok = await useDraw.getState().edit([
      {
        op: "addElement",
        element: {
          id: elementId,
          name: name.trim(),
          description: description.trim(),
          technology: technology.trim(),
          planned: id,
          template: null,
          config,
          attachments: [],
          notes: "",
        },
      },
    ]);
    setSaving(false);
    if (ok) {
      onSaved(elementId);
      onClose();
    } else setError(useDraw.getState().notice?.message ?? "Could not add this container.");
  };
  return (
    <ConfigurationDialog
      title={`Add ${capability.name.toLowerCase()}`}
      size="lg"
      onClose={onClose}
      footer={
        <Group justify="flex-end">
          <Button variant="default" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="cyan.9"
            loading={saving}
            disabled={!name.trim() || !plannedConfigSchema(id).safeParse(config).success}
            onClick={() => void save()}
          >
            Add to design
          </Button>
        </Group>
      }
    >
      <Stack gap="md">
        <TextInput
          label="Container name"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Textarea
          label="Responsibility"
          value={description}
          maxLength={240}
          minRows={2}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <TextInput
          label="Technology"
          placeholder="e.g. Kotlin · Spring Boot"
          value={technology}
          maxLength={120}
          onChange={(e) => setTechnology(e.currentTarget.value)}
        />
        <CapabilityFields capability={id} config={config} onChange={setConfig} />
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}

export function ContainerRelationshipEditor({
  from,
  component,
  onClose,
  onSaved,
}: {
  from?: string;
  component?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { design } = useDraw((state) => state.loaded)!;
  const [baseRevision] = useState(design.revision);
  const [source, setSource] = useState(from ?? design.elements[0]?.id ?? "");
  const [target, setTarget] = useState(design.elements.find((e) => e.id !== source)?.id ?? "");
  const [draft, setDraft] = useState(() => ({
    ...plannedConnectionSchema.parse({ label: "Uses" }),
    label: "",
  }));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const options = design.elements.map((e) => ({ value: e.id, label: e.name }));
  const save = async () => {
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError("The design changed. Cancel and reopen to review current containers.");
      return;
    }
    setSaving(true);
    const id = uniqueId(design, `${source}-${target}`);
    const ok = await useDraw.getState().edit([
      {
        op: "connect",
        connection: {
          id,
          kind: "depends-on",
          from: { element: source },
          to: { element: target },
          planned: { ...draft, label: draft.label.trim() },
        },
      },
      ...(component && design.architecture
        ? [
            {
              op: "setArchitecture" as const,
              architecture: {
                ...design.architecture,
                components: design.architecture.components?.map((item) =>
                  item.id === component
                    ? { ...item, usesConnections: [...item.usesConnections, id] }
                    : item,
                ),
              },
            },
          ]
        : []),
    ]);
    setSaving(false);
    if (ok) {
      onSaved(id);
      onClose();
    } else setError(useDraw.getState().notice?.message ?? "Could not save this relationship.");
  };
  return (
    <ConfigurationDialog
      title="Connect containers"
      size="lg"
      onClose={onClose}
      footer={
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            color="cyan.9"
            loading={saving}
            disabled={
              !source ||
              !target ||
              source === target ||
              !plannedConnectionSchema.safeParse(draft).success
            }
            onClick={() => void save()}
          >
            Save relationship
          </Button>
        </Group>
      }
    >
      <Stack gap="md">
        <NativeSelect
          label="From container"
          disabled={!!component}
          data={options}
          value={source}
          onChange={(e) => setSource(e.currentTarget.value)}
        />
        <NativeSelect
          label="To container"
          data={options}
          value={target}
          onChange={(e) => setTarget(e.currentTarget.value)}
        />
        <TextInput
          label="Relationship"
          description="Use a directional verb that explains the collaboration."
          placeholder="e.g. Reads published videos from"
          value={draft.label}
          maxLength={120}
          onChange={(e) => setDraft({ ...draft, label: e.currentTarget.value })}
        />
        <TextInput
          label="Protocol"
          placeholder="e.g. HTTPS/JSON, gRPC, PostgreSQL"
          maxLength={80}
          value={draft.protocol}
          onChange={(e) => setDraft({ ...draft, protocol: e.currentTarget.value })}
        />
        <NativeSelect
          label="Interaction"
          data={plannedConnectionSchema.shape.interaction.unwrap().options}
          value={draft.interaction}
          onChange={(e) =>
            setDraft({
              ...draft,
              interaction: plannedConnectionSchema.shape.interaction.parse(e.currentTarget.value),
            })
          }
        />
        <NativeSelect
          label="Access boundary"
          data={plannedConnectionSchema.shape.security.unwrap().options}
          value={draft.security}
          onChange={(e) =>
            setDraft({
              ...draft,
              security: plannedConnectionSchema.shape.security.parse(e.currentTarget.value),
            })
          }
        />
        <p className="catalog-intro">
          The arrow records architecture intent. Select it afterward to attach interface contracts
          and failure policies.
        </p>
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}

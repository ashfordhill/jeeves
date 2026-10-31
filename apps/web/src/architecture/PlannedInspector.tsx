import {
  type Connection,
  type Element,
  plannedCapability,
  plannedConfigSchema,
  plannedConnectionSchema,
} from "@jeeves/spec";
import { Alert, Button, Group, NativeSelect, Stack, Textarea, TextInput } from "@mantine/core";
import { useState } from "react";
import { useDraw } from "../draw/store.ts";
import { CapabilityFields } from "./CapabilityFields.tsx";
import { useEditorDraft } from "./editor-drafts.tsx";
import { elementFamily, TypeBadge } from "./type-style.tsx";

export function PlannedElementInspector({
  element,
  onComponents,
}: {
  element: Element;
  onComponents?: () => void;
}) {
  const loaded = useDraw((state) => state.loaded)!;
  const capability = plannedCapability(element.planned)!;
  const { draft, setDraft, baseRevision, setBaseRevision } = useEditorDraft(
    `element:${element.id}`,
    {
      name: element.name,
      notes: element.notes,
      config: structuredClone(element.config),
    },
    loaded.design.revision,
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const valid =
    draft.name.trim().length > 0 &&
    draft.name.trim().length <= 120 &&
    plannedConfigSchema(capability.id).safeParse(draft.config).success;
  const changed =
    JSON.stringify(draft) !==
    JSON.stringify({ name: element.name, notes: element.notes, config: element.config });
  const save = async () => {
    if (!valid || saving) return;
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError("The design changed. Cancel to load the latest version; your draft is still here.");
      return;
    }
    setSaving(true);
    const ok = await useDraw.getState().edit([
      { op: "updateElement", id: element.id, name: draft.name, config: draft.config },
      { op: "setNotes", id: element.id, notes: draft.notes },
    ]);
    setSaving(false);
    if (ok) {
      setBaseRevision(useDraw.getState().loaded!.design.revision);
      setError(undefined);
    } else setError(useDraw.getState().notice?.message ?? "Could not save this draft.");
  };
  return (
    <section
      className="planned-inspector"
      data-family={elementFamily(element)}
      aria-label={`Configure ${element.name}`}
    >
      <TypeBadge family={elementFamily(element)} />
      <span className="capability-status">Planned capability</span>
      <h2>{element.name}</h2>
      <p className="inspector-empty">{capability.description}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Name"
            value={draft.name}
            maxLength={120}
            onChange={(event) => setDraft({ ...draft, name: event.currentTarget.value })}
          />
          <CapabilityFields
            capability={capability.id}
            config={draft.config}
            onChange={(config) => setDraft({ ...draft, config })}
          />
          <Textarea
            label="Responsibility & design notes"
            minRows={3}
            autosize
            maxRows={7}
            value={draft.notes}
            onChange={(event) => setDraft({ ...draft, notes: event.currentTarget.value })}
          />
          {error ? (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          ) : null}
          <Group className="inspector-draft-actions" gap="xs">
            <Button
              type="submit"
              color="cyan.9"
              size="xs"
              disabled={!valid || !changed}
              loading={saving}
            >
              Save options
            </Button>
            <Button
              size="xs"
              variant="default"
              disabled={saving || !changed}
              onClick={() => {
                setDraft({
                  name: element.name,
                  notes: element.notes,
                  config: structuredClone(element.config),
                });
                setBaseRevision(loaded.design.revision);
                setError(undefined);
              }}
            >
              Cancel
            </Button>
          </Group>
        </Stack>
      </form>
      {onComponents && ["service", "frontend", "worker"].includes(capability.role) ? (
        <Button mt="md" variant="default" fullWidth onClick={onComponents}>
          Open components
        </Button>
      ) : null}
      <p className="planned-footnote">
        Saved as architecture intent. Runtime and generation come later.
      </p>
      <Button
        variant="subtle"
        color="red"
        size="xs"
        onClick={() => void useDraw.getState().edit([{ op: "removeElement", id: element.id }])}
      >
        Remove {capability.name.toLowerCase()}
      </Button>
    </section>
  );
}

export function PlannedConnectionInspector({ connection }: { connection: Connection }) {
  const loaded = useDraw((state) => state.loaded)!;
  const { draft, setDraft, baseRevision, setBaseRevision } = useEditorDraft(
    `connection:${connection.id}`,
    connection,
    loaded.design.revision,
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const planned = draft.planned!;
  const update = (patch: Partial<typeof planned>) =>
    setDraft({ ...draft, planned: { ...planned, ...patch } });
  const schema = plannedConnectionSchema.shape;
  const changed = JSON.stringify(draft) !== JSON.stringify(connection);
  const save = async () => {
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError("The design changed. Cancel to reload it; your draft is retained.");
      return;
    }
    setSaving(true);
    const ok = await useDraw.getState().edit([
      { op: "disconnect", id: connection.id },
      { op: "connect", connection: draft },
    ]);
    setSaving(false);
    if (ok) {
      setBaseRevision(useDraw.getState().loaded!.design.revision);
      setError(undefined);
    } else setError(useDraw.getState().notice?.message ?? "Could not save relationship.");
  };
  return (
    <section className="planned-inspector" aria-label="Configure planned relationship">
      <span className="capability-status">Planned relationship</span>
      <h2>{connection.planned?.label}</h2>
      <Stack gap="sm">
        <TextInput
          label="Relationship label"
          value={planned.label}
          onChange={(event) => update({ label: event.currentTarget.value })}
        />
        {(["from", "to"] as const).map((side) => (
          <NativeSelect
            key={side}
            label={side === "from" ? "From" : "To"}
            data={loaded.design.elements.map((element) => ({
              value: element.id,
              label: element.name,
            }))}
            value={draft[side].element}
            onChange={(event) =>
              setDraft({ ...draft, [side]: { element: event.currentTarget.value } })
            }
          />
        ))}
        <NativeSelect
          label="Protocol"
          data={schema.protocol.unwrap().options}
          value={planned.protocol}
          onChange={(event) =>
            update({ protocol: event.currentTarget.value as typeof planned.protocol })
          }
        />
        <NativeSelect
          label="Interaction"
          data={schema.interaction.unwrap().options}
          value={planned.interaction}
          onChange={(event) =>
            update({ interaction: event.currentTarget.value as typeof planned.interaction })
          }
        />
        <NativeSelect
          label="Security"
          data={schema.security.unwrap().options}
          value={planned.security}
          onChange={(event) =>
            update({ security: event.currentTarget.value as typeof planned.security })
          }
        />
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
        <Group className="inspector-draft-actions" gap="xs">
          <Button
            size="xs"
            color="cyan.9"
            loading={saving}
            disabled={
              !changed ||
              !plannedConnectionSchema.safeParse(planned).success ||
              draft.from.element === draft.to.element
            }
            onClick={() => void save()}
          >
            Save relationship
          </Button>
          <Button
            size="xs"
            variant="default"
            disabled={!changed || saving}
            onClick={() => {
              setDraft(structuredClone(connection));
              setBaseRevision(loaded.design.revision);
              setError(undefined);
            }}
          >
            Cancel
          </Button>
        </Group>
      </Stack>
      <p className="planned-footnote">
        Declares intended communication. It does not create runtime wiring.
      </p>
      <Button
        variant="subtle"
        color="red"
        size="xs"
        onClick={() => void useDraw.getState().edit([{ op: "disconnect", id: connection.id }])}
      >
        Delete connection
      </Button>
    </section>
  );
}

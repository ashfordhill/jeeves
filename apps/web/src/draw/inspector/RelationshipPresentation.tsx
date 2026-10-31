import {
  type Connection,
  connectionPresentation,
  relationshipInteractionSchema,
  relationshipLabelSchema,
  relationshipProtocolSchema,
} from "@jeeves/spec";
import { Alert, Button, Group, NativeSelect, Stack, TextInput } from "@mantine/core";
import { useState } from "react";
import { useEditorDraft } from "../../architecture/editor-drafts.tsx";
import { useDraw } from "../store.ts";

export function RelationshipPresentation({ connection }: { connection: Connection }) {
  const loaded = useDraw((state) => state.loaded)!;
  const incoming = {
    label: connection.label ?? "",
    protocol: connection.protocol ?? "",
    interaction: connection.interaction ?? "Request / response",
  };
  const defaults = connectionPresentation(
    { ...connection, label: undefined, protocol: undefined },
    loaded.design,
  );
  const { draft, setDraft, baseRevision, resetDraft } = useEditorDraft(
    `relationship-presentation:${connection.id}`,
    incoming,
    loaded.design.revision,
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const changed = JSON.stringify(draft) !== JSON.stringify(incoming);
  const valid =
    relationshipLabelSchema.safeParse(draft.label).success &&
    (!draft.protocol || relationshipProtocolSchema.safeParse(draft.protocol).success);
  const save = async () => {
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError(
        "The design changed. Cancel to load the latest relationship; your draft is retained.",
      );
      return;
    }
    setSaving(true);
    const ok = await useDraw.getState().edit([
      {
        op: "updateConnection",
        id: connection.id,
        label: draft.label,
        protocol: draft.protocol || defaults.protocol,
        interaction: draft.interaction,
      },
    ]);
    setSaving(false);
    if (ok) {
      const current = useDraw.getState().loaded!.design;
      const saved = current.connections.find((item) => item.id === connection.id)!;
      resetDraft(
        {
          label: saved.label ?? "",
          protocol: saved.protocol ?? "",
          interaction: saved.interaction ?? "Request / response",
        },
        current.revision,
      );
      setError(undefined);
    } else setError(useDraw.getState().notice?.message ?? "Could not save relationship.");
  };
  return (
    <Stack gap="xs">
      <TextInput
        label="Relationship label"
        placeholder={defaults.description}
        maxLength={120}
        value={draft.label}
        onChange={(event) => setDraft({ ...draft, label: event.currentTarget.value })}
      />
      <TextInput
        label="Protocol"
        placeholder={defaults.protocol}
        maxLength={80}
        value={draft.protocol}
        onChange={(event) => setDraft({ ...draft, protocol: event.currentTarget.value })}
      />
      <NativeSelect
        label="Interaction"
        data={relationshipInteractionSchema.options}
        value={draft.interaction}
        onChange={(event) =>
          setDraft({
            ...draft,
            interaction: relationshipInteractionSchema.parse(event.currentTarget.value),
          })
        }
      />
      <p className="inspector-empty">
        Diagram presentation. Transport and runtime wiring follow the selected capabilities.
      </p>
      {error ? (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      ) : null}
      <Group gap="xs">
        <Button
          size="xs"
          color="cyan.9"
          disabled={!changed || !valid}
          loading={saving}
          onClick={() => void save()}
        >
          Save relationship
        </Button>
        <Button
          size="xs"
          variant="default"
          disabled={!changed || saving}
          onClick={() => {
            resetDraft(incoming, loaded.design.revision);
            setError(undefined);
          }}
        >
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}

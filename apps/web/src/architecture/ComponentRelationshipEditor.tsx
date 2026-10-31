import type { DesignDocument } from "@jeeves/spec";
import { Alert, Button, Group, NativeSelect, Stack, TextInput } from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useDraw } from "../draw/store.ts";

export function ComponentRelationshipEditor({
  design,
  element,
  id,
  onClose,
  onSaved,
}: {
  design: DesignDocument;
  element: string;
  id?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const components =
    design.architecture?.components?.filter((item) => item.element === element) ?? [];
  const [baseRevision] = useState(design.revision);
  const [draft, setDraft] = useState(() =>
    structuredClone(
      design.architecture?.componentRelationships?.find((item) => item.id === id) ?? {
        id: `relationship-${crypto.randomUUID().slice(0, 8)}`,
        from: components[0]?.id ?? "",
        to: components[1]?.id ?? "",
        description: "Uses",
      },
    ),
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const save = async (remove = false) => {
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError("The design changed. Cancel and reopen to review the current relationships.");
      return;
    }
    if (!design.architecture) return;
    setSaving(true);
    const remaining = (design.architecture.componentRelationships ?? []).filter(
      (item) => item.id !== draft.id,
    );
    const ok = await useDraw.getState().edit([
      {
        op: "setArchitecture",
        architecture: {
          ...design.architecture,
          componentRelationships: remove ? remaining : [...remaining, draft],
        },
      },
    ]);
    setSaving(false);
    if (ok) {
      if (!remove) onSaved(draft.id);
      onClose();
    } else setError(useDraw.getState().notice?.message ?? "Could not save relationship.");
  };
  const options = components.map((item) => ({ value: item.id, label: item.name }));
  return (
    <ConfigurationDialog
      title="Component relationship"
      size="lg"
      onClose={onClose}
      footer={
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            color="cyan.9"
            disabled={
              !draft.from || !draft.to || draft.from === draft.to || !draft.description.trim()
            }
            loading={saving}
            onClick={() => void save()}
          >
            Save relationship
          </Button>
        </Group>
      }
    >
      <Stack gap="md">
        <p>Document intended collaboration. This arrow does not create runtime calls.</p>
        <NativeSelect
          label="From component"
          data={options}
          value={draft.from}
          onChange={(event) => setDraft({ ...draft, from: event.currentTarget.value })}
        />
        <NativeSelect
          label="To component"
          data={options}
          value={draft.to}
          onChange={(event) => setDraft({ ...draft, to: event.currentTarget.value })}
        />
        <TextInput
          label="Relationship label"
          maxLength={240}
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.currentTarget.value })}
        />
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
        {id ? (
          <Button variant="subtle" color="red" onClick={() => void save(true)}>
            Remove relationship
          </Button>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}

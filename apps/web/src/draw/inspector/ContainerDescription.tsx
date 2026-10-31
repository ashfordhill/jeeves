import type { Element } from "@jeeves/spec";
import { Alert, Button, Group, Stack, Textarea } from "@mantine/core";
import { useState } from "react";
import { useEditorDraft } from "../../architecture/editor-drafts.tsx";
import { useDraw } from "../store.ts";

/** Explicit description draft retains its original revision through selection and conflicts. */
export function ContainerDescription({ element }: { element: Element }) {
  const loaded = useDraw((state) => state.loaded)!;
  const { draft, setDraft, baseRevision, resetDraft } = useEditorDraft(
    `description:${element.id}`,
    element.description ?? "",
    loaded.design.revision,
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const changed = draft !== (element.description ?? "");
  const save = async () => {
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError(
        "The design changed. Cancel to load the latest description; your draft is retained.",
      );
      return;
    }
    setSaving(true);
    const ok = await useDraw
      .getState()
      .edit([{ op: "updateElement", id: element.id, description: draft }]);
    setSaving(false);
    if (ok) {
      resetDraft(draft.trim(), useDraw.getState().loaded!.design.revision);
      setError(undefined);
    } else setError(useDraw.getState().notice?.message ?? "Could not save description.");
  };
  return (
    <Stack gap="xs">
      <Textarea
        label="Description"
        description="One-line container responsibility (up to 240 characters)."
        value={draft}
        maxLength={240}
        minRows={2}
        onChange={(event) => setDraft(event.currentTarget.value)}
      />
      {error ? (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      ) : null}
      <Group gap="xs">
        <Button
          size="xs"
          color="cyan.9"
          disabled={!changed || draft.trim().length > 240}
          loading={saving}
          onClick={() => void save()}
        >
          Save description
        </Button>
        <Button
          size="xs"
          variant="default"
          disabled={!changed || saving}
          onClick={() => {
            resetDraft(element.description ?? "", loaded.design.revision);
            setError(undefined);
          }}
        >
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}

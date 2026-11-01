import { classificationSchema, type Element } from "@jeeves/spec";
import { Alert, Button, Group, Stack, Textarea } from "@mantine/core";
import { useState } from "react";
import { ClassificationFields } from "../../architecture/ArchitectureChoices.tsx";
import { useEditorDraft } from "../../architecture/editor-drafts.tsx";
import { useDraw } from "../store.ts";

/** Explicit description draft retains its original revision through selection and conflicts. */
export function ContainerDescription({ element }: { element: Element }) {
  const loaded = useDraw((state) => state.loaded)!;
  const { draft, setDraft, baseRevision, resetDraft } = useEditorDraft(
    `description:${element.id}`,
    { description: element.description ?? "", classification: element.classification },
    loaded.design.revision,
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const changed =
    JSON.stringify(draft) !==
    JSON.stringify({
      description: element.description ?? "",
      classification: element.classification,
    });
  const save = async () => {
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError(
        "The design changed. Cancel to load the latest description; your draft is retained.",
      );
      return;
    }
    setSaving(true);
    const ok = await useDraw.getState().edit([
      {
        op: "updateElement",
        id: element.id,
        description: draft.description,
        classification: draft.classification,
      },
    ]);
    setSaving(false);
    if (ok) {
      resetDraft(
        { ...draft, description: draft.description.trim() },
        useDraw.getState().loaded!.design.revision,
      );
      setError(undefined);
    } else setError(useDraw.getState().notice?.message ?? "Could not save description.");
  };
  return (
    <Stack gap="xs">
      <Textarea
        label="Description"
        description="One-line container responsibility (up to 240 characters)."
        value={draft.description}
        maxLength={240}
        minRows={2}
        onChange={(event) => setDraft({ ...draft, description: event.currentTarget.value })}
      />
      <ClassificationFields
        element={element}
        value={draft.classification}
        onChange={(classification) => setDraft({ ...draft, classification })}
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
          disabled={
            !changed ||
            draft.description.trim().length > 240 ||
            !classificationSchema.optional().safeParse(draft.classification).success
          }
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
            resetDraft(
              { description: element.description ?? "", classification: element.classification },
              loaded.design.revision,
            );
            setError(undefined);
          }}
        >
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}

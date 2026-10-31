import { type Attachment, type ResourceConfig, resourceConfigSchema } from "@jeeves/spec";
import {
  Alert,
  Button,
  Group,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { useEditorDraft } from "../architecture/editor-drafts.tsx";
import { useDraw } from "../draw/store.ts";

type Extension = ResourceConfig["extensions"][number];
export function extensionDraft(extension: Extension) {
  return {
    path: extension.path,
    method: extension.method,
    access: extension.access,
    notes: extension.notes,
    contract: JSON.stringify(extension.contract, null, 2),
  };
}
/** Validate the entire model; never parse into a lossy subset or persist normalized defaults. */
export function applyExtensionDraft(
  model: ResourceConfig,
  id: string,
  draft: ReturnType<typeof extensionDraft>,
) {
  const next = {
    ...model,
    extensions: model.extensions.map((e) =>
      e.id === id
        ? {
            ...e,
            path: draft.path,
            method: draft.method,
            access: draft.access,
            notes: draft.notes,
            contract: JSON.parse(draft.contract),
          }
        : e,
    ),
  };
  resourceConfigSchema.parse(next);
  return next;
}
export function ExtensionEditor({
  attachment,
  extension,
  onDone,
}: {
  attachment: Attachment;
  extension: Extension;
  onDone: () => void;
}) {
  const loaded = useDraw((s) => s.loaded)!;
  const { draft, setDraft, baseRevision, resetDraft } = useEditorDraft(
    `api-extension:${loaded.project.id}:${attachment.id}:${extension.id}`,
    extensionDraft(extension),
    loaded.design.revision,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const conflict =
    baseRevision !== loaded.design.revision
      ? "The design changed while this draft was open. Your draft is retained. Cancel to load the saved contract before editing again."
      : undefined;
  let validation: string | undefined;
  try {
    applyExtensionDraft(attachment.config.model as ResourceConfig, extension.id, draft);
  } catch (failure) {
    validation = failure instanceof Error ? failure.message : "Invalid contract";
  }
  const save = async () => {
    if (validation || saving) return;
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError(
        "The design changed while this draft was open. Your draft is retained. Cancel to load the saved contract before editing again.",
      );
      return;
    }
    setSaving(true);
    const model = applyExtensionDraft(
      attachment.config.model as ResourceConfig,
      extension.id,
      draft,
    );
    const ok = await useDraw
      .getState()
      .edit([
        { op: "updateAttachment", id: attachment.id, config: { ...attachment.config, model } },
      ]);
    setSaving(false);
    if (ok) {
      resetDraft(draft, useDraw.getState().loaded!.design.revision);
      onDone();
    } else
      setError(
        useDraw.getState().notice?.message ??
          "Contract could not be saved. Your draft is retained.",
      );
  };
  const cancel = () => {
    resetDraft(extensionDraft(extension), loaded.design.revision);
    setError(undefined);
    onDone();
  };
  return (
    <section aria-label="Edit operation" className="api-extension-editor">
      <Stack gap="sm">
        {error || conflict ? (
          <Alert color="red" role="alert">
            {error ?? conflict}
          </Alert>
        ) : null}

        <Group grow>
          <NativeSelect
            label="Method"
            data={["GET", "POST"]}
            value={draft.method}
            onChange={(e) =>
              setDraft({ ...draft, method: e.currentTarget.value as Extension["method"] })
            }
          />
          <NativeSelect
            label="Access"
            data={[
              { value: "owner", label: "Signed-in owner" },
              { value: "public", label: "Public" },
            ]}
            value={draft.access}
            onChange={(e) =>
              setDraft({ ...draft, access: e.currentTarget.value as Extension["access"] })
            }
          />
        </Group>
        <TextInput
          label="Full path"
          value={draft.path}
          onChange={(e) => setDraft({ ...draft, path: e.currentTarget.value })}
        />
        <Textarea
          label="Implementation notes"
          autosize
          minRows={2}
          maxRows={6}
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.currentTarget.value })}
        />
        <Textarea
          label="Supported contract (JSON)"
          description="Parameters, optional JSON requestBody and responses. All schema fields, examples, media and headers are preserved. GET/POST only; generated CRUD belongs in Configure resources."
          className="api-contract-input"
          autosize
          minRows={12}
          maxRows={24}
          value={draft.contract}
          onChange={(e) => setDraft({ ...draft, contract: e.currentTarget.value })}
        />
        {validation ? (
          <Alert color="red" role="alert">
            {validation}
          </Alert>
        ) : null}
        <Text size="xs">
          Changes apply to the saved design. Closing this workspace keeps the draft.
        </Text>
        <Group className="api-draft-actions" justify="flex-end">
          <Button variant="default" onClick={cancel}>
            Cancel operation
          </Button>
          <Button disabled={!!validation} loading={saving} onClick={() => void save()}>
            Save operation
          </Button>
        </Group>
      </Stack>
    </section>
  );
}

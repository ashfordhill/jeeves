import {
  type Attachment,
  type Element,
  type Resource,
  resourceDisplayLabel,
  type WorkspaceConfig,
  type WorkspaceSelection,
  workspaceConfigSchema,
  workspaceResources,
  workspaceSource,
} from "@jeeves/spec";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  NativeSelect,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../../components/ConfigurationDialog.tsx";
import { useDraw } from "../store.ts";
import "./workspace-editor.css";

const draftSchema = workspaceConfigSchema.partial({ connection: true, collections: true });
const initialSelection = (resource: Resource): WorkspaceSelection => {
  const primary = resource.fields.find((field) => field.type === "text")?.id ?? "$id";
  return {
    resource: resource.id,
    label: `${resourceDisplayLabel(resource.name)} records`,
    singularLabel: resourceDisplayLabel(resource.name),
    primaryField: primary,
    columns: [...resource.fields.slice(0, 3).map((field) => field.id), "$createdAt"],
  };
};
export function WorkspaceConfiguration({
  element,
  attachment,
}: {
  element: Element;
  attachment: Attachment;
}) {
  const [opened, setOpened] = useState(false);
  const parsed = workspaceConfigSchema.safeParse(attachment.config);
  return (
    <Stack gap="xs">
      <Text size="xs">
        {parsed.success
          ? `${parsed.data.collections.length} collections · ${parsed.data.preset}`
          : "Choose an API and the owner resources to show."}
      </Text>
      <Button size="xs" variant="default" onClick={() => setOpened(true)}>
        Configure resource workspace
      </Button>
      {opened ? (
        <WorkspaceEditor
          element={element}
          attachment={attachment}
          onClose={() => setOpened(false)}
        />
      ) : null}
    </Stack>
  );
}
function WorkspaceEditor({
  element,
  attachment,
  onClose,
}: {
  element: Element;
  attachment: Attachment;
  onClose: () => void;
}) {
  const [design] = useState(useDraw.getState().loaded!.design);
  const [initial] = useState(() => draftSchema.safeParse(attachment.config));
  const [draft, setDraft] = useState<WorkspaceConfig>(() =>
    initial.success
      ? {
          ...initial.data,
          connection: initial.data.connection ?? "",
          collections: structuredClone(initial.data.collections ?? []),
        }
      : { connection: "", tagline: "", preset: "midnight", pageSize: 25, collections: [] },
  );
  const [selectedId, setSelectedId] = useState(draft.collections[0]?.resource ?? "");
  const [saving, setSaving] = useState(false),
    [error, setError] = useState<string>();
  const sources = design.connections
    .filter((connection) => connection.from.element === element.id && connection.kind === "calls")
    .map((connection) => {
      try {
        return { source: workspaceSource(design, element.id, connection.id), id: connection.id };
      } catch {
        return undefined;
      }
    })
    .filter((item) => item !== undefined);
  const source = sources.find((item) => item.id === draft.connection)?.source;
  let invalid: string | undefined;
  const parsed = workspaceConfigSchema.safeParse(draft);
  if (!initial.success)
    invalid =
      "This stored configuration is invalid. It has been preserved; repair its design contract before using the structured editor.";
  else if (!source)
    invalid = "Connect a REST client to a session resource API, then choose that connection.";
  else if (!parsed.success) invalid = parsed.error.issues.map((issue) => issue.message).join(" ");
  else {
    try {
      workspaceResources(source.model, parsed.data);
    } catch (issue) {
      invalid = issue instanceof Error ? issue.message : "Invalid selection";
    }
  }
  const selected = draft.collections.find((item) => item.resource === selectedId);
  const resource = source?.model.resources.find((item) => item.id === selectedId);
  const displayOptions = resource
    ? [
        ...resource.fields.map((field) => ({
          value: field.id,
          label: resourceDisplayLabel(field.name),
        })),
        { value: "$id", label: "Record ID" },
        { value: "$createdAt", label: "Created" },
      ]
    : [];
  const changeSelection = (change: Partial<WorkspaceSelection>) =>
    setDraft((value) => ({
      ...value,
      collections: value.collections.map((item) =>
        item.resource === selectedId ? { ...item, ...change } : item,
      ),
    }));
  const toggle = (item: Resource, checked: boolean) => {
    setDraft((value) => ({
      ...value,
      collections: checked
        ? [...value.collections, initialSelection(item)]
        : value.collections.filter((selection) => selection.resource !== item.id),
    }));
    if (checked) setSelectedId(item.id);
    else if (selectedId === item.id)
      setSelectedId(
        draft.collections.find((selection) => selection.resource !== item.id)?.resource ?? "",
      );
  };
  const save = async () => {
    if (invalid || !parsed.success || saving) return;
    if (useDraw.getState().loaded?.design.revision !== design.revision) {
      setError("The design changed while this draft was open. Close and reopen before saving.");
      return;
    }
    setSaving(true);
    const ok = await useDraw
      .getState()
      .edit([{ op: "updateAttachment", id: attachment.id, config: parsed.data }]);
    if (ok) onClose();
    else {
      setSaving(false);
      setError(useDraw.getState().notice?.message ?? "Configuration could not be saved.");
    }
  };
  return (
    <ConfigurationDialog
      title="Configure resource workspace"
      size="xl"
      onClose={() => {
        if (!saving) onClose();
      }}
      footer={
        <Group justify="space-between">
          <Text size="xs">Changes apply on Save; generate to update the application.</Text>
          <Group>
            <Button variant="default" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button
              color="cyan.9"
              disabled={!!invalid || saving}
              loading={saving}
              onClick={() => void save()}
            >
              Save workspace configuration
            </Button>
          </Group>
        </Group>
      }
    >
      <Stack gap="md">
        <Text size="sm">
          Generate account access, owner-record pages and forms from the connected API. Field types
          and access rules come from that contract. Custom content stays separate.
        </Text>
        {error ? (
          <Alert color="red" title="Could not save">
            {error}
          </Alert>
        ) : null}
        <fieldset className="workspace-editor-controls" disabled={saving || !initial.success}>
          <NativeSelect
            label="Resource API connection"
            value={draft.connection}
            data={[
              { value: "", label: "Choose a connected session API" },
              ...sources.map((item) => ({
                value: item.id,
                label: `${design.elements.find((candidate) => candidate.id === item.source.service)?.name ?? item.source.service} · ${item.id}`,
              })),
            ]}
            onChange={(event) => {
              const connection = event.currentTarget.value;
              setDraft((value) => ({
                ...value,
                connection,
                collections: [],
              }));
              setSelectedId("");
            }}
            description="Changing a published API binding requires a reviewed adoption; Save does not migrate it."
          />
          <TextInput
            label="Workspace tagline"
            maxLength={140}
            value={draft.tagline}
            onChange={(event) => setDraft({ ...draft, tagline: event.currentTarget.value })}
          />
          <div className="workspace-editor-options">
            <NativeSelect
              label="Visual preset"
              value={draft.preset}
              data={[
                { value: "midnight", label: "Midnight · navy and sky" },
                { value: "paper", label: "Paper · warm white and teal" },
              ]}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  preset: event.currentTarget.value as WorkspaceConfig["preset"],
                })
              }
            />
            <NativeSelect
              label="Records per page"
              value={String(draft.pageSize)}
              data={["10", "25", "50"]}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  pageSize: Number(event.currentTarget.value) as WorkspaceConfig["pageSize"],
                })
              }
            />
          </div>
          <fieldset
            className="workspace-preset-preview"
            data-preset={draft.preset}
            aria-label={`${draft.preset} workspace preview`}
          >
            <span className="workspace-preview-mark" aria-hidden="true">
              {String(element.config.title ?? element.name)
                .slice(0, 1)
                .toUpperCase()}
            </span>
            <div>
              <strong>{String(element.config.title ?? element.name)}</strong>
              <span>{draft.tagline || "Your records, clearly organized."}</span>
            </div>
            <small>Preset preview</small>
          </fieldset>
          {source ? (
            <div className="workspace-editor-layout">
              <fieldset className="workspace-editor-collections">
                <legend>Visible collections</legend>
                {source.model.resources.map((item) => {
                  const available =
                    item.access === "owner" &&
                    item.operations.includes("read") &&
                    item.operations.includes("list");
                  return (
                    <Checkbox
                      key={item.id}
                      label={resourceDisplayLabel(item.name)}
                      description={
                        available ? item.operations.join(" · ") : "Needs owner list and read access"
                      }
                      checked={draft.collections.some(
                        (selection) => selection.resource === item.id,
                      )}
                      disabled={!available}
                      onChange={(event) => toggle(item, event.currentTarget.checked)}
                    />
                  );
                })}
                {source.model.resources.length === 0 ? (
                  <Text size="sm">Configure API resources first.</Text>
                ) : null}
              </fieldset>
              <Stack gap="sm" className="workspace-editor-display">
                <NativeSelect
                  label="Edit display for"
                  value={selectedId}
                  data={[
                    { value: "", label: "Select a visible collection" },
                    ...draft.collections.map((item) => ({
                      value: item.resource,
                      label: item.label || item.resource,
                    })),
                  ]}
                  onChange={(event) => setSelectedId(event.currentTarget.value)}
                />
                {selected && resource ? (
                  <>
                    <TextInput
                      label="Collection label"
                      maxLength={80}
                      value={selected.label}
                      onChange={(event) => changeSelection({ label: event.currentTarget.value })}
                    />
                    <TextInput
                      label="Single record label"
                      maxLength={80}
                      value={selected.singularLabel}
                      onChange={(event) =>
                        changeSelection({ singularLabel: event.currentTarget.value })
                      }
                    />
                    <NativeSelect
                      label="Record title field"
                      value={selected.primaryField}
                      data={displayOptions}
                      onChange={(event) =>
                        changeSelection({ primaryField: event.currentTarget.value })
                      }
                    />
                    <fieldset className="workspace-editor-columns">
                      <legend>Table columns · select one to six</legend>
                      {displayOptions.map((option) => (
                        <Checkbox
                          key={option.value}
                          label={option.label}
                          checked={selected.columns.includes(option.value)}
                          disabled={
                            selected.columns.length >= 6 && !selected.columns.includes(option.value)
                          }
                          onChange={(event) =>
                            changeSelection({
                              columns: event.currentTarget.checked
                                ? [...selected.columns, option.value]
                                : selected.columns.filter((field) => field !== option.value),
                            })
                          }
                        />
                      ))}
                    </fieldset>
                    <Group gap="xs" role="group" aria-label="Generated operations">
                      {resource.operations.map((operation) => (
                        <Badge variant="light" key={operation}>
                          {operation}
                        </Badge>
                      ))}
                    </Group>
                    <Text size="xs">
                      {resource.fields.length} fields from the API · identity and generated
                      timestamps are read-only.{" "}
                      {resource.belongsTo.length
                        ? `Required parents: ${resource.belongsTo.map((relation) => relation.resource).join(", ")}. Include each parent collection.`
                        : "No required parent records."}
                    </Text>
                  </>
                ) : (
                  <Text size="sm">
                    Select collections on the left, then set their display labels and fields.
                  </Text>
                )}
              </Stack>
            </div>
          ) : null}
        </fieldset>
        {invalid ? (
          <Alert color="yellow" title="Complete the workspace">
            {invalid}
          </Alert>
        ) : (
          <Text size="sm" role="status">
            Ready to generate {draft.collections.length} collections with session access, forms and
            bounded pages.
          </Text>
        )}
      </Stack>
    </ConfigurationDialog>
  );
}

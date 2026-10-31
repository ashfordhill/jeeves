import { type Architecture, architectureSchema } from "@jeeves/spec";
import { Alert, Button, Group, NativeSelect, Stack, Textarea, TextInput } from "@mantine/core";
import { useState } from "react";
import { useDraw } from "../draw/store.ts";
import { useEditorDraft } from "./editor-drafts.tsx";
import { TypeBadge } from "./type-style.tsx";

export function ContextInspector({
  selected,
  relationship,
  onContainers,
}: {
  selected: string;
  relationship?: string;
  onContainers: () => void;
}) {
  const loaded = useDraw((state) => state.loaded)!;
  const { draft, setDraft, baseRevision, setBaseRevision } = useEditorDraft<Architecture>(
    `context:${relationship ?? selected}`,
    loaded.design.architecture ?? {
      system: { name: loaded.project.name, description: "" },
      nodes: [],
      relationships: [],
    },
    loaded.design.revision,
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const id = selected.replace(/^context:/, "");
  const node = id === "system" ? draft.system : draft.nodes.find((item) => item.id === id);
  const edge = draft.relationships.find((item) => item.id === relationship);
  const editNode = (patch: { name?: string; description?: string }) =>
    setDraft(
      id === "system"
        ? { ...draft, system: { ...draft.system, ...patch } }
        : {
            ...draft,
            nodes: draft.nodes.map((item) => (item.id === id ? { ...item, ...patch } : item)),
          },
    );
  const editEdge = (patch: Partial<Architecture["relationships"][number]>) =>
    setDraft({
      ...draft,
      relationships: draft.relationships.map((item) =>
        item.id === relationship ? { ...item, ...patch } : item,
      ),
    });
  const save = async () => {
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError(
        "The design changed. Cancel and select this object again to review the latest version.",
      );
      return;
    }
    setSaving(true);
    const ok = await useDraw.getState().edit([{ op: "setArchitecture", architecture: draft }]);
    setSaving(false);
    if (ok) {
      setBaseRevision(useDraw.getState().loaded!.design.revision);
      setError(undefined);
    } else setError(useDraw.getState().notice?.message ?? "Could not save context.");
  };
  const endpoints = [
    { value: "system", label: draft.system.name },
    ...draft.nodes.map((item) => ({ value: item.id, label: item.name })),
  ];
  return (
    <section
      className="planned-inspector"
      aria-label={edge ? "Configure context relationship" : "Configure context object"}
    >
      {edge ? (
        <span className="inspector-kicker">Context relationship</span>
      ) : (
        <TypeBadge
          family={
            id === "system"
              ? "system"
              : node && "kind" in node && node.kind === "person"
                ? "person"
                : "external"
          }
        />
      )}
      <h2>{edge?.description ?? node?.name}</h2>
      <Stack gap="sm">
        {edge ? (
          <>
            <TextInput
              label="Relationship label"
              value={edge.description}
              onChange={(event) => editEdge({ description: event.currentTarget.value })}
            />
            <NativeSelect
              label="From"
              data={endpoints}
              value={edge.from}
              onChange={(event) =>
                editEdge({ from: event.currentTarget.value, container: undefined })
              }
            />
            <NativeSelect
              label="To"
              data={endpoints}
              value={edge.to}
              onChange={(event) =>
                editEdge({ to: event.currentTarget.value, container: undefined })
              }
            />
            {(edge.from === "system" || edge.to === "system") && (
              <NativeSelect
                label="Application at the system boundary"
                data={[
                  { value: "", label: "Not assigned" },
                  ...loaded.design.elements.map((element) => ({
                    value: element.id,
                    label: element.name,
                  })),
                ]}
                value={edge.container ?? ""}
                onChange={(event) =>
                  editEdge({ container: event.currentTarget.value || undefined })
                }
              />
            )}
          </>
        ) : node ? (
          <>
            <TextInput
              label="Name"
              maxLength={120}
              value={node.name}
              onChange={(event) => editNode({ name: event.currentTarget.value })}
            />
            <Textarea
              label="Responsibility"
              minRows={3}
              autosize
              maxRows={8}
              maxLength={1200}
              value={node.description}
              onChange={(event) => editNode({ description: event.currentTarget.value })}
            />
          </>
        ) : null}
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
        <Group className="inspector-draft-actions" gap="xs">
          <Button
            size="xs"
            color="cyan.9"
            disabled={!architectureSchema.safeParse(draft).success}
            loading={saving}
            onClick={() => void save()}
          >
            Save context
          </Button>
          <Button
            size="xs"
            variant="default"
            disabled={saving}
            onClick={() => {
              setDraft(
                structuredClone(
                  loaded.design.architecture ?? {
                    system: { name: loaded.project.name, description: "" },
                    nodes: [],
                    relationships: [],
                  },
                ),
              );
              setBaseRevision(loaded.design.revision);
              setError(undefined);
            }}
          >
            Cancel
          </Button>
        </Group>
        {id === "system" && !edge ? (
          <Button variant="default" fullWidth onClick={onContainers}>
            Open containers
          </Button>
        ) : null}
      </Stack>
    </section>
  );
}

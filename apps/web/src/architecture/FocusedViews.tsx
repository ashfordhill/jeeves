import type { ArchitectureLayoutView, ArchitectureProjection } from "@jeeves/spec";
import { Button, Checkbox, Group, NativeSelect, Stack, TextInput } from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useDraw } from "../draw/store.ts";

export function FocusedViews({
  source,
  active,
  onChange,
}: {
  source?: ArchitectureProjection;
  active: string;
  onChange: (key: string) => void;
}) {
  const saved = useDraw((state) => state.loaded?.layout.architecture);
  const views = Object.entries(saved ?? {}).filter(
    ([key, view]) => key.startsWith("focus-") && view.name,
  );
  const [editing, setEditing] = useState<{ key: string; view: ArchitectureLayoutView }>();
  const open = (key?: string) =>
    setEditing({
      key: key ?? `focus-${crypto.randomUUID()}`,
      view: (key && saved?.[key]) || {
        name: "",
        members: [],
        includeDependencies: true,
        positions: {},
      },
    });
  return (
    <section className="focused-view-toolbar" aria-label="C2 views">
      <NativeSelect
        aria-label="C2 view"
        value={active}
        data={[
          { value: "", label: "Whole system" },
          ...views.map(([value, view]) => ({ value, label: view.name! })),
        ]}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <Button size="compact-xs" variant="default" onClick={() => open()}>
        New focused view
      </Button>
      {active ? (
        <Button size="compact-xs" variant="default" onClick={() => open(active)}>
          Edit view
        </Button>
      ) : null}
      {editing ? (
        <ConfigurationDialog
          title="Focused C2 view"
          size="lg"
          onClose={() => setEditing(undefined)}
          footer={
            <Group justify="space-between">
              <Button variant="default" onClick={() => setEditing(undefined)}>
                Cancel
              </Button>
              {saved?.[editing.key] ? (
                <Button
                  color="red"
                  variant="subtle"
                  onClick={() => {
                    useDraw.getState().setArchitectureView(editing.key, undefined, true);
                    onChange("");
                    setEditing(undefined);
                  }}
                >
                  Delete view
                </Button>
              ) : null}
              <Button
                color="cyan.9"
                disabled={!editing.view.name?.trim() || !editing.view.members?.length}
                onClick={() => {
                  useDraw
                    .getState()
                    .setArchitectureView(
                      editing.key,
                      { ...editing.view, name: editing.view.name!.trim() },
                      true,
                    );
                  onChange(editing.key);
                  setEditing(undefined);
                }}
              >
                Save view
              </Button>
            </Group>
          }
        >
          <Stack>
            <TextInput
              label="View name"
              maxLength={120}
              value={editing.view.name ?? ""}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  view: { ...editing.view, name: event.currentTarget.value },
                })
              }
            />
            <p>
              Select the responsibilities in this flow. The system boundary and people/external
              systems retain their meaning. Relationships outside the view remain available from its
              hidden relationships link.
            </p>
            <Checkbox
              label="Include immediate dependencies"
              checked={editing.view.includeDependencies !== false}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  view: { ...editing.view, includeDependencies: event.currentTarget.checked },
                })
              }
            />
            <fieldset className="focused-view-members">
              <legend>Responsibilities and context</legend>
              {source?.nodes
                .filter((node) => node.kind !== "system")
                .map((node) => (
                  <Checkbox
                    key={node.id}
                    label={node.name}
                    checked={editing.view.members?.includes(node.id) ?? false}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        view: {
                          ...editing.view,
                          members: event.currentTarget.checked
                            ? [...(editing.view.members ?? []), node.id]
                            : editing.view.members?.filter((id) => id !== node.id),
                        },
                      })
                    }
                  />
                ))}
            </fieldset>
          </Stack>
        </ConfigurationDialog>
      ) : null}
    </section>
  );
}

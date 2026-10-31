import {
  type Architecture,
  architectureSchema,
  type DesignDocument,
  validateArchitecture,
} from "@jeeves/spec";
import {
  Alert,
  Button,
  Group,
  Modal,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { type ReactNode, useState } from "react";
import { useDraw } from "../draw/store.ts";

const errorText = () =>
  useDraw.getState().notice?.message ??
  "The design could not be saved. Close this dialog and reopen it to review the latest version.";

function ArchitectureDialog({
  title,
  size,
  onClose,
  children,
}: {
  title: string;
  size: "lg" | "xl";
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal.Root opened onClose={onClose} size={size}>
      <Modal.Overlay />
      <Modal.Content aria-label={title}>
        <Modal.Header role="presentation">
          <Modal.Title>{title}</Modal.Title>
          <Modal.CloseButton aria-label={`Close ${title.toLowerCase()}`} />
        </Modal.Header>
        <Modal.Body>{children}</Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}

export function ContextEditor({
  design,
  projectName,
  onClose,
}: {
  design: DesignDocument;
  projectName: string;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Architecture>(() =>
    structuredClone(
      design.architecture ?? {
        system: { name: projectName, description: "" },
        nodes: [],
        relationships: [],
      },
    ),
  );
  const [baseRevision] = useState(design.revision);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const parsed = architectureSchema.safeParse(draft);
  const problems = parsed.success
    ? validateArchitecture({ ...design, architecture: parsed.data }).filter(
        (finding) => finding.severity === "error",
      )
    : [];
  const changeNode = (id: string, patch: Partial<Architecture["nodes"][number]>) =>
    setDraft((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
    }));
  const endpoints = [
    { value: "system", label: draft.system.name || "This system" },
    ...draft.nodes.map((node) => ({
      value: node.id,
      label: node.name || "Unnamed context object",
    })),
  ];
  const save = async () => {
    if (!parsed.success || problems.length || saving) return;
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError(
        "The design changed while this draft was open. Close and reopen Edit context before saving.",
      );
      return;
    }
    setSaving(true);
    const ok = await useDraw
      .getState()
      .edit([{ op: "setArchitecture", architecture: parsed.data }]);
    setSaving(false);
    if (ok) onClose();
    else setError(errorText());
  };
  return (
    <ArchitectureDialog
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Edit system context"
      size="xl"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Stack gap="md">
          <Text size="sm">
            Describe the system's purpose and the people and systems around it. Context
            relationships document intent; existing container bindings connect that intent to the
            implementation.
          </Text>
          <TextInput
            label="System name"
            value={draft.system.name}
            required
            maxLength={120}
            onChange={(event) =>
              setDraft({ ...draft, system: { ...draft.system, name: event.currentTarget.value } })
            }
          />
          <Textarea
            label="System responsibility"
            value={draft.system.description}
            maxLength={1200}
            minRows={2}
            onChange={(event) =>
              setDraft({
                ...draft,
                system: { ...draft.system, description: event.currentTarget.value },
              })
            }
          />
          <section className="architecture-editor-section" aria-label="People and external systems">
            <Group justify="space-between">
              <h3>People and external systems</h3>
              <Button
                size="xs"
                variant="default"
                disabled={draft.nodes.length >= 50}
                onClick={() =>
                  setDraft({
                    ...draft,
                    nodes: [
                      ...draft.nodes,
                      {
                        id: `context-${crypto.randomUUID().slice(0, 8)}`,
                        kind: "person",
                        name: "New person",
                        description: "",
                      },
                    ],
                  })
                }
              >
                Add context object
              </Button>
            </Group>
            {draft.nodes.length === 0 ? (
              <Text size="sm" c="dimmed">
                Add a person or an external system. Neither needs an executable template.
              </Text>
            ) : null}
            {draft.nodes.map((node, index) => (
              <fieldset className="architecture-editor-row" key={node.id}>
                <legend>Context object {index + 1}</legend>
                <div className="architecture-form-pair">
                  <TextInput
                    label={`Object ${index + 1} name`}
                    value={node.name}
                    maxLength={120}
                    required
                    onChange={(event) => changeNode(node.id, { name: event.currentTarget.value })}
                  />
                  <NativeSelect
                    label={`Object ${index + 1} kind`}
                    value={node.kind}
                    data={[
                      { value: "person", label: "Person / role" },
                      { value: "external-system", label: "External software system" },
                    ]}
                    onChange={(event) =>
                      changeNode(node.id, {
                        kind: event.currentTarget.value as "person" | "external-system",
                      })
                    }
                  />
                </div>
                <TextInput
                  label={`Object ${index + 1} responsibility`}
                  value={node.description}
                  maxLength={1200}
                  onChange={(event) =>
                    changeNode(node.id, { description: event.currentTarget.value })
                  }
                />
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="red"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      nodes: draft.nodes.filter((item) => item.id !== node.id),
                      relationships: draft.relationships.filter(
                        (relation) => relation.from !== node.id && relation.to !== node.id,
                      ),
                    })
                  }
                >
                  Remove object {index + 1} and its interactions
                </Button>
              </fieldset>
            ))}
          </section>
          <section className="architecture-editor-section" aria-label="Context interactions">
            <Group justify="space-between">
              <h3>Interactions</h3>
              <Button
                size="xs"
                variant="default"
                disabled={!draft.nodes.length || draft.relationships.length >= 100}
                onClick={() =>
                  setDraft({
                    ...draft,
                    relationships: [
                      ...draft.relationships,
                      {
                        id: `interaction-${crypto.randomUUID().slice(0, 8)}`,
                        from: draft.nodes[0]?.id ?? "system",
                        to: "system",
                        description: "Uses the system",
                      },
                    ],
                  })
                }
              >
                Add interaction
              </Button>
            </Group>
            {draft.relationships.map((relation, index) => {
              const change = (patch: Partial<typeof relation>) =>
                setDraft({
                  ...draft,
                  relationships: draft.relationships.map((item) =>
                    item.id === relation.id ? { ...item, ...patch } : item,
                  ),
                });
              return (
                <fieldset className="architecture-editor-row" key={relation.id}>
                  <legend>Interaction {index + 1}</legend>
                  <div className="architecture-form-pair">
                    <NativeSelect
                      label={`Interaction ${index + 1} from`}
                      value={relation.from}
                      data={endpoints}
                      onChange={(event) =>
                        change({ from: event.currentTarget.value, container: undefined })
                      }
                    />
                    <NativeSelect
                      label={`Interaction ${index + 1} to`}
                      value={relation.to}
                      data={endpoints}
                      onChange={(event) =>
                        change({ to: event.currentTarget.value, container: undefined })
                      }
                    />
                  </div>
                  <TextInput
                    label={`Interaction ${index + 1} purpose`}
                    value={relation.description}
                    required
                    maxLength={240}
                    onChange={(event) => change({ description: event.currentTarget.value })}
                  />
                  {relation.from === "system" || relation.to === "system" ? (
                    <NativeSelect
                      label={`Interaction ${index + 1} container`}
                      value={relation.container ?? ""}
                      data={[
                        { value: "", label: "Unbound intent" },
                        ...design.elements.map((element) => ({
                          value: element.id,
                          label: element.name,
                        })),
                      ]}
                      onChange={(event) =>
                        change({ container: event.currentTarget.value || undefined })
                      }
                    />
                  ) : null}
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color="red"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        relationships: draft.relationships.filter(
                          (item) => item.id !== relation.id,
                        ),
                      })
                    }
                  >
                    Remove interaction {index + 1}
                  </Button>
                </fieldset>
              );
            })}
          </section>
          {problems.length ? (
            <Alert color="red">{problems.map((problem) => problem.message).join(" ")}</Alert>
          ) : null}
          {error ? (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              color="cyan.9"
              loading={saving}
              disabled={!parsed.success || problems.length > 0}
            >
              Save context
            </Button>
          </Group>
        </Stack>
      </form>
    </ArchitectureDialog>
  );
}

export function ProductConfiguration({
  design,
  onClose,
}: {
  design: DesignDocument;
  onClose: () => void;
}) {
  const web = design.elements.find((element) => element.id === "qrwty-web");
  const recipe = design.recipe;
  const [name, setName] = useState(String(web?.config.title ?? ""));
  const [tagline, setTagline] = useState(
    String(recipe?.config.tagline ?? "One link. Room to change."),
  );
  const [days, setDays] = useState(String(recipe?.config.analyticsDays ?? 30));
  const [baseRevision] = useState(design.revision);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const changed =
    name !== web?.config.title ||
    tagline !== recipe?.config.tagline ||
    Number(days) !== recipe?.config.analyticsDays;
  const save = async () => {
    if (!recipe || !web || saving) return;
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError("The design changed. Close and reopen configuration to review the latest version.");
      return;
    }
    setSaving(true);
    const ok = await useDraw.getState().edit([
      {
        op: "setRecipe",
        recipe: {
          ...recipe,
          config: { ...recipe.config, tagline: tagline.trim(), analyticsDays: Number(days) },
        },
      },
      { op: "updateElement", id: web.id, config: { ...web.config, title: name.trim() } },
    ]);
    setSaving(false);
    if (ok) onClose();
    else setError(errorText());
  };
  return (
    <ArchitectureDialog
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Product configuration"
      size="lg"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Stack gap="md">
          <Text size="sm">
            Save changes to the design, then Generate to apply them to the app. This form does not
            restart or change a running product.
          </Text>
          <TextInput
            label="Product name"
            value={name}
            maxLength={80}
            required
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <TextInput
            label="Product tagline"
            value={tagline}
            maxLength={120}
            required
            onChange={(event) => setTagline(event.currentTarget.value)}
          />
          <NativeSelect
            label="Default analytics range"
            value={days}
            data={[
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
              { value: "90", label: "Last 90 days" },
            ]}
            onChange={(event) => setDays(event.currentTarget.value)}
          />
          <Text size="sm">
            Stable local public origin:{" "}
            <strong>http://127.0.0.1:{String(web?.config.hostPort)}</strong>. Changing printed-link
            origins requires a reviewed migration.
          </Text>
          {error ? (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              color="cyan.9"
              disabled={!changed || !name.trim() || !tagline.trim()}
              loading={saving}
            >
              Save configuration
            </Button>
          </Group>
        </Stack>
      </form>
    </ArchitectureDialog>
  );
}

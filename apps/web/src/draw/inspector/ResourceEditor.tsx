import {
  type Attachment,
  type DesignDocument,
  type Element,
  type Resource,
  type ResourceField,
  resourceConfigSchema,
} from "@jeeves/spec";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  NativeSelect,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { ConfigurationDialog } from "../../components/ConfigurationDialog.tsx";
import { api, type ProductRecipe } from "../api.ts";
import { useDraw } from "../store.ts";
import {
  addField,
  addResource,
  draftId,
  fieldKind,
  resourceDraft,
  resourceEndpoints,
} from "./resourceDraft.ts";
import "./resource-editor.css";

type RecipeBinding = ProductRecipe["resourceBindings"][number];
export function ResourceConfiguration({
  element,
  attachment,
  initialResource,
}: {
  element: Element;
  attachment: Attachment;
  initialResource?: string;
}) {
  const design = useDraw((s) => s.loaded?.design);
  const [opened, setOpened] = useState(false);
  const parsed = resourceConfigSchema.safeParse(attachment.config.model);
  return (
    <Stack gap="xs">
      <Text size="xs">
        {parsed.success
          ? `${parsed.data.resources.length} resources · ${parsed.data.extensions.length} domain operations`
          : "Configure data and standard API behavior."}
      </Text>
      <Button variant="default" size="xs" onClick={() => setOpened(true)}>
        Configure resources
      </Button>
      {opened && design ? (
        <ResourceEditor
          element={element}
          attachment={attachment}
          design={design}
          onClose={() => setOpened(false)}
          initialResource={initialResource}
        />
      ) : null}
    </Stack>
  );
}
function ResourceEditor({
  element,
  attachment,
  design,
  onClose,
  initialResource,
}: {
  element: Element;
  attachment: Attachment;
  design: DesignDocument;
  onClose: () => void;
  initialResource?: string;
}) {
  const [draft, setDraft] = useState(() => resourceDraft(attachment.config.model));
  const reservedResources = useRef(draft?.resources.map((item) => item.id) ?? []);
  const reservedFields = useRef(
    new Map(
      draft?.resources.map((item) => [
        item.id,
        [...item.fields, ...item.belongsTo].map((part) => part.id),
      ]),
    ),
  );
  const reservePart = (resource: Resource, id: string) =>
    reservedFields.current.set(resource.id, [
      ...(reservedFields.current.get(resource.id) ?? []),
      id,
    ]);
  const [selected, setSelected] = useState(initialResource ?? draft?.resources[0]?.id);
  const [baseRevision] = useState(design.revision);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [recipe, setRecipe] = useState<{
    loading: boolean;
    binding?: RecipeBinding;
    error?: string;
  }>({ loading: !!design.recipe });
  const recipeId = design.recipe?.id,
    recipeVersion = design.recipe?.version;
  useEffect(() => {
    if (!recipeId) return;
    let active = true;
    api
      .recipes()
      .then((catalog) => {
        const metadata = catalog.find(
          (item) => item.id === recipeId && item.version === recipeVersion,
        );
        if (!metadata || !Array.isArray(metadata.resourceBindings))
          throw new Error(
            "The recipe's resource metadata is unavailable. Close and retry before editing.",
          );
        if (active)
          setRecipe({
            loading: false,
            binding: metadata.resourceBindings.find(
              (binding) => binding.element === element.id && binding.attachment === attachment.id,
            ),
          });
      })
      .catch((failure: unknown) => {
        if (active)
          setRecipe({
            loading: false,
            error:
              failure instanceof Error ? failure.message : "Recipe metadata could not be loaded.",
          });
      });
    return () => {
      active = false;
    };
  }, [recipeId, recipeVersion, element.id, attachment.id]);
  const stores = design.connections.filter(
    (connection) =>
      connection.kind === "uses-database" &&
      connection.from.element === element.id &&
      design.elements.find((item) => item.id === connection.to.element)?.template?.id ===
        "postgres",
  );
  const resource = draft?.resources.find((item) => item.id === selected) ?? draft?.resources[0];
  const protectedResource = !!resource && !!recipe.binding?.resourceIds.includes(resource.id);
  const parsed = resourceConfigSchema.safeParse(draft);
  const blocked = recipe.loading || !!recipe.error || !parsed.success;
  const change = (patch: Partial<Resource>) => {
    if (!draft || !resource || protectedResource) return;
    setDraft({
      ...draft,
      resources: draft.resources.map((item) =>
        item.id === resource.id ? { ...item, ...patch } : item,
      ),
    });
  };
  const save = async () => {
    if (blocked || !draft || saving) return;
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError("The design changed while this draft was open. Close and reopen before saving.");
      return;
    }
    setSaving(true);
    const ok = await useDraw.getState().edit([
      {
        op: "updateAttachment",
        id: attachment.id,
        config: { ...attachment.config, auth: "session", basePath: "/api", model: draft },
      },
    ]);
    if (ok) onClose();
    else {
      setSaving(false);
      setError(useDraw.getState().notice?.message ?? "The resource model could not be saved.");
    }
  };
  return (
    <ConfigurationDialog
      title="Configure resources"
      size="xl"
      onClose={onClose}
      footer={
        <Group justify="space-between" gap="sm">
          <Text size="xs">Draft changes apply to this design only.</Text>
          <Group gap="xs">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              color="cyan.9"
              onClick={() => void save()}
              disabled={blocked || !draft}
              loading={saving}
            >
              Save resources
            </Button>
          </Group>
        </Group>
      }
    >
      {!draft ? (
        <Alert color="red">
          The existing model is invalid. Use Advanced API configuration to repair it; this editor
          will not reset it.
        </Alert>
      ) : (
        <Stack gap="md">
          <Group gap="xs">
            <Badge variant="light">Session authentication</Badge>
            <Badge variant="light">/api resource routes</Badge>
            <Text size="xs">Owner resources are private to the authenticated account.</Text>
          </Group>
          <NativeSelect
            className="resource-editor-store"
            label="Resource database"
            value={draft.storeConnection ?? ""}
            disabled={recipe.loading || !!recipe.binding || !!recipe.error}
            data={[
              { value: "", label: "Choose a Postgres connection" },
              ...stores.map((connection) => ({
                value: connection.id,
                label:
                  design.elements.find((item) => item.id === connection.to.element)?.name ??
                  connection.to.element,
              })),
              ...(!stores.some((s) => s.id === draft.storeConnection) && draft.storeConnection
                ? [
                    {
                      value: draft.storeConnection,
                      label: `Missing connection: ${draft.storeConnection}`,
                    },
                  ]
                : []),
            ]}
            onChange={(event) =>
              setDraft({ ...draft, storeConnection: event.currentTarget.value || undefined })
            }
          />
          {!stores.some((store) => store.id === draft.storeConnection) ? (
            <Alert color="yellow">
              Select an existing Postgres connection, or connect this service on the board before
              Generate. Saving the draft does not create wiring.
            </Alert>
          ) : null}
          {recipe.loading ? <Text role="status">Loading versioned recipe boundaries…</Text> : null}
          {recipe.error ? (
            <Alert color="red" role="alert">
              {recipe.error}
            </Alert>
          ) : null}
          {recipe.binding ? (
            <Alert color="blue" title={`${recipeId}@${recipeVersion}`}>
              Provided resource definitions and their store are fixed by this recipe. Add separate
              resources for custom data; the protected definitions stay unchanged.
            </Alert>
          ) : null}
          <div className="resource-editor-layout">
            <nav aria-label="Resource definitions" className="resource-editor-list">
              {draft.resources.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="resource-editor-item"
                  aria-current={resource?.id === item.id ? "true" : undefined}
                  onClick={() => setSelected(item.id)}
                >
                  <span>{item.name || "Unnamed resource"}</span>
                  <small>
                    {recipe.binding?.resourceIds.includes(item.id)
                      ? "Recipe provided"
                      : item.access === "owner"
                        ? "Owner resource"
                        : "Internal record"}{" "}
                    · {item.fields.length} fields
                  </small>
                </button>
              ))}
              <Button
                size="xs"
                variant="default"
                disabled={draft.resources.length >= 50 || recipe.loading || !!recipe.error}
                onClick={() => {
                  const added = addResource(draft, reservedResources.current);
                  reservedResources.current.push(added.id);
                  setDraft({ ...draft, resources: [...draft.resources, added] });
                  setSelected(added.id);
                }}
              >
                Add resource
              </Button>
            </nav>
            <section className="resource-editor-detail" aria-label="Selected resource">
              {!resource ? (
                <Text size="sm">
                  Add a resource to define its fields, ownership and generated API.
                </Text>
              ) : (
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Text fw={700}>{resource.name || "Unnamed resource"}</Text>
                      <Text size="xs" c="dimmed">
                        Stable resource ID: {resource.id}
                      </Text>
                    </div>
                    {protectedResource ? (
                      <Badge variant="light">Recipe provided</Badge>
                    ) : (
                      <Button
                        variant="subtle"
                        color="red"
                        size="compact-xs"
                        onClick={() => {
                          const at = draft.resources.findIndex((item) => item.id === resource.id);
                          const remaining = draft.resources.filter(
                            (item) => item.id !== resource.id,
                          );
                          setDraft({ ...draft, resources: remaining });
                          setSelected((remaining[at] ?? remaining[at - 1])?.id);
                        }}
                      >
                        Remove selected resource
                      </Button>
                    )}
                  </Group>
                  <fieldset
                    className="resource-editor-controls"
                    disabled={protectedResource || recipe.loading || !!recipe.error}
                  >
                    <Group grow>
                      <TextInput
                        label="Resource name"
                        value={resource.name}
                        onChange={(event) => change({ name: event.currentTarget.value })}
                      />
                      <NativeSelect
                        label="Access scope"
                        value={resource.access}
                        data={[
                          { value: "owner", label: "Owner — private API" },
                          { value: "internal", label: "Internal — no public CRUD" },
                        ]}
                        onChange={(event) => {
                          const access = event.currentTarget.value as Resource["access"];
                          change({ access, ...(access === "internal" && { operations: [] }) });
                        }}
                      />
                    </Group>
                    <Text size="xs" c="dimmed">
                      UUID identity is generated. Owner resources also receive a server-assigned
                      owner and creation time. Renaming keeps storage IDs; published schema changes
                      are reviewed by Generate.
                    </Text>
                    <div>
                      <Text size="sm" fw={600} mb="xs">
                        Standard operations
                      </Text>
                      <Group gap="md">
                        {(["create", "read", "list", "update"] as const).map((operation) => (
                          <Checkbox
                            key={operation}
                            label={operation.charAt(0).toUpperCase() + operation.slice(1)}
                            aria-label={`Enable ${operation}`}
                            disabled={resource.access === "internal"}
                            checked={resource.operations.includes(operation)}
                            onChange={(event) =>
                              change({
                                operations: event.currentTarget.checked
                                  ? [...resource.operations, operation]
                                  : resource.operations.filter((op) => op !== operation),
                              })
                            }
                          />
                        ))}
                      </Group>
                    </div>
                    <section aria-label="Payload fields" className="resource-editor-section">
                      <Group justify="space-between">
                        <Text fw={600} size="sm">
                          Fields
                        </Text>
                        <Button
                          size="compact-xs"
                          variant="default"
                          disabled={resource.fields.length >= 100}
                          onClick={() => {
                            const added = addField(
                              resource,
                              reservedFields.current.get(resource.id),
                            );
                            reservePart(resource, added.id);
                            change({ fields: [...resource.fields, added] });
                          }}
                        >
                          Add field
                        </Button>
                      </Group>
                      {!resource.fields.length ? (
                        <Text size="xs" c="dimmed">
                          Start with the data this resource needs. Identity is already supplied.
                        </Text>
                      ) : null}
                      {resource.fields.map((field, index) => (
                        <FieldEditor
                          key={field.id}
                          field={field}
                          index={index}
                          onChange={(updated) =>
                            change({
                              fields: resource.fields.map((item) =>
                                item.id === field.id ? updated : item,
                              ),
                            })
                          }
                          onRemove={() =>
                            change({
                              fields: resource.fields.filter((item) => item.id !== field.id),
                            })
                          }
                        />
                      ))}
                    </section>
                    <section
                      aria-label="Required relationships"
                      className="resource-editor-section"
                    >
                      <Group justify="space-between">
                        <Text fw={600} size="sm">
                          Belongs to
                        </Text>
                        <Button
                          size="compact-xs"
                          variant="default"
                          disabled={
                            resource.belongsTo.length >= 20 ||
                            !draft.resources.some(
                              (other) =>
                                other.id !== resource.id &&
                                !resource.belongsTo.some(
                                  (relation) => relation.resource === other.id,
                                ),
                            )
                          }
                          onClick={() => {
                            const target = draft.resources.find(
                              (other) =>
                                other.id !== resource.id &&
                                !resource.belongsTo.some(
                                  (relation) => relation.resource === other.id,
                                ),
                            );
                            if (target) {
                              const id = draftId("relation", [
                                ...(reservedFields.current.get(resource.id) ?? []),
                                ...[...resource.fields, ...resource.belongsTo].map(
                                  (item) => item.id,
                                ),
                              ]);
                              reservePart(resource, id);
                              change({
                                belongsTo: [
                                  ...resource.belongsTo,
                                  { id, resource: target.id, required: true },
                                ],
                              });
                            }
                          }}
                        >
                          Add relationship
                        </Button>
                      </Group>
                      <Text size="xs" c="dimmed">
                        Required references stay within this service. Parent ownership is enforced
                        by generated CRUD; internal records are used by domain code.
                      </Text>
                      {resource.belongsTo.map((relation, index) => (
                        <div className="resource-editor-relation" key={relation.id}>
                          <NativeSelect
                            label={`Parent resource ${index + 1}`}
                            value={relation.resource}
                            data={draft.resources
                              .filter((other) => other.id !== resource.id)
                              .map((other) => ({ value: other.id, label: other.name || other.id }))}
                            onChange={(event) =>
                              change({
                                belongsTo: resource.belongsTo.map((item) =>
                                  item.id === relation.id
                                    ? { ...item, resource: event.currentTarget.value }
                                    : item,
                                ),
                              })
                            }
                          />
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="red"
                            onClick={() =>
                              change({
                                belongsTo: resource.belongsTo.filter(
                                  (item) => item.id !== relation.id,
                                ),
                              })
                            }
                          >
                            Remove relationship {index + 1}
                          </Button>
                        </div>
                      ))}
                    </section>
                  </fieldset>
                  <section
                    aria-label="Generated endpoint preview"
                    className="resource-editor-preview"
                  >
                    <Text size="sm" fw={600}>
                      Generated endpoints
                    </Text>
                    {resourceEndpoints(resource).map((endpoint) => (
                      <code key={endpoint}>{endpoint}</code>
                    ))}
                    {!resource.operations.length ? (
                      <Text size="sm">No CRUD routes are exposed for this resource.</Text>
                    ) : null}
                  </section>
                </Stack>
              )}
            </section>
          </div>
          {draft.extensions.length ? (
            <details className="resource-editor-extensions">
              <summary>{draft.extensions.length} domain operations · contracts preserved</summary>
              <Stack gap="xs" mt="sm">
                {draft.extensions.map((extension) => (
                  <div key={extension.id}>
                    <Text size="sm" fw={600}>
                      {extension.method} {extension.path}
                    </Text>
                    <Text size="xs">
                      {extension.access === "owner" ? "Signed-in owner" : "Public access"}
                    </Text>
                  </div>
                ))}
                <Text size="xs">
                  This editor preserves existing domain contracts, dependencies and acceptance
                  references. Use Advanced API configuration for deliberate extension changes.
                </Text>
              </Stack>
            </details>
          ) : null}
          {!parsed.success ? (
            <Alert color="red" role="alert">
              {parsed.error.issues
                .map(
                  (issue) =>
                    `${issue.path.length ? `${issue.path.join(".")}: ` : ""}${issue.message}`,
                )
                .join("; ")}
            </Alert>
          ) : null}
          {error ? (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          ) : null}
        </Stack>
      )}
    </ConfigurationDialog>
  );
}

function FieldEditor({
  field,
  index,
  onChange,
  onRemove,
}: {
  field: ResourceField;
  index: number;
  onChange: (field: ResourceField) => void;
  onRemove: () => void;
}) {
  const prefix = `Field ${index + 1}`;
  return (
    <div className="resource-editor-field">
      <Group grow align="start">
        <TextInput
          label="Name"
          aria-label={`${prefix} name`}
          value={field.name}
          onChange={(event) => onChange({ ...field, name: event.currentTarget.value })}
        />
        <NativeSelect
          label="Type"
          aria-label={`${prefix} type`}
          value={field.type}
          data={[
            { value: "text", label: "Text" },
            { value: "http-url", label: "HTTP / HTTPS URL" },
            { value: "integer", label: "Whole number" },
            { value: "enum", label: "Choice" },
            { value: "timestamp", label: "Created timestamp" },
          ]}
          onChange={(event) =>
            onChange(fieldKind(field, event.currentTarget.value as ResourceField["type"]))
          }
        />
      </Group>
      {field.type === "text" ? (
        <NumberInput
          label="Maximum length"
          aria-label={`${prefix} maximum length`}
          value={field.maxLength}
          min={1}
          max={10000}
          allowDecimal={false}
          onChange={(value) => onChange({ ...field, maxLength: Number(value) })}
        />
      ) : null}
      {field.type === "integer" ? (
        <Group grow>
          <NumberInput
            label="Minimum"
            aria-label={`${prefix} minimum`}
            value={field.minimum}
            allowDecimal={false}
            onChange={(value) => onChange({ ...field, minimum: Number(value) })}
          />
          <NumberInput
            label="Maximum"
            aria-label={`${prefix} maximum`}
            value={field.maximum}
            allowDecimal={false}
            onChange={(value) => onChange({ ...field, maximum: Number(value) })}
          />
        </Group>
      ) : null}
      {field.type === "enum" ? (
        <Textarea
          label="Choices"
          aria-label={`${prefix} choices`}
          description="One value per line; letters, numbers, hyphens and underscores."
          value={field.values.join("\n")}
          onChange={(event) =>
            onChange({ ...field, values: event.currentTarget.value.split("\n") })
          }
        />
      ) : null}
      <Group justify="space-between" gap="xs">
        {field.type === "timestamp" ? (
          <Text size="xs">Set once by the server at creation.</Text>
        ) : (
          <Checkbox
            label="Required"
            aria-label={`${prefix} required`}
            checked={field.required}
            onChange={(event) => onChange({ ...field, required: event.currentTarget.checked })}
          />
        )}
        <Button size="compact-xs" variant="subtle" color="red" onClick={onRemove}>
          Remove field {index + 1}
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        Stable field ID: {field.id}
      </Text>
    </div>
  );
}

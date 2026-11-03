import { builtinRegistry } from "@jeeves/registry";
import {
  type ArchitectureComponent,
  type ArchitectureMember,
  applyOperations,
  architectureSchema,
  componentCompatible,
  componentHostRole,
  connectionPresentation,
  type DesignDocument,
  plannedCapabilities,
  resourceConfigSchema,
} from "@jeeves/spec";
import {
  Alert,
  Button,
  Group,
  MultiSelect,
  NativeSelect,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useDraw } from "../draw/store.ts";
import { CapabilityFields } from "./CapabilityFields.tsx";
import { ComponentDataEditor } from "./ComponentDataEditor.tsx";

export const memberKey = (member: ArchitectureMember) =>
  `${member.attachment}|${member.kind}|${member.ref ?? ""}`;
export function memberOptions(design: DesignDocument, element: string) {
  const result: { value: string; label: string; member: ArchitectureMember }[] = [];
  for (const attachment of design.elements.find((item) => item.id === element)?.attachments ?? []) {
    if (attachment.template.id !== "rest-api-server") continue;
    const parsed = resourceConfigSchema.safeParse(attachment.config.model);
    if (!parsed.success) continue;
    const add = (member: ArchitectureMember, label: string) =>
      result.push({ member, value: memberKey(member), label });
    if (attachment.config.auth === "session")
      add({ attachment: attachment.id, kind: "accounts" }, "Accounts & sessions");
    for (const resource of parsed.data.resources)
      add(
        { attachment: attachment.id, kind: "resource", ref: resource.id },
        `${resource.name} · resource`,
      );
    for (const extension of parsed.data.extensions)
      add(
        { attachment: attachment.id, kind: "extension", ref: extension.id },
        `${extension.method} ${extension.path} · ${extension.id}`,
      );
  }
  return result;
}

export function ComponentEditor({
  design: incomingDesign,
  element,
  initial,
  capability,
  members,
  onClose,
  onSaved,
}: {
  design: DesignDocument;
  element: string;
  initial?: ArchitectureComponent;
  capability?: string;
  members?: ArchitectureMember[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [design] = useState(() => structuredClone(incomingDesign));
  const [architectureDraft, setArchitectureDraft] = useState(() =>
    structuredClone(
      design.architecture ?? {
        system: { name: useDraw.getState().loaded?.project.name ?? "System", description: "" },
        nodes: [],
        relationships: [],
      },
    ),
  );
  const owner = design.elements.find((item) => item.id === element)!;
  const compatible = plannedCapabilities.filter((item) =>
    componentCompatible(item, componentHostRole(owner, builtinRegistry())),
  );
  const [draft, setDraft] = useState<ArchitectureComponent>(() =>
    initial
      ? structuredClone(initial)
      : {
          id: `component-${crypto.randomUUID().slice(0, 8)}`,
          element,
          name:
            plannedCapabilities.find((item) => item.id === capability)?.name ??
            "New responsibility",
          responsibility: "",
          capability: members?.length ? undefined : (capability ?? "domain-module"),
          config: {},
          members: members ?? [],
          usesResources: [],
          usesConnections: [],
        },
  );
  const [tab, setTab] = useState("general");
  const [baseRevision] = useState(design.revision);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const options = memberOptions(design, element);
  const used = new Set(
    design.architecture?.components
      ?.filter((item) => item.id !== draft.id && item.element === element)
      .flatMap((item) => item.members.map(memberKey)),
  );
  const hasInterfaces = design.architecture?.interfaces?.some(
    (item) => item.owner.kind === "component" && item.owner.id === initial?.id,
  );

  const architecture = {
    ...architectureDraft,
    components: [
      ...(architectureDraft.components ?? []).filter((item) => item.id !== draft.id),
      draft,
    ],
  };
  const parsed = architectureSchema.safeParse(architecture);
  const checked = parsed.success
    ? applyOperations(
        design,
        [{ op: "setArchitecture", architecture: parsed.data }],
        builtinRegistry(),
      )
    : undefined;
  const problems = checked && !checked.ok ? checked.errors.map((f) => f.message) : [];
  const schemaProblems = !parsed.success
    ? parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
    : [];
  const save = async () => {
    if (!parsed.success || problems.length || saving) return;
    if (useDraw.getState().loaded?.design.revision !== baseRevision) {
      setError(
        "The design changed while this draft was open. Cancel and reopen to review the latest version. Your draft has been retained.",
      );
      return;
    }
    setSaving(true);
    const ok = await useDraw
      .getState()
      .edit([{ op: "setArchitecture", architecture: parsed.data }]);
    setSaving(false);
    if (ok) {
      onSaved(draft.id);
      onClose();
    } else setError(useDraw.getState().notice?.message ?? "Could not save component.");
  };
  return (
    <ConfigurationDialog
      title={initial ? "Configure component" : "Add component"}
      size="lg"
      onClose={onClose}
      footer={
        <Group justify="flex-end">
          <Button variant="default" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="cyan.9"
            disabled={!parsed.success || problems.length > 0}
            loading={saving}
            onClick={() => void save()}
          >
            Save component
          </Button>
        </Group>
      }
    >
      <Stack gap="md">
        <p className="catalog-intro">
          Inside <strong>{owner.name}</strong>
        </p>
        {draft.annotationOrigin ? (
          <Text size="sm">
            Suggested from explicit bindings at revision {draft.annotationOrigin.revision}:{" "}
            {draft.annotationOrigin.bindings
              .map((b) => `${b.element}/${b.attachment}/${b.kind}/${b.ref ?? ""}`)
              .join(", ")}
            . {draft.annotationOrigin.basis}
          </Text>
        ) : null}
        <Tabs value={tab} onChange={(value) => setTab(value ?? "general")} keepMounted>
          <Tabs.List aria-label="Component configuration sections">
            <Tabs.Tab value="general">General</Tabs.Tab>
            <Tabs.Tab value="data">Data</Tabs.Tab>
            <Tabs.Tab value="access">Access</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="general" pt="md">
            <Stack gap="md">
              <TextInput
                label="Component name"
                value={draft.name}
                maxLength={120}
                onChange={(event) => setDraft({ ...draft, name: event.currentTarget.value })}
              />
              <Textarea
                label="Responsibility"
                maxLength={240}
                value={draft.responsibility}
                onChange={(event) =>
                  setDraft({ ...draft, responsibility: event.currentTarget.value })
                }
              />
              <TextInput
                label="Technology"
                placeholder="Framework, library or source module"
                maxLength={120}
                value={draft.technology ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, technology: event.currentTarget.value || undefined })
                }
              />
              <NativeSelect
                label="Component type"
                data={[
                  { value: "", label: "Group existing capabilities" },
                  ...compatible.map((item) => ({ value: item.id, label: item.name })),
                ]}
                value={draft.capability ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    capability: event.currentTarget.value || undefined,
                    config: {},
                  })
                }
              />
              {draft.capability ? (
                <CapabilityFields
                  capability={draft.capability}
                  config={draft.config}
                  onChange={(config) => setDraft({ ...draft, config })}
                />
              ) : null}
              {options.length ? (
                <MultiSelect
                  label="Existing capabilities"
                  description="Group actual operations without duplicating their implementation."
                  searchable
                  data={options.map((item) => ({
                    value: item.value,
                    label: item.label,
                    disabled: used.has(item.value),
                  }))}
                  value={draft.members.map(memberKey)}
                  onChange={(values) =>
                    setDraft({
                      ...draft,
                      members: values.flatMap(
                        (value) => options.find((item) => item.value === value)?.member ?? [],
                      ),
                    })
                  }
                />
              ) : null}
              <MultiSelect
                label="Uses connected applications / stores"
                description="Explicit design intent; it does not create runtime dependencies."
                searchable
                data={design.connections
                  .filter(
                    (connection) =>
                      connection.from.element === element || connection.to.element === element,
                  )
                  .map((connection) => ({
                    value: connection.id,
                    label: `${connectionPresentation(connection, design).description} · ${design.elements.find((item) => item.id === (connection.from.element === element ? connection.to.element : connection.from.element))?.name}`,
                  }))}
                value={draft.usesConnections}
                onChange={(usesConnections) => setDraft({ ...draft, usesConnections })}
              />
              {options.some((item) => item.member.kind === "resource") ? (
                <MultiSelect
                  label="Uses resources"
                  data={options
                    .filter((item) => item.member.kind === "resource")
                    .map((item) => ({ value: item.value, label: item.label }))}
                  value={draft.usesResources.map((item) =>
                    memberKey({
                      attachment: item.attachment,
                      kind: "resource",
                      ref: item.resource,
                    }),
                  )}
                  onChange={(values) =>
                    setDraft({
                      ...draft,
                      usesResources: values.flatMap((value) => {
                        const member = options.find((item) => item.value === value)?.member;
                        return member?.ref
                          ? [{ attachment: member.attachment, resource: member.ref }]
                          : [];
                      }),
                    })
                  }
                />
              ) : null}
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value={tab === "access" ? "access" : "data"} pt="md">
            <ComponentDataEditor
              mode={tab === "access" ? "access" : "data"}
              onArea={setTab}
              design={design}
              draft={architecture}
              component={draft}
              onChange={setArchitectureDraft}
            />
          </Tabs.Panel>
        </Tabs>
        {schemaProblems.length ? (
          <Alert color="red" role="alert">
            {schemaProblems[0]}
          </Alert>
        ) : null}
        {error || problems[0] ? (
          <Alert color="red" role="alert">
            {error ?? problems[0]}
          </Alert>
        ) : null}
        {hasInterfaces ? (
          <Alert>Remove this component’s interfaces before removing the component.</Alert>
        ) : null}
        {initial ? (
          <Button
            variant="subtle"
            color="red"
            size="xs"
            disabled={saving || hasInterfaces}
            onClick={async () => {
              if (useDraw.getState().loaded?.design.revision !== baseRevision) {
                setError("The design changed. Cancel and reopen before removing this component.");
                return;
              }
              const next = {
                ...architecture,
                components: architecture.components.filter((item) => item.id !== initial.id),
                ...(architecture.componentRelationships && {
                  componentRelationships: architecture.componentRelationships.filter(
                    (item) => item.from !== initial.id && item.to !== initial.id,
                  ),
                }),
              };
              if (await useDraw.getState().edit([{ op: "setArchitecture", architecture: next }]))
                onClose();
              else setError(useDraw.getState().notice?.message ?? "Could not remove component.");
            }}
          >
            Remove component
          </Button>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}

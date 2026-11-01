import { builtinRegistry } from "@jeeves/registry";
import {
  architectureExample,
  architectureExamples,
  architecturePatterns,
  componentCompatible,
  componentHostRole,
  type PlannedCapability,
  plannedCapabilities,
} from "@jeeves/spec";
import { Alert, Badge, Button, Group, Tabs, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { api } from "../draw/api.ts";
import { type Tool, useDraw } from "../draw/store.ts";
import { TemplateIcon } from "../draw/TemplateIcon.tsx";
import { ExampleMiniature } from "./ExampleMiniature.tsx";
import { PatternComposer } from "./PatternComposer.tsx";
import { capabilityFamily, templateFamily, typeStyles } from "./type-style.tsx";

export function CapabilityCatalog({
  onClose,
  onPlace,
  onTemplate,
  onStarter,
  onComponent,
  componentContainer,
  initialTab = "blocks",
}: {
  onClose: () => void;
  onPlace: (id: string) => void;
  onTemplate: (tool: Tool) => void;
  onStarter: () => void;
  onComponent?: (id: string) => void;
  componentContainer?: string;
  initialTab?: "blocks" | "examples";
}) {
  const loaded = useDraw((state) => state.loaded)!;
  const owner = loaded.design.elements.find((item) => item.id === componentContainer);
  const capabilities = plannedCapabilities.filter(
    (item) =>
      item.scope === "container" ||
      Boolean(owner && componentCompatible(item, componentHostRole(owner, builtinRegistry()))),
  );
  const [pattern, setPattern] = useState<string>();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const latest = new Map<string, (typeof loaded.catalog.templates)[number]>();
  for (const template of loaded.catalog.templates) {
    if (builtinRegistry().latest(template.id)?.version === template.version)
      latest.set(template.id, template);
  }
  const matches = (name: string, description: string) =>
    `${name} ${description}`.toLowerCase().includes(query.toLowerCase());
  const matchesCapability = (item: PlannedCapability) =>
    matches(
      item.name,
      `${item.description} ${item.fields
        .map((field) => `${field.label} ${field.options?.join(" ") ?? ""}`)
        .join(" ")}`,
    );
  const create = async (id: string) => {
    setCreating(true);
    setError(undefined);
    try {
      await useDraw.getState().flushLayout();
      const example = architectureExample(id);
      const project = await api.createProject(example.name);
      const result = await api.edit(project.id, 0, [
        ...example.design.elements.map((element) => ({ op: "addElement" as const, element })),
        ...example.design.connections.map((connection) => ({ op: "connect" as const, connection })),
        { op: "setArchitecture", architecture: example.design.architecture! },
      ]);
      if (!result.ok) throw new Error("The example could not be saved.");
      await api.putLayout(project.id, example.layout);
      await useDraw.getState().open(project.id);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setCreating(false);
    }
  };
  if (pattern)
    return (
      <PatternComposer
        pattern={pattern}
        onClose={() => setPattern(undefined)}
        onApplied={onClose}
      />
    );
  return (
    <ConfigurationDialog title="Architecture library" size="xl" onClose={onClose}>
      <p className="catalog-intro">
        Choose the responsibilities your system needs. Planned blocks have editable design options;
        runtime implementation comes later.
      </p>
      <p className="catalog-intro">
        Choose a logical application, data store or external system. Deployment infrastructure
        records placement concerns; it stays inspectable on C2 until deployment authoring is
        available. Runtime host compatibility is separate.
      </p>
      <Button variant="default" mb="md" onClick={onStarter}>
        Use an implemented starter or recipe
      </Button>
      {error ? (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      ) : null}
      <Tabs defaultValue={initialTab}>
        <Tabs.List>
          <Tabs.Tab value="blocks">Building blocks</Tabs.Tab>
          <Tabs.Tab value="examples">Architecture examples</Tabs.Tab>
          <Tabs.Tab value="patterns">Patterns</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="blocks" pt="md">
          <TextInput
            aria-label="Search building blocks"
            placeholder="Search cache, identity, storage…"
            leftSection={<IconSearch size={16} />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <div className="catalog-filters">
            {["All", ...new Set(capabilities.map((item) => item.group)), "Implemented"].map(
              (item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={group === item}
                  onClick={() => setGroup(item)}
                >
                  {item}
                </button>
              ),
            )}
          </div>
          <div className="catalog-grid">
            {(group === "All" || group === "Implemented") &&
              [...latest.values()]
                .filter((item) => matches(item.displayName, item.description))
                .map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    className="catalog-card"
                    data-family={templateFamily(template.id)}
                    onClick={() => {
                      onTemplate({
                        kind: template.kind,
                        template: { id: template.id, version: template.version },
                      });
                    }}
                  >
                    <Group justify="space-between">
                      <TemplateIcon name={typeStyles[templateFamily(template.id)].icon} size={22} />
                      <Badge size="xs" color="teal" variant="light">
                        Implemented
                      </Badge>
                    </Group>
                    <strong>{template.displayName}</strong>
                    <span>{template.description}</span>
                    <small>
                      {template.kind === "attachment" ? "Add to an application" : "Place on C2"}
                    </small>
                  </button>
                ))}
            {capabilities
              .filter(
                (item) => (group === "All" || group === item.group) && matchesCapability(item),
              )
              .map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="catalog-card"
                  data-family={capabilityFamily(item.id)}
                  disabled={item.scope === "component" && !onComponent}
                  onClick={() =>
                    item.scope === "component" ? onComponent?.(item.id) : onPlace(item.id)
                  }
                >
                  <Group justify="space-between">
                    <TemplateIcon name={typeStyles[capabilityFamily(item.id)].icon} size={22} />
                    <span className="capability-status">Planned</span>
                  </Group>
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                  <small>
                    {item.architectureKind ? `${item.architectureKind} · ` : ""}
                    {item.scope === "component"
                      ? onComponent
                        ? "Add inside selected application"
                        : "Select a C3 application to add"
                      : "Place on C2"}{" "}
                    · {item.fields.length} options
                  </small>
                </button>
              ))}
          </div>
          {!capabilities.some(
            (item) => (group === "All" || group === item.group) && matchesCapability(item),
          ) &&
          ![...latest.values()].some(
            (item) =>
              (group === "All" || group === "Implemented") &&
              matches(item.displayName, item.description),
          ) ? (
            <p>No matching blocks. Try another search or category.</p>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel value="patterns" pt="md">
          {loaded.design.architecture?.patternInstances?.length ? (
            <details className="pattern-composer">
              <summary>
                Compositions in this design ({loaded.design.architecture.patternInstances.length})
              </summary>
              {loaded.design.architecture.patternInstances.map((instance) => (
                <article key={instance.id}>
                  <h4>{instance.config.name}</h4>
                  <p>
                    {instance.pattern} · v{instance.version} · {instance.variant} · authored from
                    revision {instance.baseRevision}
                  </p>
                  {instance.invariants.map((text) => (
                    <p key={text}>{text}</p>
                  ))}
                  <small>
                    Historical provenance records intent; current contracts and policies may have
                    been edited.
                  </small>
                </article>
              ))}
            </details>
          ) : null}

          <p className="catalog-intro">
            Compose editable responsibilities, exact contracts and policies in this design. Preview
            explicit reuse and additions. Architecture patterns do not supply runtime
            implementations.
          </p>
          <div className="catalog-grid">
            {architecturePatterns.map((entry) => (
              <button
                type="button"
                key={entry.id}
                className="catalog-card"
                onClick={() => setPattern(entry.id)}
              >
                <strong>{entry.name}</strong>
                <span>{entry.description}</span>
                <small>v1.0.0 · {entry.variants.join(" / ")}</small>
              </button>
            ))}
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="examples" pt="md">
          <p className="catalog-intro">
            Create a separate editable design. These are architecture studies, with planned
            capabilities throughout.
          </p>
          <div className="catalog-examples">
            {architectureExamples.map((example) => (
              <article key={example.id} className="catalog-example" data-accent={example.accent}>
                <ExampleMiniature id={example.id} />
                <h3>{example.name}</h3>
                <p>{example.description}</p>
                <small>{example.useCases}</small>
                <Button
                  variant="default"
                  mt="md"
                  loading={creating}
                  onClick={() => void create(example.id)}
                >
                  Create {example.name.toLowerCase()}
                </Button>
              </article>
            ))}
          </div>
        </Tabs.Panel>
      </Tabs>
    </ConfigurationDialog>
  );
}

import { builtinRegistry } from "@jeeves/registry";
import {
  architectureExamples,
  architecturePatterns,
  componentCompatible,
  componentHostRole,
  containerClassification,
  type PlannedCapability,
  plannedCapabilities,
} from "@jeeves/spec";
import { Alert, Button, Group, NativeSelect, Tabs, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { type Tool, useDraw } from "../draw/store.ts";
import { TemplateIcon } from "../draw/TemplateIcon.tsx";
import { ArchitectureLibrary } from "./ArchitectureLibrary.tsx";
import { ArchitectureProofWorkshop } from "./ArchitectureProofWorkshop.tsx";
import { createExampleProject } from "./create-example.ts";
import { PatternComposer } from "./PatternComposer.tsx";
import { capabilityFamily, templateFamily, typeStyles } from "./type-style.tsx";

type CatalogTab = "containers" | "components" | "examples" | "patterns";
export function CapabilityCatalog({
  onClose,
  onPlace,
  onTemplate,
  onStarter,
  onComponent,
  componentContainer,
  initialTab = "containers",
}: {
  onClose: () => void;
  onPlace: (id: string) => void;
  onTemplate: (tool: Tool) => void;
  onStarter: () => void;
  onComponent: (id: string, host: string) => void;
  componentContainer?: string;
  initialTab?: CatalogTab;
}) {
  const loaded = useDraw((state) => state.loaded)!;
  const hosts = loaded.design.elements.filter(
    (element) =>
      containerClassification(element).kind === "Application" &&
      ["service", "frontend", "worker"].includes(
        componentHostRole(element, builtinRegistry()) ?? "",
      ),
  );
  const [host, setHost] = useState(
    hosts.find((e) => e.id === componentContainer)?.id ?? hosts[0]?.id ?? "",
  );
  const owner = hosts.find((e) => e.id === host);
  const [tab, setTab] = useState<string>(initialTab);
  const [localLibrary, setLocalLibrary] = useState(false);
  const [workshop, setWorkshop] = useState(false);
  const [pattern, setPattern] = useState<string>();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const capabilities = plannedCapabilities.filter((item) =>
    tab === "components"
      ? item.scope === "component" &&
        (!owner || componentCompatible(item, componentHostRole(owner, builtinRegistry())))
      : item.scope === "container" &&
        item.architectureKind !== "Deployment infrastructure" &&
        item.id !== "billing-provider",
  );
  const matches = (name: string, description: string) =>
    `${name} ${description}`.toLowerCase().includes(query.toLowerCase());
  const matchesCapability = (item: PlannedCapability) =>
    matches(
      item.name,
      `${item.description} ${item.fields.map((field) => `${field.label} ${field.options?.join(" ") ?? ""}`).join(" ")}`,
    );
  const shown = capabilities.filter(
    (item) => (group === "All" || group === item.group) && matchesCapability(item),
  );
  const latest = loaded.catalog.templates.filter(
    (template) => builtinRegistry().latest(template.id)?.version === template.version,
  );
  const create = async (id: string) => {
    setCreating(true);
    setError(undefined);
    try {
      await useDraw.getState().flushLayout();
      const project = await createExampleProject(id);
      await useDraw.getState().open(project.id);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setCreating(false);
    }
  };
  if (workshop) return <ArchitectureProofWorkshop onClose={onClose} />;
  if (localLibrary)
    return <ArchitectureLibrary onClose={onClose} onBack={() => setLocalLibrary(false)} />;
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
      <p>
        Families describe architecture intent. Exact backend implementations and unsupported options
        are inspected in Review → Implementation support.{" "}
        {builtinRegistry()
          .list()
          .reduce((n, m) => n + (m.capabilities?.length ?? 0), 0)}{" "}
        registered backend capability descriptors; observed evidence is separate.
      </p>
      {error ? (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      ) : null}
      <Tabs
        keepMounted={false}
        value={tab}
        onChange={(value) => {
          setTab(value ?? "containers");
          setGroup("All");
          setQuery("");
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="containers">Containers · C2</Tabs.Tab>
          <Tabs.Tab value="components">Components · C3</Tabs.Tab>
          <Tabs.Tab value="patterns">Patterns</Tabs.Tab>
          <Tabs.Tab value="examples">Examples</Tabs.Tab>
          <Tabs.Tab value="implementation">Runtime templates</Tabs.Tab>
        </Tabs.List>
        {tab === "containers" || tab === "components" ? (
          <div className="catalog-content">
            {tab === "components" ? (
              <NativeSelect
                label="Add inside application"
                value={host}
                data={
                  hosts.length
                    ? hosts.map((e) => ({ value: e.id, label: e.name }))
                    : [{ value: "", label: "Add a C2 application first" }]
                }
                onChange={(e) => setHost(e.currentTarget.value)}
              />
            ) : null}
            <TextInput
              aria-label="Search building blocks"
              placeholder={
                tab === "components"
                  ? "Search authorization, workflow, caching…"
                  : "Search web app, API, cache, queue…"
              }
              leftSection={<IconSearch size={16} />}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
            <div className="catalog-filters">
              {["All", ...new Set(capabilities.map((item) => item.group))].map((item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={group === item}
                  onClick={() => setGroup(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="catalog-grid">
              {shown.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="catalog-card"
                  data-family={capabilityFamily(item.id)}
                  disabled={item.scope === "component" && !owner}
                  onClick={() =>
                    item.scope === "component" ? onComponent(item.id, host) : onPlace(item.id)
                  }
                >
                  <TemplateIcon name={typeStyles[capabilityFamily(item.id)].icon} size={22} />
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
            {!shown.length ? <p>No matching options. Try another search or category.</p> : null}
          </div>
        ) : null}
        <Tabs.Panel value="implementation" pt="md">
          <Button variant="default" mb="md" onClick={onStarter}>
            Use an implemented starter or recipe
          </Button>
          <div className="catalog-grid">
            {latest.map((template) => (
              <button
                type="button"
                key={template.id}
                className="catalog-card"
                data-family={templateFamily(template.id)}
                onClick={() =>
                  onTemplate({
                    kind: template.kind,
                    template: { id: template.id, version: template.version },
                  })
                }
              >
                <strong>{template.displayName}</strong>
                <span>{template.description}</span>
                <small>
                  {template.kind === "attachment" ? "Attach on board" : "Place on board"}
                </small>
              </button>
            ))}
          </div>
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
          <div className="catalog-examples">
            {architectureExamples.map((example) => (
              <article key={example.id} className="catalog-example" data-accent={example.accent}>
                <h3>{example.name}</h3>
                <p>{example.description}</p>
                <Button
                  variant="default"
                  mt="md"
                  loading={creating}
                  aria-label={`Create ${example.name.toLowerCase()}`}
                  onClick={() => void create(example.id)}
                >
                  Use example
                </Button>
              </article>
            ))}
          </div>
        </Tabs.Panel>
      </Tabs>
      <Group className="catalog-footer" mt="lg">
        <Button variant="default" onClick={() => setLocalLibrary(true)}>
          Saved architecture templates
        </Button>
        <Button variant="subtle" color="var(--ink)" onClick={() => setWorkshop(true)}>
          Guided studies
        </Button>
      </Group>
    </ConfigurationDialog>
  );
}

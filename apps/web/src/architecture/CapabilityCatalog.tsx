import { architectureExample, architectureExamples, plannedCapabilities } from "@jeeves/spec";
import { Alert, Badge, Button, Group, Tabs, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { api } from "../draw/api.ts";
import { type Tool, useDraw } from "../draw/store.ts";
import { TemplateIcon } from "../draw/TemplateIcon.tsx";

export function CapabilityCatalog({
  onClose,
  onPlace,
  onTemplate,
  onStarter,
  onComponent,
  initialTab = "blocks",
}: {
  onClose: () => void;
  onPlace: (id: string) => void;
  onTemplate: (tool: Tool) => void;
  onStarter: () => void;
  onComponent?: (id: string) => void;
  initialTab?: "blocks" | "examples";
}) {
  const loaded = useDraw((state) => state.loaded)!;
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const latest = new Map<string, (typeof loaded.catalog.templates)[number]>();
  for (const template of loaded.catalog.templates) latest.set(template.id, template);
  const matches = (name: string, description: string) =>
    `${name} ${description}`.toLowerCase().includes(query.toLowerCase());
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
  return (
    <ConfigurationDialog title="Architecture library" size="xl" onClose={onClose}>
      <p className="catalog-intro">
        Choose the responsibilities your system needs. Planned blocks have editable design options;
        runtime implementation comes later.
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
            {["All", ...new Set(plannedCapabilities.map((item) => item.group)), "Implemented"].map(
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
                    onClick={() => {
                      onTemplate({
                        kind: template.kind,
                        template: { id: template.id, version: template.version },
                      });
                    }}
                  >
                    <Group justify="space-between">
                      <TemplateIcon name={template.card.icon} size={22} />
                      <Badge size="xs" color="teal" variant="light">
                        Implemented
                      </Badge>
                    </Group>
                    <strong>{template.displayName}</strong>
                    <span>{template.description}</span>
                    <small>
                      {template.kind === "attachment" ? "Add to an application" : "Place on C2"} ·{" "}
                      {template.version}
                    </small>
                  </button>
                ))}
            {plannedCapabilities
              .filter(
                (item) =>
                  (group === "All" || group === item.group) && matches(item.name, item.description),
              )
              .map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="catalog-card"
                  disabled={item.scope === "component" && !onComponent}
                  onClick={() =>
                    item.scope === "component" ? onComponent?.(item.id) : onPlace(item.id)
                  }
                >
                  <Group justify="space-between">
                    <TemplateIcon name={item.icon} size={22} />
                    <span className="capability-status">Planned</span>
                  </Group>
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                  <small>
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
          {!plannedCapabilities.some(
            (item) =>
              (group === "All" || group === item.group) && matches(item.name, item.description),
          ) &&
          ![...latest.values()].some(
            (item) =>
              (group === "All" || group === "Implemented") &&
              matches(item.displayName, item.description),
          ) ? (
            <p>No matching blocks. Try another search or category.</p>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel value="examples" pt="md">
          <p className="catalog-intro">
            Create a separate editable design. These are architecture studies, with planned
            capabilities throughout.
          </p>
          <div className="catalog-examples">
            {architectureExamples.map((example) => (
              <article key={example.id} className="catalog-example" data-accent={example.accent}>
                <div className="example-miniature" aria-hidden>
                  <span>Client</span>
                  <i>→</i>
                  <span>API</span>
                  <i>→</i>
                  <span>Data</span>
                  <span>Cache</span>
                  <span>Jobs</span>
                  <span>Worker</span>
                </div>
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

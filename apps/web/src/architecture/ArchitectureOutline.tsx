import {
  type ArchitectureProjection,
  type ArchitectureViews,
  componentPresentation,
} from "@jeeves/spec";
import { ActionIcon, TextInput } from "@mantine/core";
import { IconSearch, IconX } from "@tabler/icons-react";
import { useState } from "react";

export function ArchitectureOutline({
  views,
  projection,
  selected,
  onSelect,
  onContainer,
  onComponent,
  onClose,
}: {
  views?: ArchitectureViews;
  projection?: ArchitectureProjection;
  selected?: string;
  onSelect: (id: string) => void;
  onContainer: (id: string) => void;
  onComponent: (container: string, component?: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const match = (text: string) => text.toLowerCase().includes(query.trim().toLowerCase());
  const components = views?.components.map((view) => componentPresentation(view, false)) ?? [];
  const containers =
    views?.containers.nodes.filter((node) => node.binding && node.kind !== "system") ?? [];
  const relationships =
    projection?.edges.filter(
      (edge) => !selected || edge.id === selected || edge.from === selected || edge.to === selected,
    ) ?? [];
  return (
    <aside className="architecture-outline" aria-label="Model outline">
      <header>
        <strong>Design explorer</strong>
        <ActionIcon
          variant="subtle"
          color="var(--ink)"
          aria-label="Close explorer"
          onClick={onClose}
        >
          <IconX size={16} />
        </ActionIcon>
      </header>
      <TextInput
        size="xs"
        aria-label="Search design"
        placeholder="Find a responsibility…"
        leftSection={<IconSearch size={14} />}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
      />
      <div className="outline-tree">
        {containers.map((node) => {
          const view = components.find((view) => view.container === node.binding!.element);
          const children = view?.nodes.filter((n) => n.binding?.element === view.container) ?? [];
          if (!match(node.name) && !children.some((n) => match(n.name))) return null;
          return (
            <div className="outline-container" key={node.id}>
              <button
                type="button"
                className="outline-object"
                aria-pressed={selected === node.id}
                onClick={() => onContainer(node.binding!.element)}
              >
                <strong>{node.name}</strong>
              </button>
              {view ? (
                <details open={projection?.container === view.container || !!query || undefined}>
                  <summary>Components</summary>
                  {children
                    .filter((n) => match(node.name) || match(n.name))
                    .map((child) => (
                      <button
                        type="button"
                        key={child.id}
                        className="outline-component"
                        aria-pressed={selected === child.id}
                        title={child.description}
                        onClick={() => onComponent(view.container!, child.id)}
                      >
                        {child.name}
                      </button>
                    ))}
                  <button
                    type="button"
                    className="outline-drill"
                    onClick={() => onComponent(view.container!)}
                  >
                    Open C3 →
                  </button>
                </details>
              ) : null}
            </div>
          );
        })}
        {!containers.length ? (
          <p className="outline-caption">Add an application or data store to start your model.</p>
        ) : null}
        {projection?.nodes.some((node) => node.kind === "person") ? (
          <div className="outline-context">
            <h3>People</h3>
            {projection.nodes
              .filter((node) => node.kind === "person" && match(node.name))
              .map((node) => (
                <button type="button" key={node.id} onClick={() => onSelect(node.id)}>
                  {node.name}
                </button>
              ))}
          </div>
        ) : null}
        {relationships.length ? (
          <div className="outline-relationships">
            <h3>
              {selected ? "Connected relationships" : "Relationships in view"}{" "}
              <small>{relationships.length}</small>
            </h3>
            {relationships
              .filter((edge) => match(`${edge.description} ${edge.protocol}`))
              .map((edge) => (
                <button
                  type="button"
                  key={edge.id}
                  aria-pressed={selected === edge.id}
                  onClick={() => onSelect(edge.id)}
                >
                  <span>
                    {projection?.nodes.find((n) => n.id === edge.from)?.name} →{" "}
                    {projection?.nodes.find((n) => n.id === edge.to)?.name}
                  </span>
                  <strong>{edge.description}</strong>
                  <small>{edge.protocol}</small>
                </button>
              ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

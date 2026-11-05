import {
  type StudioScopeProjection,
  studioArchitectureExamples,
  studioDefinitions,
  studioLibraryGroups,
  studioPackagePresets,
  studioScopes,
  studioViews,
} from "@jeeves/spec";
import { useState } from "react";
import { createExampleProject } from "../architecture/create-example.ts";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useDraw } from "../draw/store.ts";
import { TemplateIcon } from "../draw/TemplateIcon.tsx";
import { type Creation, creationLabel, creationScope } from "./creation.ts";

export function StudioLibrary({
  scope,
  owner,
  busy,
  onAdd,
  onExisting,
  onUseExisting,
  onClose,
}: {
  scope: StudioScopeProjection;
  /** C3 only: the selected application that owns new resources and queues. */
  owner?: { id: string; name: string };
  busy: boolean;
  onAdd: (creation: Creation) => Promise<boolean>;
  onExisting: (id: string) => void;
  onUseExisting: (id: string) => void;
  onClose: () => void;
}) {
  const loaded = useDraw((state) => state.loaded);
  const [category, setCategory] = useState("Services");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<string>();
  const [existing, setExisting] = useState("");
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  if (!loaded) return null;
  const target = creationScope(scope);
  const views = studioViews(loaded.design, studioDefinitions, loaded.project.name);
  const visibleIds = new Set(
    studioScopes(views).flatMap((view) =>
      view.nodes.flatMap((node) =>
        node.refs.flatMap((ref) => (ref.kind === "element" ? [ref.id] : [])),
      ),
    ),
  );
  const definitions = Object.values(studioDefinitions).filter(
    (entry) => target && entry.creationScopes.includes(target),
  );
  const presets = studioPackagePresets.filter(
    (entry) => target === "c2" && entry.creationScopes.includes(target),
  );
  const groups = studioLibraryGroups.filter(
    (group) =>
      group === "Examples" ||
      (group === "Presets" && target === "c2") ||
      (scope.level === "context" && group === "Services") ||
      definitions.some((entry) => entry.libraryGroup === group),
  );
  const active = groups.includes(category as (typeof groups)[number]) ? category : groups[0];
  const matches = (value: string) => value.toLowerCase().includes(query.toLowerCase());
  const definition = definitions.find((item) => item.id === preview);
  const preset = presets.find((item) => item.id === preview);
  const example = studioArchitectureExamples.find((item) => item.id === preview);
  const contextKind = preview === "person" || preview === "external-system" ? preview : undefined;
  const add = async () => {
    setError(undefined);
    if (example) {
      setCreating(true);
      try {
        if (!(await useDraw.getState().flushEdits()))
          throw new Error("Resolve the pending edit first.");
        await useDraw.getState().flushLayout();
        const project = await createExampleProject(example.id);
        await useDraw.getState().open(project.id);
        onClose();
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setCreating(false);
      }
    } else if (definition || preset || contextKind) {
      const ok = await onAdd(
        preset
          ? { type: "package" }
          : { type: "base", kind: definition?.kind ?? contextKind ?? "service" },
      );
      if (ok) onClose();
      else
        setError(
          useDraw.getState().notice?.message ?? "Could not add this item. Try again or cancel.",
        );
    }
  };
  const disabled = busy || creating;
  return (
    <ConfigurationDialog
      title="Library"
      size="lg"
      onClose={() => {
        if (!disabled) onClose();
      }}
      footer={
        <div className="studio-library-footer">
          {error ? <p role="alert">{error}</p> : null}
          <button type="button" disabled={disabled} onClick={onClose}>
            Cancel
          </button>
          {definition || preset || example || contextKind ? (
            <button type="button" disabled={disabled} onClick={() => void add()}>
              {disabled ? "Adding…" : example ? "Create example project" : "Add"}
            </button>
          ) : null}
        </div>
      }
    >
      <div className="studio-library">
        <nav aria-label="Library categories">
          {groups.map((group) => (
            <button
              type="button"
              key={group}
              aria-current={active === group ? "page" : undefined}
              disabled={disabled}
              onClick={() => {
                setCategory(group);
                setPreview(undefined);
                setQuery("");
                setError(undefined);
              }}
            >
              {group}
            </button>
          ))}
        </nav>
        {preview ? (
          <section aria-label="Insertion preview" className="studio-library-preview">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setPreview(undefined);
                setError(undefined);
              }}
            >
              Back to list
            </button>
            <h3>
              {definition?.name ??
                preset?.name ??
                example?.name ??
                (contextKind && creationLabel(contextKind))}
            </h3>
            <p>
              {definition?.description ??
                preset?.description ??
                example?.description ??
                "A context identity; no runtime is created."}
            </p>
            {preset ? (
              <p>
                2 independent applications · 1 shared queue · 2 relationships. The package groups
                its members; it adds no runtime.
              </p>
            ) : null}
            {definition || preset ? (
              <p>
                {scope.level === "components"
                  ? owner
                    ? `Owned by ${owner.name}.`
                    : "Unowned. Select an application first to make it the owner."
                  : "Added at C2."}{" "}
                Select the new object to configure it.
              </p>
            ) : null}
            {example ? <p>Creates a separate editable studio project. Design only.</p> : null}
          </section>
        ) : (
          <>
            <label className="studio-form-field">
              Search Library
              <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
            </label>
            <div className="studio-library-list">
              {scope.level === "context" && active === "Services"
                ? (["person", "external-system"] as const)
                    .filter((kind) => matches(creationLabel(kind)))
                    .map((kind) => (
                      <button type="button" key={kind} onClick={() => setPreview(kind)}>
                        {creationLabel(kind)}
                      </button>
                    ))
                : null}
              {definitions
                .filter(
                  (item) =>
                    item.libraryGroup === active && matches(`${item.name} ${item.description}`),
                )
                .map((item) => (
                  <button type="button" key={item.id} onClick={() => setPreview(item.id)}>
                    <TemplateIcon name={item.visual.icon} size={20} />
                    <strong>{item.name}</strong>
                    <span>{item.description}</span>
                  </button>
                ))}
              {active === "Presets"
                ? presets
                    .filter((item) => matches(item.name))
                    .map((item) => (
                      <button type="button" key={item.id} onClick={() => setPreview(item.id)}>
                        <strong>{item.name}</strong>
                        <span>{item.description}</span>
                      </button>
                    ))
                : null}
              {active === "Examples"
                ? studioArchitectureExamples
                    .filter((item) => matches(`${item.name} ${item.description}`))
                    .map((item) => (
                      <button type="button" key={item.id} onClick={() => setPreview(item.id)}>
                        <strong>{item.name}</strong>
                        <span>{item.description}</span>
                      </button>
                    ))
                : null}
            </div>
            {scope.level !== "context" ? (
              <section className="studio-library-existing">
                <label className="studio-form-field">
                  Existing service or resource
                  <select
                    value={existing}
                    onChange={(event) => setExisting(event.currentTarget.value)}
                  >
                    <option value="">Select an existing object</option>
                    {loaded.design.elements
                      .filter((item) => visibleIds.has(item.id))
                      .map((item) => {
                        const binding = loaded.design.architecture?.studio?.elements.find(
                          (binding) => binding.element === item.id,
                        );
                        const owner = binding?.owner;
                        const name =
                          owner?.kind === "package"
                            ? loaded.design.architecture?.studio?.packages.find(
                                (pkg) => pkg.id === owner.id,
                              )?.name
                            : loaded.design.elements.find((element) => element.id === owner?.id)
                                ?.name;
                        return (
                          <option key={item.id} value={item.id}>
                            {item.name} ·{" "}
                            {binding?.settings.kind ?? item.classification?.kind ?? "Unbound"}
                            {name ? ` · ${name}` : ""} · {item.id}
                          </option>
                        );
                      })}
                  </select>
                </label>
                {existing && scope.level === "components" && owner ? (
                  <button
                    type="button"
                    onClick={() => {
                      onUseExisting(existing);
                      onClose();
                    }}
                  >
                    Use existing dependency
                  </button>
                ) : null}
                {existing ? (
                  <button
                    type="button"
                    onClick={() => {
                      onExisting(existing);
                      onClose();
                    }}
                  >
                    Inspect existing object
                  </button>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </div>
    </ConfigurationDialog>
  );
}

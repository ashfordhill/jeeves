import { builtinRegistry } from "@jeeves/registry";
import {
  type ArchitectureLibraryEntry,
  architectureExample,
  architectureExamples,
  type LibraryInsertInput,
  previewArchitectureTemplate,
  resolveStudioDefinition,
  type StudioScopeProjection,
  studioDefinitions,
  studioLibraryGroups,
  studioPackagePresets,
  studioViews,
} from "@jeeves/spec";
import { useCallback, useEffect, useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { api } from "../draw/api.ts";
import { useDraw } from "../draw/store.ts";
import { TemplateIcon } from "../draw/TemplateIcon.tsx";
import { type Creation, creationLabel, creationScope } from "./creation.ts";

export function StudioLibrary({
  scope,
  busy,
  onAdd,
  onExisting,
  onClose,
}: {
  scope: StudioScopeProjection;
  busy: boolean;
  onAdd: (creation: Creation) => Promise<boolean>;
  onExisting: (id: string) => void;
  onClose: () => void;
}) {
  const loaded = useDraw((state) => state.loaded);
  const [category, setCategory] = useState("Services");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<string>();
  const [existing, setExisting] = useState("");
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState<ArchitectureLibraryEntry[]>([]);
  const [libraryProblem, setLibraryProblem] = useState(false);
  const [roles, setRoles] = useState<LibraryInsertInput["roles"]>({});
  const loadSaved = useCallback(
    () =>
      api
        .architectureLibrary()
        .then((entries) => {
          setSaved(
            entries.filter(
              (entry) =>
                entry.state === "published" &&
                entry.fragment.architecture.studio &&
                !entry.fragment.architecture.components?.length &&
                entry.fragment.roles.some((role) => {
                  const binding = entry.fragment.architecture.studio?.elements.find(
                    (item) => item.element === role.id,
                  );
                  return (
                    !role.required &&
                    role.create &&
                    binding &&
                    resolveStudioDefinition(binding.definition)?.creationScopes.includes("c2")
                  );
                }) &&
                entry.fragment.roles.every((role) => {
                  const binding =
                    role.studio ??
                    entry.fragment.architecture.studio?.elements.find(
                      (item) => item.element === role.id,
                    );
                  return (
                    (role.kind === "boundary" || role.kind === "host") &&
                    binding &&
                    resolveStudioDefinition(binding.definition)
                  );
                }),
            ),
          );
          setLibraryProblem(false);
        })
        .catch(() => {
          setLibraryProblem(true);
        }),
    [],
  );
  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);
  if (!loaded) return null;
  const target = creationScope(scope);
  const views = studioViews(loaded.design, studioDefinitions, loaded.project.name);
  const visibleIds = new Set(
    [views.context, views.containers, ...views.details].flatMap((view) =>
      view.nodes.flatMap((node) =>
        node.refs.flatMap((ref) => (ref.kind === "element" ? [ref.id] : [])),
      ),
    ),
  );
  const definitions = Object.values(studioDefinitions).filter(
    (entry) =>
      target &&
      entry.creationScopes.includes(target) &&
      // An unowned integration needs an explicit relationship to appear in detail. UX08b owns
      // that creation flow; this unit offers existing identities and new C2 integrations.
      (scope.level !== "detail" || entry.role !== "integration"),
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
  const composition =
    target === "c2"
      ? saved.find((item) => `saved:${item.id}@${item.version}` === preview)
      : undefined;
  const compositionPreview = composition
    ? previewArchitectureTemplate(
        loaded.design,
        composition,
        {
          id: composition.id,
          version: composition.version,
          contentHash: composition.contentHash,
          instanceId: "lib-preview",
          name: composition.metadata.name.slice(0, 80),
          baseRevision: loaded.design.revision,
          roles,
        },
        builtinRegistry(),
      )
    : undefined;
  const example = architectureExamples.find((item) => item.id === preview);
  const contextKind = preview === "person" || preview === "external-system" ? preview : undefined;
  const templates = loaded.catalog.templates.filter(
    (template, index, all) => !all.slice(index + 1).some((other) => other.id === template.id),
  );
  const runtime = templates.find((item) => `runtime:${item.id}` === preview);
  const add = async () => {
    setError(undefined);
    if (example) {
      setCreating(true);
      try {
        if (!(await useDraw.getState().flushEdits()))
          throw new Error("Resolve the pending edit first.");
        await useDraw.getState().flushLayout();
        const source = architectureExample(example.id);
        const project = await api.createProject(source.name);
        try {
          const result = await api.edit(project.id, 0, [
            ...source.design.elements.map((element) => ({ op: "addElement" as const, element })),
            ...source.design.connections.map((connection) => ({
              op: "connect" as const,
              connection,
            })),
            ...(source.design.architecture
              ? [{ op: "setArchitecture" as const, architecture: source.design.architecture }]
              : []),
          ]);
          if (!result.ok) throw new Error("The example could not be saved.");
          await api.putLayout(project.id, source.layout);
        } catch (error) {
          // Only this newly created project is owned by the uncommitted insertion.
          await api.deleteProject(project.id);
          throw error;
        }
        await useDraw.getState().open(project.id);
        onClose();
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setCreating(false);
      }
    } else if (composition) {
      setCreating(true);
      try {
        const current = (await api.architectureLibrary()).find(
          (entry) => entry.id === composition.id && entry.version === composition.version,
        );
        if (current?.state !== "published" || current.contentHash !== composition.contentHash)
          throw new Error("This composition changed; reopen Library.");
        if (await onAdd({ type: "composition", entry: current, roles })) onClose();
        else setError(useDraw.getState().notice?.message ?? "Could not add this composition.");
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
          {definition || preset || example || contextKind || composition ? (
            <button
              type="button"
              disabled={disabled || (compositionPreview && !compositionPreview.ok)}
              onClick={() => void add()}
            >
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
              {composition?.metadata.name ??
                definition?.name ??
                preset?.name ??
                example?.name ??
                runtime?.displayName ??
                (contextKind && creationLabel(contextKind))}
            </h3>
            <p>
              {composition?.metadata.purpose ??
                definition?.description ??
                preset?.description ??
                example?.description ??
                runtime?.description ??
                "A context identity; no runtime is created."}
            </p>
            {preset ? (
              <p>
                2 independent applications · 1 shared queue · 2 relationships. The package groups
                its members; it adds no runtime.
              </p>
            ) : null}
            {composition && compositionPreview ? (
              <>
                <p>
                  Saved composition · {composition.id}@{composition.version}. Adds{" "}
                  {compositionPreview.additions.filter((item) => item.kind === "container").length}{" "}
                  applications/resources in one edit. Design only; runtime support is reviewed in
                  Generate.
                </p>
                {compositionPreview.roles
                  .filter((role) => !role.create)
                  .map((role) => {
                    const choice = roles?.[role.id];
                    return (
                      <label key={role.id} className="studio-form-field">
                        {role.name}
                        <select
                          value={choice?.mode === "reuse" ? choice.id : ""}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            setRoles((current) => ({
                              ...current,
                              [role.id]: value
                                ? { mode: "reuse", id: value }
                                : { mode: "unfilled" },
                            }));
                          }}
                        >
                          <option value="">Select an existing dependency</option>
                          {role.candidates.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} · {item.id}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                {compositionPreview.errors.length ? (
                  <p role="alert">{compositionPreview.errors[0]}</p>
                ) : null}
              </>
            ) : null}
            {definition || preset ? (
              <p>
                {scope.level === "detail"
                  ? scope.scope.kind === "package" &&
                    definition &&
                    ["application", "browser", "worker"].includes(definition.role)
                    ? "Joins this package."
                    : `Owned by ${scope.name}.`
                  : "Added at C2."}{" "}
                Select the new object to configure it. Runtime support and C4b work are reviewed in
                Generate.
              </p>
            ) : null}
            {example ? (
              <p>
                Creates a separate editable project from the preserved example source. These
                examples retain their existing model and runtime limitations.
              </p>
            ) : null}
            {runtime ? (
              <p>
                Existing {runtime.kind} template · {runtime.id}@{runtime.version}. Availability
                describes this template, independently of studio definitions and observed
                application verification. Existing designs remain accessible in Generate.
              </p>
            ) : null}
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
              {active === "Presets" && target === "c2"
                ? saved
                    .filter((item) => matches(`${item.metadata.name} ${item.metadata.purpose}`))
                    .map((item) => (
                      <button
                        type="button"
                        key={`${item.id}@${item.version}`}
                        onClick={() => {
                          setRoles({});
                          setPreview(`saved:${item.id}@${item.version}`);
                        }}
                      >
                        <strong>{item.metadata.name}</strong>
                        <span>{item.metadata.purpose}</span>
                      </button>
                    ))
                : null}
              {active === "Examples"
                ? architectureExamples
                    .filter((item) => matches(`${item.name} ${item.description}`))
                    .map((item) => (
                      <button type="button" key={item.id} onClick={() => setPreview(item.id)}>
                        <strong>{item.name}</strong>
                        <span>{item.description}</span>
                      </button>
                    ))
                : null}
            </div>
            {active === "Presets" && target === "c2" ? (
              <details>
                <summary>Existing runtime templates</summary>
                <div className="studio-library-list">
                  {templates
                    .filter((item) => matches(`${item.displayName} ${item.id}`))
                    .map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setPreview(`runtime:${item.id}`)}
                      >
                        {item.displayName} · {item.version}
                      </button>
                    ))}
                </div>
              </details>
            ) : null}
            {libraryProblem && active === "Presets" && target === "c2" ? (
              <p>
                Saved compositions could not load.{" "}
                <button type="button" onClick={() => void loadSaved()}>
                  Retry loading
                </button>
              </p>
            ) : null}
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
                            {binding?.settings.kind ?? item.classification?.kind ?? "Legacy"}
                            {name ? ` · ${name}` : ""} · {item.id}
                          </option>
                        );
                      })}
                  </select>
                </label>
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

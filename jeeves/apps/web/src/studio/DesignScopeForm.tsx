import {
  buildDesignScopeCommand,
  type DesignDocument,
  type DesignScope,
  designScope,
  designScopeSchema,
  previewDesignScope,
  scopeFeatureLabels,
  scopeFeatureSchema,
  tinyurlDesignScope,
  tinyurlProfile,
  unresolvedDesignScope,
} from "@jeeves/spec";
import { Button, Group } from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useProject } from "../project/store.ts";
import "./design-scope.css";

/** A bounded intent form. Preview and save use the same canonical commands as chat. */
export function DesignScopeForm({
  projectId,
  design,
  onClose,
}: {
  projectId: string;
  design: DesignDocument;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<DesignScope>(() => structuredClone(designScope(design)));
  const [preview, setPreview] = useState<{
    revision: number;
    value: ReturnType<typeof previewDesignScope>;
  }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const update = (next: DesignScope) => {
    setScope(next);
    setPreview(undefined);
    setError(undefined);
  };
  const known =
    scope.profile?.id === tinyurlProfile.id && scope.profile.version === tinyurlProfile.version;
  const unknown =
    scope.profile && !known ? `${scope.profile.id}@${scope.profile.version}` : undefined;
  const unresolved = preview?.value.unresolved ?? unresolvedDesignScope(design);
  const doPreview = () => {
    const parsed = designScopeSchema.safeParse(scope);
    if (!parsed.success) {
      setError(
        parsed.error.issues.map((item) => `${item.path.join(".")}: ${item.message}`).join(" "),
      );
      return;
    }
    setError(undefined);
    setPreview({ revision: design.revision, value: previewDesignScope(design, parsed.data) });
  };
  const save = async () => {
    if (!preview) return;
    if (
      design.revision === preview.revision &&
      design.schemaVersion === 3 &&
      JSON.stringify(design.scope) === JSON.stringify(preview.value.scope)
    ) {
      onClose();
      return;
    }
    setBusy(true);
    const saved = await useProject.getState().commit(projectId, (current) => {
      if (current.revision !== preview.revision)
        throw new Error(
          "The design changed after this preview. Preview the requirements again before saving.",
        );
      return buildDesignScopeCommand(current, { scope: preview.value.scope, upgrade: true }).ops;
    });
    setBusy(false);
    if (saved) onClose();
    else
      setError(
        "Requirements were not saved. Check the notice and preview again against the latest design.",
      );
  };
  return (
    <ConfigurationDialog
      title="Profile & requirements"
      size="lg"
      onClose={onClose}
      footer={
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="default" onClick={doPreview} disabled={busy}>
            Preview requirements
          </Button>
          <Button
            onClick={() => void save()}
            disabled={busy || !preview || preview.revision !== design.revision}
          >
            {design.schemaVersion === 2 ? "Upgrade & save requirements" : "Save requirements"}
          </Button>
        </Group>
      }
    >
      <div className="design-scope-form">
        <p>
          Save the behavior this design includes and excludes. A profile records intent; its
          required contracts still need to be specified.
        </p>
        <label>
          Behavior profile
          <select
            aria-label="Behavior profile"
            value={unknown ? "unknown" : known ? "tinyurl" : "unspecified"}
            onChange={(event) => {
              if (event.target.value === "tinyurl") {
                const defaults = tinyurlDesignScope();
                // Preserve explicit requirements, including conflicts with this narrow profile.
                update({
                  ...defaults,
                  requirements: defaults.requirements.map(
                    (item) =>
                      scope.requirements.find((existing) => existing.feature === item.feature) ??
                      item,
                  ),
                  customRequirements: scope.customRequirements,
                });
              } else if (event.target.value === "unspecified") update({ ...scope, profile: null });
            }}
          >
            <option value="unspecified">Unspecified</option>
            <option value="tinyurl">TinyURL create / resolve · 1.0.0</option>
            {unknown ? <option value="unknown">{unknown} · unresolved</option> : null}
          </select>
        </label>
        <p className="design-scope-hint">
          Available TinyURL profile: one public namespace, immutable HTTP(S) destinations,
          authenticated create, public resolve and optional expiry. Custom slugs, destination
          changes, management, reputation, quotas and exact analytics are outside this profile.
        </p>
        <details open>
          <summary>Included and excluded behavior</summary>
          <div className="design-scope-requirements">
            {scopeFeatureSchema.options.map((feature) => {
              const item = scope.requirements.find((entry) => entry.feature === feature);
              return (
                <div className="design-scope-row" key={feature}>
                  <span>{scopeFeatureLabels[feature]}</span>
                  <select
                    aria-label={`${scopeFeatureLabels[feature]} scope`}
                    value={item?.disposition ?? "unspecified"}
                    onChange={(event) => {
                      const rest = scope.requirements.filter((entry) => entry.feature !== feature);
                      update({
                        ...scope,
                        requirements:
                          event.target.value === "unspecified"
                            ? rest
                            : [
                                ...rest,
                                {
                                  feature,
                                  disposition: event.target.value as "included" | "excluded",
                                  criticality: item?.criticality ?? "required",
                                },
                              ],
                      });
                    }}
                  >
                    <option value="unspecified">Unspecified</option>
                    <option value="included">Included</option>
                    <option value="excluded">Excluded</option>
                  </select>
                  <select
                    aria-label={`${scopeFeatureLabels[feature]} criticality`}
                    value={item?.criticality ?? "required"}
                    disabled={!item}
                    onChange={(event) =>
                      update({
                        ...scope,
                        requirements: scope.requirements.map((entry) =>
                          entry.feature === feature
                            ? {
                                ...entry,
                                criticality: event.target.value as "required" | "advisory",
                              }
                            : entry,
                        ),
                      })
                    }
                  >
                    <option value="required">Required</option>
                    <option value="advisory">Advisory</option>
                  </select>
                </div>
              );
            })}
          </div>
        </details>
        <details open={scope.customRequirements.length > 0}>
          <summary>Unresolved custom requirements ({scope.customRequirements.length}/8)</summary>
          <p className="design-scope-hint">
            Custom behavior remains unresolved. Required custom behavior blocks the narrow profile.
            Targets keep the requirement visible if a tile or relationship is removed.
          </p>
          {scope.customRequirements.map((item, index) => {
            const change = (patch: Partial<typeof item>) =>
              update({
                ...scope,
                customRequirements: scope.customRequirements.map((entry, i) =>
                  i === index ? { ...entry, ...patch } : entry,
                ),
              });
            return (
              <fieldset key={item.id}>
                <legend>Custom requirement {index + 1}</legend>
                <label>
                  Requirement
                  <textarea
                    aria-label={`Custom requirement ${index + 1}`}
                    value={item.requirement}
                    maxLength={1000}
                    onChange={(event) => change({ requirement: event.target.value })}
                  />
                </label>
                <label>
                  Criticality
                  <select
                    aria-label={`Custom requirement ${index + 1} criticality`}
                    value={item.criticality}
                    onChange={(event) =>
                      change({ criticality: event.target.value as "required" | "advisory" })
                    }
                  >
                    <option value="required">Required</option>
                    <option value="advisory">Advisory</option>
                  </select>
                </label>
                <label>
                  Tile target
                  <select
                    aria-label={`Custom requirement ${index + 1} tile`}
                    value={item.element ?? ""}
                    onChange={(event) => change({ element: event.target.value || undefined })}
                  >
                    <option value="">Whole design</option>
                    {design.elements.map((element) => (
                      <option key={element.id} value={element.id}>
                        {element.name}
                      </option>
                    ))}
                    {item.element &&
                    !design.elements.some((element) => element.id === item.element) ? (
                      <option value={item.element}>{item.element} (missing)</option>
                    ) : null}
                  </select>
                </label>
                <label>
                  Relationship target
                  <select
                    aria-label={`Custom requirement ${index + 1} relationship`}
                    value={item.connection ?? ""}
                    onChange={(event) => change({ connection: event.target.value || undefined })}
                  >
                    <option value="">None</option>
                    {design.connections.map((connection) => (
                      <option key={connection.id} value={connection.id}>
                        {connection.planned.label} · {connection.id}
                      </option>
                    ))}
                    {item.connection &&
                    !design.connections.some((connection) => connection.id === item.connection) ? (
                      <option value={item.connection}>{item.connection} (missing)</option>
                    ) : null}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    update({
                      ...scope,
                      customRequirements: scope.customRequirements.filter((_, i) => i !== index),
                    })
                  }
                >
                  Remove custom requirement {index + 1}
                </button>
              </fieldset>
            );
          })}
          <button
            type="button"
            disabled={scope.customRequirements.length >= 8}
            onClick={() => {
              let next = 1;
              while (scope.customRequirements.some((item) => item.id === `custom-${next}`)) next++;
              update({
                ...scope,
                customRequirements: [
                  ...scope.customRequirements,
                  { id: `custom-${next}`, requirement: "", criticality: "required" },
                ],
              });
            }}
          >
            Add custom requirement
          </button>
        </details>
        {error ? <p role="alert">{error}</p> : null}
        {preview ? (
          <section aria-label="Requirements preview" className="design-scope-preview">
            <strong>
              {preview.value.fromSchema === 2
                ? "Explicit upgrade: schema v2 → v3"
                : "Requirements preview"}
            </strong>
            <p>{preview.value.note}</p>
            <p>
              Blueprint v3 retains these declarations. Default blueprint v2 will refuse content it
              cannot represent.
            </p>
          </section>
        ) : (
          <p className="design-scope-hint">
            Saved schema v{design.schemaVersion}. Preview before saving; opening this form changes
            nothing.
          </p>
        )}
        <details open={!!preview}>
          <summary>
            {preview ? "Preview" : "Saved design"}: {unresolved.length} unresolved requirements
          </summary>
          <ul>
            {unresolved.map((item) => (
              <li key={`${item.source}:${item.id}`}>
                <strong>{item.criticality}</strong> · {item.requirement}
              </li>
            ))}
          </ul>
        </details>
        <p className="design-scope-hint">
          Template availability: none. Runtime verification: none.
        </p>
      </div>
    </ConfigurationDialog>
  );
}

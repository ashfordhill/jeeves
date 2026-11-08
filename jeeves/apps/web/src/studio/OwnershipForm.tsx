import {
  buildOwnershipCommand,
  cleanOwnershipChange,
  type DesignDocument,
  declaredAccessLabels,
  declaredAccessSchema,
  designOwnership,
  type Ownership,
  previewOwnership,
  studioApplicationKinds,
} from "@jeeves/spec";
import { Button, Group } from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useProject } from "../project/store.ts";
import { OperationChanges } from "./OperationChanges.tsx";
import { OwnershipChanges } from "./OwnershipChanges.tsx";
import "./ownership.css";

/** Complete, finite declarations. Preview exposes every changed dependent row before one save. */
export function OwnershipForm({
  projectId,
  design,
  onClose,
}: {
  projectId: string;
  design: DesignDocument;
  onClose: () => void;
}) {
  const [model, setModel] = useState(() => structuredClone(designOwnership(design)));
  const [tab, setTab] = useState("Owners");
  const [preview, setPreview] = useState<{
    revision: number;
    value: ReturnType<typeof previewOwnership>;
  }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const name = (id: string) => design.elements.find((x) => x.id === id)?.name ?? id;
  const bindings = design.architecture?.studio?.elements ?? [];
  const applications = bindings.filter((x) =>
    (studioApplicationKinds as readonly string[]).includes(x.settings.kind),
  );
  const stores = bindings.filter((x) =>
    ["database", "cache", "object-store", "search"].includes(x.settings.kind),
  );
  const links = design.connections.filter(
    (x) =>
      applications.some((a) => a.element === x.from.element) &&
      stores.some((r) => r.element === x.to.element),
  );
  const pairs = [
    ...new Map(
      [
        ...links.map((x) => ({ role: x.from.element, resource: x.to.element })),
        ...model.grants,
      ].map((x) => [`${x.role}/${x.resource}`, { role: x.role, resource: x.resource }]),
    ).values(),
  ];
  const update = (next: Ownership, clean = false) => {
    setModel(
      clean
        ? cleanOwnershipChange(
            {
              ...design,
              schemaVersion: 3,
              scope:
                design.schemaVersion === 3
                  ? design.scope
                  : { profile: null, requirements: [], customRequirements: [] },
              ownership: model,
            },
            next,
          )
        : next,
    );
    setPreview(undefined);
    setError(undefined);
  };
  const previewNow = () => {
    try {
      setPreview({ revision: design.revision, value: previewOwnership(design, model) });
      setError(undefined);
      setTab("Preview");
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };
  const save = async () => {
    if (!preview?.value.canApply) return;
    if (!preview.value.changes.length) {
      onClose();
      return;
    }
    setBusy(true);
    const ok = await useProject.getState().commit(projectId, (current) => {
      if (current.revision !== preview.revision)
        throw new Error(
          "The design changed after this ownership preview. Preview again before saving.",
        );
      return buildOwnershipCommand(current, { ownership: preview.value.ownership, upgrade: true })
        .ops;
    });
    setBusy(false);
    if (ok) onClose();
    else
      setError(
        "Ownership was not saved. Check the notice, then preview against the latest design.",
      );
  };
  const accessOptions = (
    <>
      <option value="">Unspecified</option>
      {declaredAccessSchema.options.map((access) => (
        <option key={access} value={access}>
          {declaredAccessLabels[access]}
        </option>
      ))}
    </>
  );
  const ownerOptions = (
    <>
      <option value="">Unspecified</option>
      {model.owners.map((owner) => (
        <option key={owner.id} value={owner.id}>
          {owner.name || owner.id}
        </option>
      ))}
    </>
  );
  return (
    <ConfigurationDialog
      title="Ownership & access"
      size="xl"
      onClose={onClose}
      footer={
        <Group justify="flex-end" gap="xs">
          <Button variant="default" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="default" disabled={busy} onClick={previewNow}>
            Preview ownership
          </Button>
          <Button
            disabled={busy || !preview?.value.canApply || preview.revision !== design.revision}
            onClick={() => void save()}
          >
            {design.schemaVersion === 2 ? "Upgrade & save ownership" : "Save ownership"}
          </Button>
        </Group>
      }
    >
      <div className="ownership-form">
        <p>
          One logical owner may contain several API or worker roles. Roles may share a deployable;
          this grants no access. Legacy inferred writers stay separate.
        </p>
        <div className="studio-inspector-tabs" role="tablist" aria-label="Ownership sections">
          {["Owners", "Roles", "Resources", "Access", "Preview"].map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <section role="tabpanel" aria-label={tab}>
          {tab === "Owners" ? (
            <>
              <p>
                Logical owners declare responsibility, independently from packages and processes.
              </p>
              {model.owners.map((owner, index) => (
                <fieldset key={owner.id}>
                  <legend>Owner {owner.id}</legend>
                  <label>
                    Name
                    <input
                      aria-label={`Owner ${index + 1} name`}
                      value={owner.name}
                      onChange={(e) =>
                        update({
                          ...model,
                          owners: model.owners.map((x) =>
                            x.id === owner.id ? { ...x, name: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        { ...model, owners: model.owners.filter((x) => x.id !== owner.id) },
                        true,
                      )
                    }
                  >
                    Remove owner {owner.name || owner.id}
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                disabled={model.owners.length >= 50}
                onClick={() => {
                  let n = 1;
                  while (model.owners.some((x) => x.id === `owner-${n}`)) n++;
                  update({ ...model, owners: [...model.owners, { id: `owner-${n}`, name: "" }] });
                }}
              >
                Add logical owner
              </button>
              <p className="studio-field-help">
                Removing an owner clears its role, authority, grant and dependency declarations in
                the draft. Preview lists the exact changes. Tiles and custom requirements remain.
              </p>
            </>
          ) : null}
          {tab === "Roles" ? (
            <>
              <p>
                Each existing application tile can declare one canonical role. Assignment supplies
                no capability or permission.
              </p>
              {applications.map((binding) => {
                const id = binding.element,
                  role = model.roles.find((x) => x.element === id);
                return (
                  <fieldset key={id}>
                    <legend>
                      {name(id)} <small>· {id}</small>
                    </legend>
                    <label>
                      Logical owner
                      <select
                        aria-label={`${name(id)} logical owner`}
                        value={role?.owner ?? ""}
                        onChange={(e) =>
                          update(
                            {
                              ...model,
                              roles: [
                                ...model.roles.filter((x) => x.element !== id),
                                ...(e.target.value
                                  ? [
                                      {
                                        element: id,
                                        owner: e.target.value,
                                        kind: role?.kind ?? ("api" as const),
                                        ...(role?.deployable
                                          ? { deployable: role.deployable }
                                          : {}),
                                      },
                                    ]
                                  : []),
                              ],
                            },
                            true,
                          )
                        }
                      >
                        {ownerOptions}
                      </select>
                    </label>
                    {role ? (
                      <div className="ownership-grid">
                        <label>
                          Role kind
                          <select
                            aria-label={`${name(id)} role kind`}
                            value={role.kind}
                            onChange={(e) =>
                              update({
                                ...model,
                                roles: model.roles.map((x) =>
                                  x.element === id
                                    ? { ...x, kind: e.target.value as "api" | "worker" }
                                    : x,
                                ),
                              })
                            }
                          >
                            <option value="api">API role</option>
                            <option value="worker">Worker role</option>
                          </select>
                        </label>
                        <label>
                          Deployable assignment (optional)
                          <input
                            aria-label={`${name(id)} deployable`}
                            value={role.deployable ?? ""}
                            placeholder="Unspecified"
                            onChange={(e) =>
                              update({
                                ...model,
                                roles: model.roles.map((x) => {
                                  if (x.element !== id) return x;
                                  const { deployable: _, ...rest } = x;
                                  return {
                                    ...rest,
                                    ...(e.target.value ? { deployable: e.target.value } : {}),
                                  };
                                }),
                              })
                            }
                          />
                        </label>
                      </div>
                    ) : null}
                  </fieldset>
                );
              })}
            </>
          ) : null}
          {tab === "Resources" ? (
            <>
              <p>
                Authority is explicit and separate from the store's legacy owner. A projection
                declares its source; population and freshness need an exact compatible operation
                policy.
              </p>
              {stores.map((binding) => {
                const id = binding.element,
                  row = model.resources.find((x) => x.element === id);
                return (
                  <fieldset key={id}>
                    <legend>
                      {name(id)} <small>· {id}</small>
                    </legend>
                    <label>
                      Logical authority
                      <select
                        aria-label={`${name(id)} authority`}
                        value={row?.authority ?? ""}
                        onChange={(e) =>
                          update(
                            {
                              ...model,
                              resources: [
                                ...model.resources.filter((x) => x.element !== id),
                                ...(e.target.value
                                  ? [
                                      row
                                        ? { ...row, authority: e.target.value }
                                        : {
                                            element: id,
                                            authority: e.target.value,
                                            kind: "source" as const,
                                          },
                                    ]
                                  : []),
                              ],
                            },
                            true,
                          )
                        }
                      >
                        {ownerOptions}
                      </select>
                    </label>
                    {row ? (
                      <>
                        <label>
                          Resource classification
                          <select
                            aria-label={`${name(id)} resource classification`}
                            value={row.kind}
                            onChange={(e) =>
                              update(
                                {
                                  ...model,
                                  resources: model.resources.map((x) =>
                                    x.element !== id
                                      ? x
                                      : e.target.value === "source"
                                        ? {
                                            element: id,
                                            authority: x.authority,
                                            kind: "source" as const,
                                          }
                                        : {
                                            element: id,
                                            authority: x.authority,
                                            kind: "projection" as const,
                                            source: "",
                                          },
                                  ),
                                },
                                true,
                              )
                            }
                          >
                            <option value="source">Source of truth</option>
                            <option value="projection">Projection / derived copy</option>
                          </select>
                        </label>
                        {row.kind === "projection" ? (
                          <label>
                            Source resource
                            <select
                              aria-label={`${name(id)} projection source`}
                              value={row.source}
                              onChange={(e) =>
                                update(
                                  {
                                    ...model,
                                    resources: model.resources.map((x) =>
                                      x.element === id && x.kind === "projection"
                                        ? { ...x, source: e.target.value }
                                        : x,
                                    ),
                                  },
                                  true,
                                )
                              }
                            >
                              <option value="">Select declared source</option>
                              {model.resources
                                .filter((x) => x.kind === "source" && x.element !== id)
                                .map((x) => (
                                  <option key={x.element} value={x.element}>
                                    {name(x.element)}
                                  </option>
                                ))}
                            </select>
                          </label>
                        ) : null}
                      </>
                    ) : null}
                  </fieldset>
                );
              })}
            </>
          ) : null}
          {tab === "Access" ? (
            <>
              <p>
                Grants permit a role's bounded store access. Dependency intent declares what that
                relationship requests. Same-owner reads need read; cache read and fill needs both.
                No runtime authorization is implemented.
              </p>
              <h3>Role grants</h3>
              {pairs.map((pair) => {
                const grant = model.grants.find(
                    (x) => x.role === pair.role && x.resource === pair.resource,
                  ),
                  role = model.roles.find((x) => x.element === pair.role),
                  resource = model.resources.find((x) => x.element === pair.resource);
                const foreign = role && resource && role.owner !== resource.authority;
                return (
                  <fieldset key={`${pair.role}/${pair.resource}`}>
                    <legend>
                      {name(pair.role)} → {name(pair.resource)}
                    </legend>
                    <label>
                      Granted access
                      <select
                        aria-label={`${name(pair.role)} to ${name(pair.resource)} grant`}
                        value={grant?.access ?? ""}
                        onChange={(e) =>
                          update({
                            ...model,
                            grants: [
                              ...model.grants.filter((x) => x !== grant),
                              ...(e.target.value
                                ? [
                                    {
                                      ...pair,
                                      access: e.target.value as "read" | "write" | "read-write",
                                      ...(grant?.boundary ? { boundary: grant.boundary } : {}),
                                    },
                                  ]
                                : []),
                            ],
                          })
                        }
                      >
                        {accessOptions}
                      </select>
                    </label>
                    {grant && (foreign || grant.boundary) ? (
                      <label>
                        Cross-owner read boundary
                        <select
                          aria-label={`${name(pair.role)} to ${name(pair.resource)} boundary`}
                          value={grant.boundary ?? ""}
                          onChange={(e) =>
                            update({
                              ...model,
                              grants: model.grants.map((x) => {
                                if (x !== grant) return x;
                                const { boundary: _, ...rest } = x;
                                return {
                                  ...rest,
                                  ...(e.target.value
                                    ? { boundary: "published-read" as const }
                                    : {}),
                                };
                              }),
                            })
                          }
                        >
                          <option value="">Unspecified · direct cross-owner access refused</option>
                          <option value="published-read">
                            Explicit published read contract (intent only)
                          </option>
                        </select>
                      </label>
                    ) : null}
                    {!role || !resource ? (
                      <p className="studio-field-help">
                        Declare the source role and resource authority before granting access.
                      </p>
                    ) : null}
                  </fieldset>
                );
              })}
              <h3>Dependency access intent</h3>
              {links.map((link) => (
                <label key={link.id}>
                  {name(link.from.element)} → {name(link.to.element)} <small>{link.id}</small>
                  <select
                    aria-label={`${link.id} dependency access`}
                    value={model.dependencies.find((x) => x.connection === link.id)?.access ?? ""}
                    onChange={(e) =>
                      update({
                        ...model,
                        dependencies: [
                          ...model.dependencies.filter((x) => x.connection !== link.id),
                          ...(e.target.value
                            ? [
                                {
                                  connection: link.id,
                                  access: e.target.value as "read" | "write" | "read-write",
                                },
                              ]
                            : []),
                        ],
                      })
                    }
                  >
                    {accessOptions}
                  </select>
                </label>
              ))}
            </>
          ) : null}
          {tab === "Preview" ? (
            <p>
              Use Preview ownership to inspect every added, changed and removed declaration. Refused
              declarations remain in this draft so they can be corrected.
            </p>
          ) : null}
        </section>
        {error ? <p role="alert">{error}</p> : null}
        {preview ? (
          <section aria-label="Ownership preview" className="ownership-preview">
            <strong>
              {preview.value.canApply ? "Ownership declarations preview" : "Ownership refused"} ·{" "}
              {preview.value.changes.length} affected declarations
              {preview.value.operationChanges.length
                ? ` · ${preview.value.operationChanges.length} operation bindings also change`
                : ""}
            </strong>
            <p>
              {preview.value.fromSchema === 2 ? "Explicit upgrade: schema v2 → v3. " : ""}
              {preview.value.note}
            </p>
            {preview.value.operationChanges.length ? (
              <details open>
                <summary>
                  {preview.value.operationChanges.length} affected operation bindings
                </summary>
                <OperationChanges design={design} changes={preview.value.operationChanges} />
              </details>
            ) : null}
            <details open={tab === "Preview"}>
              <summary>Exact affected bindings and grants ({preview.value.changes.length})</summary>
              <OwnershipChanges design={design} changes={preview.value.changes} />
            </details>
            <details open={!preview.value.canApply}>
              <summary>{preview.value.findings.length} unresolved / refused declarations</summary>
              <ul>
                {preview.value.findings.map((x) => (
                  <li key={`${x.code}-${JSON.stringify(x.target)}-${x.message}`}>
                    {x.code}: {x.message}
                  </li>
                ))}
              </ul>
            </details>
          </section>
        ) : (
          <p className="studio-field-help">
            Saved schema v{design.schemaVersion}. Preview before saving. Default blueprint v2
            refuses explicit declarations; blueprint v3 retains them. Templates: none. Runtime
            verification: none.
          </p>
        )}
      </div>
    </ConfigurationDialog>
  );
}

import {
  buildOperationsCommand,
  createLinkOperation,
  createLinkSignature,
  type DesignDocument,
  designOperations,
  designOwnership,
  isCreateOperation,
  nextOperationBindingId,
  type OperationCall,
  type OperationContracts,
  operationCallerId,
  operationDisplayName,
  previewOperations,
  studioApplicationKinds,
} from "@jeeves/spec";
import { Button, Group } from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useProject } from "../project/store.ts";
import { OperationChanges } from "./OperationChanges.tsx";
import "./ownership.css";

/** Finite catalog selection, canonical bindings and an exact preview; no schema editor. */
export function OperationsForm({
  projectId,
  design,
  onClose,
}: {
  projectId: string;
  design: DesignDocument;
  onClose: () => void;
}) {
  const [model, setModel] = useState(() => structuredClone(designOperations(design)));
  const [tab, setTab] = useState("Receiver");
  const [preview, setPreview] = useState<{
    revision: number;
    value: ReturnType<typeof previewOperations>;
  }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const name = (id: string) => design.elements.find((x) => x.id === id)?.name ?? id;
  const studio = design.architecture?.studio,
    ownership = designOwnership(design);
  const applications =
    studio?.elements.filter((x) =>
      (studioApplicationKinds as readonly string[]).includes(x.settings.kind),
    ) ?? [];
  const stores = new Set(
    studio?.elements.filter((x) => x.settings.kind === "database").map((x) => x.element),
  );
  const availableRoles = applications.filter(
    (role) =>
      !model.receivers.some((x) => x.role === role.element && isCreateOperation(x.implementation)),
  );
  const update = (next: OperationContracts) => {
    setModel(next);
    setPreview(undefined);
    setError(undefined);
  };
  const previewNow = () => {
    try {
      setPreview({ revision: design.revision, value: previewOperations(design, model) });
      setTab("Preview");
      setError(undefined);
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
          "The design changed after this operation preview. Preview again before saving.",
        );
      return buildOperationsCommand(current, {
        operations: preview.value.operations,
        upgrade: true,
      }).ops;
    });
    setBusy(false);
    if (ok) onClose();
    else
      setError(
        "Operations were not saved. Check the notice, then preview against the latest design.",
      );
  };
  const addReceiver = () => {
    if (!availableRoles.some((x) => x.element === selectedRole)) return;
    const store = design.connections.find(
      (x) => x.from.element === selectedRole && stores.has(x.to.element),
    );
    update({
      ...model,
      receivers: [
        ...model.receivers,
        {
          id: nextOperationBindingId(
            "operation",
            model.receivers.map((x) => x.id),
          ),
          role: selectedRole,
          implementation: createLinkSignature(),
          binding: {
            kind: "create-link",
            storeConnection: store?.id ?? "unbound-store",
            successRetentionHours: 24,
            authVerifier: null,
          },
        },
      ],
    });
    setSelectedRole("");
  };
  const possible: OperationCall[] = model.receivers
    .filter((x) => isCreateOperation(x.implementation))
    .flatMap((receiver) => [
      ...(studio?.entries ?? [])
        .filter((x) => x.element === receiver.role)
        .map((entry) => ({
          id: "draft",
          caller: {
            kind: "entry" as const,
            entry: entry.id,
            lane: entry.lane,
            element: entry.element,
          },
          receiverBinding: receiver.id,
          receiverRole: receiver.role,
          expects: createLinkSignature(),
        })),
      ...design.connections
        .filter(
          (x) =>
            x.to.element === receiver.role &&
            applications.some((a) => a.element === x.from.element),
        )
        .map((link) => ({
          id: "draft",
          caller: { kind: "connection" as const, connection: link.id, role: link.from.element },
          receiverBinding: receiver.id,
          receiverRole: receiver.role,
          expects: createLinkSignature(),
        })),
    ]);
  const callerName = (call: OperationCall) =>
    call.caller.kind === "entry"
      ? `${call.caller.lane} entry ${call.caller.entry}`
      : `${name(call.caller.role)} (${call.caller.connection})`;
  return (
    <ConfigurationDialog
      title="Operation contracts"
      size="lg"
      onClose={onClose}
      footer={
        <Group justify="flex-end" gap="xs">
          <Button variant="default" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="default" disabled={busy} onClick={previewNow}>
            Preview operations
          </Button>
          <Button
            disabled={busy || !preview?.value.canApply || preview.revision !== design.revision}
            onClick={() => void save()}
          >
            {design.schemaVersion === 2 ? "Upgrade & save operations" : "Save operations"}
          </Button>
        </Group>
      }
    >
      <div className="ownership-form operation-form">
        <p>
          Available reviewed contract: <strong>Create link · v1</strong>. A binding declares a
          responsibility of the same API role. It adds no service or deployment. Templates and
          runtime verification: none.
        </p>
        <details>
          <summary>Fixed contract · authenticated create, durable success and replay</summary>
          <p>
            Verified issuer + subject; validated HTTP(S) destination; optional future expiry;
            server-allocated 22-character random code, at most 5 total allocation attempts including
            the initial attempt. One total 10-second deadline.
          </p>
          <p>
            Link and successful key result commit atomically before success. Principal + operation +
            key replays the original success for 24 hours, even after link expiry; changed payload
            conflicts once its prior fingerprint is known. Concurrent requests wait within the same
            deadline; unknown outcomes return dependency failure with same-key retry. After
            retention, the key is a new request and is revalidated.
          </p>
          <p>
            Authentication, invalid input, idempotency conflict, allocation exhaustion and
            dependency failures have exact schemas. Missing verifier remains unresolved. Resolve and
            cache policy are separate.
          </p>
          <details>
            <summary>Exact immutable catalog record</summary>
            <pre>{JSON.stringify(createLinkOperation, null, 2)}</pre>
          </details>
        </details>
        <div className="studio-inspector-tabs" role="tablist" aria-label="Operation sections">
          {["Receiver", "Callers", "Preview"].map((value) => (
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
          {tab === "Receiver" ? (
            <>
              <p>
                Choose a canonical API role and its own source database write. Missing ownership or
                grants stay unresolved; contradictory declarations refuse. Distinct operations keep
                separate binding IDs on the same API.
              </p>
              <label>
                Create receiver role
                <select
                  aria-label="Create receiver role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  <option value="">Choose existing role</option>
                  {availableRoles.map((x) => (
                    <option key={x.element} value={x.element}>
                      {name(x.element)} ·{" "}
                      {ownership.roles.find((r) => r.element === x.element)?.kind ??
                        "role unspecified"}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" disabled={!selectedRole} onClick={addReceiver}>
                Declare Create link
              </button>
              {model.receivers.map((receiver) => {
                const known = isCreateOperation(receiver.implementation),
                  links = design.connections.filter(
                    (x) => x.from.element === receiver.role && stores.has(x.to.element),
                  );
                return (
                  <fieldset key={receiver.id}>
                    <legend>
                      {operationDisplayName(receiver.implementation)} · {name(receiver.role)}
                    </legend>
                    {known ? (
                      <>
                        <label>
                          Authoritative write connection
                          <select
                            aria-label={`${receiver.id} create write connection`}
                            value={receiver.binding.storeConnection}
                            onChange={(e) =>
                              update({
                                ...model,
                                receivers: model.receivers.map((x) =>
                                  x.id === receiver.id
                                    ? {
                                        ...x,
                                        binding: { ...x.binding, storeConnection: e.target.value },
                                      }
                                    : x,
                                ),
                              })
                            }
                          >
                            {!links.some((x) => x.id === receiver.binding.storeConnection) ? (
                              <option value={receiver.binding.storeConnection}>
                                {receiver.binding.storeConnection} · unresolved
                              </option>
                            ) : null}
                            {links.map((x) => (
                              <option key={x.id} value={x.id}>
                                {name(x.to.element)} · {x.id}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="operation-check">
                          <input
                            type="checkbox"
                            aria-label={`${receiver.id} 24-hour retention`}
                            checked={receiver.binding.successRetentionHours === 24}
                            onChange={(e) =>
                              update({
                                ...model,
                                receivers: model.receivers.map((x) =>
                                  x.id === receiver.id
                                    ? {
                                        ...x,
                                        binding: {
                                          ...x.binding,
                                          successRetentionHours: e.target.checked ? 24 : null,
                                        },
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                          Declare 24-hour successful-key retention
                        </label>
                        <p className="studio-field-help">
                          Runtime auth verifier:{" "}
                          {receiver.binding.authVerifier
                            ? `${receiver.binding.authVerifier.id}@${receiver.binding.authVerifier.version} · unresolved`
                            : "unspecified and unavailable"}
                          . Identity providers and raw identity headers supply no verified
                          principal.
                        </p>
                        <details>
                          <summary>Auth verifier reference · unavailable</summary>
                          <p>
                            This exact reference is an unresolved declaration. No verifier registry,
                            adapter or verification evidence is available.
                          </p>
                          {receiver.binding.authVerifier ? (
                            <>
                              {(["id", "version", "sha256"] as const).map((field) => (
                                <label key={field}>
                                  {field === "id"
                                    ? "Verifier ID"
                                    : field === "version"
                                      ? "Exact version"
                                      : "SHA256"}
                                  <input
                                    aria-label={`${receiver.id} verifier ${field}`}
                                    maxLength={field === "id" ? 63 : field === "version" ? 40 : 64}
                                    value={receiver.binding.authVerifier?.[field] ?? ""}
                                    onChange={(event) =>
                                      update({
                                        ...model,
                                        receivers: model.receivers.map((x) =>
                                          x.id === receiver.id
                                            ? {
                                                ...x,
                                                binding: {
                                                  ...x.binding,
                                                  authVerifier: {
                                                    ...(x.binding.authVerifier ?? {
                                                      id: "",
                                                      version: "",
                                                      sha256: "",
                                                    }),
                                                    [field]: event.target.value,
                                                  },
                                                },
                                              }
                                            : x,
                                        ),
                                      })
                                    }
                                  />
                                </label>
                              ))}
                              <button
                                type="button"
                                onClick={() =>
                                  update({
                                    ...model,
                                    receivers: model.receivers.map((x) =>
                                      x.id === receiver.id
                                        ? { ...x, binding: { ...x.binding, authVerifier: null } }
                                        : x,
                                    ),
                                  })
                                }
                              >
                                Clear verifier reference {receiver.id}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                update({
                                  ...model,
                                  receivers: model.receivers.map((x) =>
                                    x.id === receiver.id
                                      ? {
                                          ...x,
                                          binding: {
                                            ...x.binding,
                                            authVerifier: { id: "", version: "", sha256: "" },
                                          },
                                        }
                                      : x,
                                  ),
                                })
                              }
                            >
                              Declare unresolved verifier reference {receiver.id}
                            </button>
                          )}
                        </details>
                      </>
                    ) : (
                      <p>
                        Exact unknown reference and its declared configuration are retained without
                        substitution. No Create link behavior or compatibility is established.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        update({
                          ...model,
                          receivers: model.receivers.filter((x) => x.id !== receiver.id),
                          calls: model.calls.filter((x) => x.receiverBinding !== receiver.id),
                        })
                      }
                    >
                      Remove operation {receiver.id}
                    </button>
                    <details>
                      <summary>Exact implementation references · {receiver.id}</summary>
                      <pre>{JSON.stringify(receiver, null, 2)}</pre>
                    </details>
                  </fieldset>
                );
              })}
            </>
          ) : null}
          {tab === "Callers" ? (
            <>
              <p>
                Bind existing actor entries or service connections to an exact receiver binding.
                Arrows remain caller → target requests. The operation's auth, schemas, idempotency
                and deadline must agree.
              </p>
              {possible.length === 0 ? (
                <p>Declare a known receiver, then connect an existing entry or service to it.</p>
              ) : null}
              {possible
                .filter(
                  (x) =>
                    !model.calls.some(
                      (saved) =>
                        operationCallerId(x) === operationCallerId(saved) &&
                        x.receiverBinding === saved.receiverBinding,
                    ),
                )
                .map((call) => (
                  <button
                    key={`${operationCallerId(call)}/${call.receiverBinding}`}
                    type="button"
                    onClick={() =>
                      update({
                        ...model,
                        calls: [
                          ...model.calls,
                          {
                            ...call,
                            id: nextOperationBindingId(
                              "call",
                              model.calls.map((x) => x.id),
                            ),
                          },
                        ],
                      })
                    }
                  >
                    Bind {callerName(call)} to {name(call.receiverRole)} ·{" "}
                    {operationDisplayName(call.expects)}
                  </button>
                ))}
              {model.calls.map((call) => (
                <fieldset key={call.id}>
                  <legend>
                    {callerName(call)} → {name(call.receiverRole)}
                  </legend>
                  <p>
                    {operationDisplayName(call.expects)} · receiver binding {call.receiverBinding}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      update({ ...model, calls: model.calls.filter((x) => x.id !== call.id) })
                    }
                  >
                    Remove binding {call.id}
                  </button>
                  <details>
                    <summary>Exact caller references · {call.id}</summary>
                    <pre>{JSON.stringify(call, null, 2)}</pre>
                  </details>
                </fieldset>
              ))}
            </>
          ) : null}
          {tab === "Preview" && !preview ? (
            <p>Preview the exact declaration changes before saving.</p>
          ) : null}
        </section>
        {error ? <p role="alert">{error}</p> : null}
        {preview ? (
          <section className="ownership-preview" aria-label="Operation preview">
            <strong>
              {preview.value.canApply ? "Operation declarations preview" : "Operations refused"} ·{" "}
              {preview.value.changes.length} affected bindings
            </strong>
            <p>
              {preview.value.fromSchema === 2 ? "Explicit upgrade: schema v2 → v3. " : ""}
              {preview.value.note}
            </p>
            <OperationChanges design={design} changes={preview.value.changes} />
            <details open>
              <summary>{preview.value.findings.length} unresolved / refused declarations</summary>
              <ul>
                {preview.value.findings.map((x) => (
                  <li key={`${JSON.stringify(x.target)}-${x.message}`}>{x.message}</li>
                ))}
              </ul>
            </details>
          </section>
        ) : (
          <p className="studio-field-help">
            Saved schema v{design.schemaVersion}. Preview before saving; default blueprint v2
            refuses operation bindings, v3 retains every exact declaration.
          </p>
        )}
      </div>
    </ConfigurationDialog>
  );
}

import {
  buildStudioCommand,
  type DesignDocument,
  type StudioConnectionCreation,
  type StudioScopeProjection,
  studioAccessSchema,
  studioActionSchema,
  studioDefinitions,
  studioInteractionSchema,
  studioProtocolSchema,
} from "@jeeves/spec";
import { useId, useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useDraw } from "../draw/store.ts";
import { type ConnectionDraft, commitAction, connectionCreation, endpointKind } from "./actions.ts";

export function ConnectionCreator({
  draft,
  projectId,
  design,
  scope,
  onClose,
  onConnected,
}: {
  draft: ConnectionDraft;
  projectId: string;
  design: DesignDocument;
  scope: StudioScopeProjection;
  onClose: () => void;
  onConnected: (id: string) => void;
}) {
  const uid = useId();
  const [from, setFrom] = useState(draft.from ?? "");
  const [to, setTo] = useState(draft.to ?? "");
  const [newId] = useState(() => `studio-${crypto.randomUUID()}`);
  const [connectionId] = useState(() => `studio-${crypto.randomUUID()}`);
  const [newName, setNewName] = useState(
    draft.newKind ? studioDefinitions[draft.newKind].creationName : "",
  );
  const [overrides, setOverrides] = useState<Partial<StudioConnectionCreation["planned"]>>({});
  const [role, setRole] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const target = draft.newKind ? newId : to;
  const withNew = (current: DesignDocument): DesignDocument =>
    draft.newKind
      ? {
          ...current,
          elements: [
            ...current.elements,
            {
              id: newId,
              name: newName,
              template: null,
              classification: studioDefinitions[draft.newKind].classification,
              attachments: [],
              config: {},
              notes: "",
            },
          ],
          architecture: current.architecture && {
            ...current.architecture,
            studio: {
              ...(current.architecture.studio ?? {
                version: 1 as const,
                elements: [],
                packages: [],
                connections: [],
              }),
              elements: [
                ...(current.architecture.studio?.elements ?? []),
                {
                  element: newId,
                  definition: { id: studioDefinitions[draft.newKind].id, version: "1.0.0" },
                  settings: structuredClone(studioDefinitions[draft.newKind].defaults),
                },
              ],
            },
          },
        }
      : current;
  let error: string | undefined;
  let connection: StudioConnectionCreation | undefined;
  try {
    if (draft.context) {
      const ids = ["system", ...(design.architecture?.nodes.map((item) => item.id) ?? [])];
      if (!ids.includes(from) || !ids.includes(to) || from === to)
        throw new Error("Select two different existing context objects.");
    } else connection = connectionCreation(connectionId, from, target, withNew(design));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const planned = {
    ...(connection?.planned ?? {
      label: "Uses",
      protocol: "Unspecified",
      interaction: "Request / response",
      security: "Service identity",
    }),
    ...overrides,
  };
  const queue = !!connection?.settings.channelUse;
  const selectedRole = role ?? connection?.settings.channelUse;
  if (queue && selectedRole !== connection?.settings.channelUse)
    error = `These endpoints require ${connection?.settings.channelUse === "publish" ? "Publish (application → queue)" : "Consume (queue → application)"}.`;
  if (queue && planned.interaction !== "Asynchronous")
    error = "Queue connections require Asynchronous interaction.";
  if (!studioActionSchema.safeParse(planned.label).success)
    error = "Enter an action of 1–60 characters.";
  if (draft.newKind && (!newName.trim() || newName.trim().length > 120))
    error = "Enter a name of 1–120 characters.";
  const choices = draft.context
    ? [
        { id: "system", name: design.architecture?.system.name ?? "System" },
        ...(design.architecture?.nodes ?? []),
      ]
    : design.elements.filter(
        (item) =>
          endpointKind(design, item.id) &&
          (scope.level === "detail" ||
            item.id === draft.from ||
            item.id === draft.to ||
            endpointKind(design, item.id) !== "queue"),
      );
  const changeEnd = (side: "from" | "to", value: string) => {
    if (side === "from") setFrom(value);
    else setTo(value);
    setOverrides({});
    setRole(undefined);
    setProblem(undefined);
  };
  const submit = async () => {
    if (error || busy) return;
    setBusy(true);
    setProblem(undefined);
    const ok = await commitAction(projectId, (current) => {
      if (draft.context) {
        if (!current.architecture)
          throw new Error("The architecture changed; reopen the connector.");
        const architecture = structuredClone(current.architecture);
        architecture.relationships.push({ id: connectionId, from, to, description: planned.label });
        return [{ op: "setArchitecture", architecture }];
      }
      const next = withNew(current);
      const latest = connectionCreation(connectionId, from, target, next);
      latest.planned = planned;
      if (queue) latest.settings = { channelUse: selectedRole as "publish" | "consume" };
      if (draft.newKind)
        return buildStudioCommand(current, {
          type: "create",
          elements: [
            {
              id: newId,
              name: newName.trim(),
              settings: structuredClone(studioDefinitions[draft.newKind].defaults),
            },
          ],
          connections: [latest],
        }).ops;
      return buildStudioCommand(current, {
        type: "connect",
        connection: latest,
        ...(draft.lookup && { lookup: draft.lookup }),
      }).ops;
    });
    setBusy(false);
    if (ok) onConnected(connectionId);
    else
      setProblem(
        useDraw.getState().notice?.message ?? "Connection not saved. Correct the draft or cancel.",
      );
  };
  return (
    <ConfigurationDialog
      title={draft.newKind ? "Add dependency" : "Connect"}
      size="lg"
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <div className="studio-library-footer">
          {problem || error ? <p role="alert">{problem ?? error}</p> : null}
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled={busy || !!error} onClick={() => void submit()}>
            {busy ? "Connecting…" : "Connect"}
          </button>
        </div>
      }
    >
      <div className="studio-connection-creation">
        {!draft.newKind && !draft.lookup ? (
          <button
            type="button"
            className="studio-action"
            disabled={busy}
            onClick={() => {
              setFrom(to);
              setTo(from);
              setOverrides({});
              setRole(undefined);
              setProblem(undefined);
            }}
          >
            Reverse direction
          </button>
        ) : null}
        {(["from", "to"] as const).map((side) =>
          side === "to" && draft.newKind ? (
            <label className="studio-form-field" key={side}>
              New {studioDefinitions[draft.newKind].name}
              <input value={newName} onChange={(e) => setNewName(e.currentTarget.value)} />
            </label>
          ) : (
            <label className="studio-form-field" key={side}>
              {side === "from" ? "Source" : "Target"}
              <select
                aria-label={side === "from" ? "Source" : "Target"}
                value={side === "from" ? from : to}
                onChange={(e) => changeEnd(side, e.currentTarget.value)}
                disabled={busy || (side === "from" && !!draft.lookup)}
              >
                <option value="">Select an endpoint</option>
                {choices
                  .filter(
                    (item) =>
                      side !== "to" ||
                      !draft.lookup ||
                      endpointKind(design, item.id) === draft.lookup.resource,
                  )
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                      {!draft.context ? ` · ${endpointKind(design, item.id)}` : ""}
                    </option>
                  ))}
              </select>
            </label>
          ),
        )}
        <label className="studio-form-field" htmlFor={`${uid}-action`}>
          Action
          <input
            id={`${uid}-action`}
            value={planned.label}
            onChange={(e) => {
              setOverrides({ ...overrides, label: e.currentTarget.value });
              setProblem(undefined);
            }}
          />
        </label>
        {!draft.context ? (
          <>
            {queue ? (
              <label className="studio-form-field">
                Channel role
                <select
                  aria-label="Channel role"
                  value={selectedRole}
                  onChange={(e) => {
                    setRole(e.currentTarget.value);
                    setProblem(undefined);
                  }}
                >
                  <option value="publish">Publish</option>
                  <option value="consume">Consume</option>
                </select>
              </label>
            ) : null}
            {(
              [
                ["protocol", "Protocol", studioProtocolSchema.options],
                ["interaction", "Interaction", studioInteractionSchema.options],
                ["security", "Access", studioAccessSchema.options],
              ] as const
            ).map(([field, label, options]) => (
              <label className="studio-form-field" key={field}>
                {label}
                <select
                  aria-label={label}
                  value={planned[field]}
                  onChange={(e) => {
                    setOverrides({ ...overrides, [field]: e.currentTarget.value });
                    setProblem(undefined);
                  }}
                >
                  {options.map((value) => (
                    <option value={value} key={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </>
        ) : null}
      </div>
    </ConfigurationDialog>
  );
}

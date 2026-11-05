import {
  buildStudioCommand,
  type DesignDocument,
  type StudioCommand,
  type StudioOwner,
  type StudioOwnerReassignment,
  type StudioSemanticRef,
} from "@jeeves/spec";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useDraw } from "../project/store.ts";
import { applicationKind, commitAction, endpointKind } from "./actions.ts";

export function MembershipActions({
  projectId,
  design,
  target,
  onElement,
}: {
  projectId: string;
  design: DesignDocument;
  target: StudioSemanticRef;
  onElement: (id: string) => void;
}) {
  const [action, setAction] = useState<StudioCommand>();
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [member, setMember] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const studio = design.architecture?.studio;
  if (!studio || !(target.kind === "package" || target.kind === "element")) return null;
  const pkg =
    target.kind === "package" ? studio.packages.find((item) => item.id === target.id) : undefined;
  const binding =
    target.kind === "element"
      ? studio.elements.find((item) => item.element === target.id)
      : undefined;
  if (!pkg && !binding) return null;
  const open = (command: StudioCommand) => {
    setAction(command);
    setOwners({});
    setProblem(undefined);
  };
  const deleted = new Set(
    action?.type === "delete"
      ? action.packageAction === "delete-members"
        ? (pkg?.members ?? [])
        : (action.elements ?? [])
      : [],
  );
  const dissolving = studio.packages.filter(
    (item) =>
      (action &&
        "package" in action &&
        action.package === item.id &&
        (action.type === "ungroup" ||
          action.type === "delete" ||
          (action.type === "removeMembers" &&
            item.members.filter((id) => !action.members.includes(id)).length < 2))) ||
      item.members.filter((id) => !deleted.has(id)).length < 2,
  );
  const lostOwner = (owner?: StudioOwner) =>
    owner &&
    (owner.kind === "element"
      ? deleted.has(owner.id)
      : dissolving.some((item) => item.id === owner.id));
  const resources = studio.elements.filter(
    (item) => !deleted.has(item.element) && lostOwner(item.owner),
  );
  const ownerChoices = [
    ...design.elements
      .filter((item) => !deleted.has(item.id) && applicationKind(endpointKind(design, item.id)))
      .map((item) => ({ value: `element:${item.id}`, label: `${item.name} · Application` })),
    ...studio.packages
      .filter((item) => !dissolving.some((lost) => lost.id === item.id))
      .map((item) => ({ value: `package:${item.id}`, label: `${item.name} · Package` })),
  ];
  const execute = async (command: StudioCommand) => {
    setBusy(true);
    setProblem(undefined);
    const ok = await commitAction(projectId, (current) => buildStudioCommand(current, command).ops);
    setBusy(false);
    if (ok) setAction(undefined);
    else
      setProblem(
        useDraw.getState().notice?.message ?? "Change not saved. Review owners or cancel.",
      );
  };
  const title =
    action?.type === "delete"
      ? action.packageAction === "delete-members"
        ? "Delete members"
        : "Delete object"
      : action?.type === "removeMembers"
        ? "Remove member"
        : "Ungroup";
  const submit = () => {
    if (!action) return;
    const reassignOwners: StudioOwnerReassignment[] = resources.map((item) => {
      const value = owners[item.element];
      const split = value?.indexOf(":") ?? -1;
      return {
        resource: item.element,
        owner:
          value === "none"
            ? null
            : {
                kind: value?.slice(0, split) as StudioOwner["kind"],
                id: value?.slice(split + 1) ?? "",
              },
      };
    });
    void execute({ ...action, reassignOwners } as StudioCommand);
  };
  const members = pkg?.members ?? [];
  const additions = design.elements.filter(
    (item) =>
      applicationKind(endpointKind(design, item.id)) &&
      !studio.packages.some((pkg) => pkg.members.includes(item.id)),
  );
  return (
    <div className="studio-membership">
      {pkg ? (
        <>
          <h3>Members</h3>
          {members.map((id) => (
            <div className="studio-member-row" key={id}>
              <button type="button" onClick={() => onElement(id)}>
                {design.elements.find((item) => item.id === id)?.name}
              </button>
              <button
                type="button"
                aria-label={`Remove ${design.elements.find((item) => item.id === id)?.name} from package`}
                onClick={() => open({ type: "removeMembers", package: pkg.id, members: [id] })}
              >
                Remove
              </button>
            </div>
          ))}
          {additions.length ? (
            <>
              <label className="studio-form-field">
                Add member
                <select
                  aria-label="Add member"
                  value={member}
                  onChange={(e) => setMember(e.currentTarget.value)}
                >
                  <option value="">Select an application</option>
                  {additions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!member || busy}
                onClick={() => {
                  const chosen = member;
                  setBusy(true);
                  void commitAction(projectId, (current) => {
                    const latest = current.architecture?.studio?.packages.find(
                      (item) => item.id === pkg.id,
                    );
                    if (!latest) throw new Error("Package no longer exists.");
                    return buildStudioCommand(current, {
                      type: "group",
                      package: { ...latest, members: [...latest.members, chosen] },
                    }).ops;
                  }).then((ok) => {
                    setBusy(false);
                    if (ok) setMember("");
                    else setProblem(useDraw.getState().notice?.message);
                  });
                }}
              >
                Add member
              </button>
            </>
          ) : null}
          <button type="button" onClick={() => open({ type: "ungroup", package: pkg.id })}>
            Ungroup
          </button>
          <button
            type="button"
            className="studio-danger"
            onClick={() =>
              open({ type: "delete", package: pkg.id, packageAction: "delete-members" })
            }
          >
            Delete members…
          </button>
        </>
      ) : binding ? (
        <button
          type="button"
          className="studio-danger"
          onClick={() => open({ type: "delete", elements: [binding.element] })}
        >
          Delete object…
        </button>
      ) : null}
      {problem && !action ? <p role="alert">{problem}</p> : null}
      {action ? (
        <ConfigurationDialog
          title={title}
          size="lg"
          onClose={() => {
            if (!busy) setAction(undefined);
          }}
          footer={
            <div className="studio-library-footer">
              {problem ? <p role="alert">{problem}</p> : null}
              <button type="button" disabled={busy} onClick={() => setAction(undefined)}>
                {action.type === "delete" ? "Keep" : "Cancel"}
              </button>
              <button
                type="button"
                className={action.type === "delete" ? "studio-danger" : undefined}
                disabled={
                  busy ||
                  resources.some(
                    (item) =>
                      !owners[item.element] ||
                      (item.settings.kind === "queue" && owners[item.element] === "none"),
                  )
                }
                onClick={submit}
              >
                {busy ? "Working…" : title}
              </button>
            </div>
          }
        >
          <p>
            {action.type === "delete"
              ? `Delete ${deleted.size} application or resource object${deleted.size === 1 ? "" : "s"} and their connections? Other resources and their consumers are preserved.`
              : action.type === "removeMembers"
                ? "Remove this application from the package. Its settings, resources and connections are preserved. A package with fewer than two remaining members dissolves."
                : "Ungroup these applications. Their settings, resources and connections are preserved."}
          </p>
          <ul>
            {(action.type === "delete"
              ? [...deleted]
              : action.type === "removeMembers"
                ? action.members
                : members
            ).map((id) => (
              <li key={id}>{design.elements.find((item) => item.id === id)?.name ?? id}</li>
            ))}
          </ul>
          {resources.length ? <p>Choose an owner for each resource before continuing.</p> : null}
          {resources.map((item) => (
            <label className="studio-form-field" key={item.element}>
              Owner for {design.elements.find((element) => element.id === item.element)?.name}
              <select
                aria-label={`Owner for ${design.elements.find((element) => element.id === item.element)?.name}`}
                value={owners[item.element] ?? ""}
                onChange={(e) => setOwners({ ...owners, [item.element]: e.currentTarget.value })}
              >
                <option value="">Choose explicitly</option>
                {item.settings.kind !== "queue" ? <option value="none">No owner</option> : null}
                {ownerChoices.map((owner) => (
                  <option key={owner.value} value={owner.value}>
                    {owner.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </ConfigurationDialog>
      ) : null}
    </div>
  );
}

/** Shared studio commands build one batch against the caller's latest accepted revision. */
import { type ArchitectureInput, architectureSchema } from "./architecture.ts";
import type { Connection, DesignDocument, ElementInput } from "./design.ts";
import {
  type OperationBatchInput,
  type OperationInput,
  operationBatchSchema,
} from "./operations.ts";
import { studioDefinitions } from "./studio-definitions.ts";
import {
  type DefinitionRef,
  type StudioConnectionSettings,
  type StudioElementBinding,
  type StudioModel,
  type StudioOwner,
  type StudioPackage,
  type StudioSettings,
  studioDefinitionRef,
} from "./studio-model.ts";

export type StudioElementCreation = {
  id: string;
  name: string;
  description?: string;
  settings: StudioSettings;
  definition?: DefinitionRef;
  owner?: StudioOwner;
};

export type StudioConnectionCreation = {
  id: string;
  from: string;
  to: string;
  kind: Connection["kind"];
  planned: NonNullable<Connection["planned"]>;
  settings: StudioConnectionSettings;
};

/** An owner change is always explicit, including when dissolving a package. */
export type StudioOwnerReassignment = { resource: string; owner: StudioOwner | null };

export type StudioCommand =
  | {
      type: "create";
      elements: StudioElementCreation[];
      connections?: StudioConnectionCreation[];
      package?: StudioPackage;
      /** Required only for the first creation in a document without architecture. */
      system?: ArchitectureInput["system"];
    }
  | {
      type: "edit";
      element: string;
      name?: string;
      description?: string;
      /** Complete union value: changing kind/execution must discard inapplicable fields. */
      settings?: StudioSettings;
      owner?: StudioOwner | null;
    }
  | { type: "connect"; connection: StudioConnectionCreation }
  | {
      type: "editConnection";
      connection: string;
      planned?: Partial<NonNullable<Connection["planned"]>>;
      /** Complete policy value; omitted numbers/references are removed. */
      settings?: StudioConnectionSettings;
    }
  | { type: "group"; package: StudioPackage }
  | {
      type: "removeMembers";
      package: string;
      members: string[];
      reassignOwners?: StudioOwnerReassignment[];
    }
  | { type: "ungroup"; package: string; reassignOwners?: StudioOwnerReassignment[] }
  | {
      type: "delete";
      elements?: string[];
      connections?: string[];
      package?: string;
      /** The UI confirms delete-members separately. Omission means ungroup. */
      packageAction?: "ungroup" | "delete-members";
      reassignOwners?: StudioOwnerReassignment[];
    };

/**
 * Called only by explicit destructive operations, on an already detached draft. Never cascade
 * resource ownership: a missing element/package owner must be reassigned or rejected by validation.
 */
export function pruneStudioAfterDelete(
  design: DesignDocument,
  removedElements: string[] = [],
  removedConnections: string[] = [],
): void {
  const studio = design.architecture?.studio;
  if (!studio) return;
  const removed = new Set(removedElements);
  const connections = new Set(removedConnections);
  studio.elements = studio.elements.filter((item) => !removed.has(item.element));
  studio.connections = studio.connections.filter((item) => !connections.has(item.connection));
  studio.packages = studio.packages.flatMap((item) => {
    const members = item.members.filter((id) => !removed.has(id));
    return members.length < 2 ? [] : [{ ...item, members }];
  });
  for (const binding of studio.elements) {
    const settings = binding.settings;
    if (settings.kind === "browser" && settings.delivery === "bundled") {
      if (settings.servedBy && removed.has(settings.servedBy)) delete settings.servedBy;
    }
    if (settings.kind === "cdn" && settings.origin && removed.has(settings.origin))
      delete settings.origin;
    if (settings.kind === "redirect") {
      for (const field of ["lookupStoreConnection", "lookupCacheConnection"] as const)
        if (settings[field] && connections.has(settings[field])) delete settings[field];
    }
  }
}

/**
 * No I/O and no cached architecture replacement. Toolbar and assistant callers submit this exact
 * baseRevision/ops through the existing operations transport. The server remains authoritative.
 * Inputs are cloned, and legacy objects cannot acquire a second editable settings source.
 */
export function buildStudioCommand(
  design: DesignDocument,
  command: StudioCommand,
): OperationBatchInput {
  const draft = structuredClone(design);
  const input = structuredClone(command);
  const ops: OperationInput[] = [];
  if (!draft.architecture) {
    if (input.type !== "create" || !input.system)
      throw new Error("Create an architecture system before using studio commands.");
    draft.architecture = architectureSchema.parse({ system: input.system });
    ops.push({ op: "setArchitecture", architecture: structuredClone(draft.architecture) });
  }
  const studio: StudioModel = draft.architecture.studio ?? {
    version: 1,
    elements: [],
    packages: [],
    connections: [],
  };
  draft.architecture.studio = studio;
  const binding = (id: string): StudioElementBinding => {
    const item = studio.elements.find((candidate) => candidate.element === id);
    if (!item) throw new Error(`Element ${id} has no editable studio binding.`);
    return item;
  };
  const group = (id: string): StudioPackage => {
    const item = studio.packages.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`Package ${id} does not exist.`);
    return item;
  };
  const reassign = (changes: StudioOwnerReassignment[] = []) => {
    for (const change of changes) {
      const item = binding(change.resource);
      if (change.owner === null) delete item.owner;
      else item.owner = change.owner;
    }
  };
  const connect = (item: StudioConnectionCreation) => {
    const connection: Connection = {
      id: item.id,
      kind: item.kind,
      from: { element: item.from },
      to: { element: item.to },
      planned: item.planned,
    };
    ops.push({ op: "connect", connection });
    draft.connections.push(connection);
    studio.connections.push({ connection: item.id, settings: item.settings });
  };
  switch (input.type) {
    case "create": {
      if (!input.elements.length) throw new Error("Create at least one studio element.");
      for (const item of input.elements) {
        const element: ElementInput = {
          id: item.id,
          name: item.name,
          ...(item.description !== undefined && { description: item.description }),
          classification: { ...studioDefinitions[item.settings.kind].classification },
          template: null,
          config: {},
          attachments: [],
          notes: "",
        };
        ops.push({ op: "addElement", element });
        studio.elements.push({
          element: item.id,
          definition: item.definition ?? studioDefinitionRef(item.settings.kind),
          settings: item.settings,
          ...(item.owner && { owner: item.owner }),
        });
      }
      for (const item of input.connections ?? []) connect(item);
      if (input.package) {
        // Package-scope placement creates the application and joins its existing package in one
        // batch. The caller rebuilds this complete membership against the latest accepted design.
        const index = studio.packages.findIndex((item) => item.id === input.package?.id);
        if (index < 0) studio.packages.push(input.package);
        else studio.packages[index] = input.package;
      }
      break;
    }
    case "edit": {
      const item = binding(input.element);
      if (input.name !== undefined || input.description !== undefined)
        ops.push({
          op: "updateElement",
          id: input.element,
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
        });
      if (input.settings) item.settings = input.settings;
      if (input.owner !== undefined) reassign([{ resource: input.element, owner: input.owner }]);
      break;
    }
    case "connect":
      connect(input.connection);
      break;
    case "editConnection": {
      const connection = draft.connections.find((item) => item.id === input.connection);
      const item = studio.connections.find((item) => item.connection === input.connection);
      if (!connection?.planned || !item)
        throw new Error(`Relationship ${input.connection} has no editable studio binding.`);
      if (input.planned)
        ops.push({ op: "updatePlannedConnection", id: input.connection, ...input.planned });
      if (input.settings) item.settings = input.settings;
      break;
    }
    case "group": {
      const index = studio.packages.findIndex((item) => item.id === input.package.id);
      if (index < 0) studio.packages.push(input.package);
      else studio.packages[index] = input.package;
      break;
    }
    case "removeMembers": {
      const item = group(input.package);
      if (input.members.some((id) => !item.members.includes(id)))
        throw new Error("Remove only members of the selected package.");
      item.members = item.members.filter((id) => !input.members.includes(id));
      if (item.members.length < 2)
        studio.packages = studio.packages.filter((candidate) => candidate.id !== item.id);
      reassign(input.reassignOwners);
      break;
    }
    case "ungroup":
      group(input.package);
      studio.packages = studio.packages.filter((item) => item.id !== input.package);
      reassign(input.reassignOwners);
      break;
    case "delete": {
      const elements = new Set(input.elements ?? []);
      if (input.package) {
        const item = group(input.package);
        if (input.packageAction === "delete-members")
          for (const id of item.members) elements.add(id);
        studio.packages = studio.packages.filter((item) => item.id !== input.package);
      }
      const connections = new Set(input.connections ?? []);
      for (const id of connections) ops.push({ op: "disconnect", id });
      for (const id of elements) ops.push({ op: "removeElement", id });
      const removedConnections = draft.connections.filter(
        (item) =>
          connections.has(item.id) ||
          elements.has(item.from.element) ||
          elements.has(item.to.element),
      );
      pruneStudioAfterDelete(
        draft,
        [...elements],
        removedConnections.map((item) => item.id),
      );
      reassign(input.reassignOwners);
      break;
    }
  }
  ops.push({ op: "setStudio", studio: draft.architecture.studio });
  return operationBatchSchema.parse({ baseRevision: design.revision, ops });
}

import { z } from "zod";
import { unbindArchitecture } from "./architecture.ts";
import { type DesignDocument, designIdNouns, designIds } from "./design.ts";
import { type Finding, finding, isStructural } from "./findings.ts";
import { generationFindings, pruneGenerationTargets } from "./generation.ts";
import {
  operationContractFindings,
  operationsAfterOwnership,
  pruneOperationEntries,
} from "./operation-contracts.ts";
import { type Operation, type OperationInput, operationSchema } from "./operations.ts";
import { ownershipFindings } from "./ownership.ts";
import { pruneStudioAfterDelete } from "./studio-prune.ts";
import { validateStudio } from "./studio-validation.ts";
import { validateDesign } from "./validate.ts";

export interface ApplyOptions {
  /** Revision the caller based its edits on. A mismatch is a `REVISION_CONFLICT`. */
  baseRevision?: number;
}

export type ApplyResult =
  | { ok: true; design: DesignDocument; findings: Finding[] }
  | { ok: false; errors: Finding[] };

class OpError extends Error {
  constructor(readonly finding: Finding) {
    super(finding.message);
  }
}

/**
 * Applies a batch of operations all-or-nothing and returns the new design (revision + 1) with its
 * findings. The batch is rejected if any operation is malformed or refers to something missing,
 * or if the result has a structural problem the input didn't already have. Readiness findings
 * never reject a batch. The input design is not modified.
 */
export function applyOperations(
  design: DesignDocument,
  ops: readonly OperationInput[],
  options: ApplyOptions = {},
): ApplyResult {
  if (options.baseRevision !== undefined && options.baseRevision !== design.revision) {
    return {
      ok: false,
      errors: [
        finding(
          "REVISION_CONFLICT",
          `The design changed (now revision ${design.revision}, edits were based on ${options.baseRevision}). Reload and try again.`,
        ),
      ],
    };
  }

  const parsed = z.array(operationSchema).min(1).safeParse(ops);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => {
        const [index, ...path] = issue.path;
        return finding(
          "INVALID_OPERATION",
          `${path.length > 0 ? `${path.join(".")}: ` : ""}${issue.message}`,
          typeof index === "number" ? { op: index } : {},
        );
      }),
    };
  }

  const draft = structuredClone(design);
  try {
    parsed.data.forEach((op, index) => {
      applyOne(draft, op, index);
    });
  } catch (error) {
    if (error instanceof OpError) return { ok: false, errors: [error.finding] };
    throw error;
  }

  const before = new Set(validateDesign(design).filter(isStructural).map(findingKey));
  const findings = validateDesign(draft);
  // Studio has no historical invalid-data allowance: every resulting binding must be sound,
  // including when replacing a bad value at the same finding path or through setArchitecture.
  const studioErrors = [
    ...validateStudio(draft),
    ...ownershipFindings(draft),
    ...operationContractFindings(draft),
    ...generationFindings(draft),
  ].filter(isStructural);
  if (studioErrors.length) return { ok: false, errors: studioErrors };
  const introduced = findings.filter((f) => isStructural(f) && !before.has(findingKey(f)));
  if (introduced.length > 0) return { ok: false, errors: introduced };
  draft.revision = design.revision + 1;
  return { ok: true, design: draft, findings };
}

function findingKey(f: Finding): string {
  return `${f.code} ${JSON.stringify(f.target)}`;
}

function applyOne(design: DesignDocument, op: Operation, index: number): void {
  const missing = (what: string, id: string) =>
    new OpError(finding("UNKNOWN_REFERENCE", `There is no ${what} "${id}".`, { op: index }));
  const ensureFree = (id: string) => {
    for (const entry of designIds(design)) {
      if (entry.id === id) {
        throw new OpError(
          finding("DUPLICATE_ID", `ID "${id}" is already used by ${designIdNouns[entry.type]}.`, {
            op: index,
          }),
        );
      }
    }
  };
  const findElement = (id: string) => {
    const element = design.elements.find((e) => e.id === id);
    if (!element) throw missing("element", id);
    return element;
  };
  const needsArchitecture = (what: string) =>
    new OpError(
      finding("INVALID_OPERATION", `Create an architecture system before ${what}.`, { op: index }),
    );

  switch (op.op) {
    case "upgradeDesign": {
      if (design.schemaVersion !== 2)
        throw new OpError(
          finding("INVALID_OPERATION", "Only a schema v2 design can be explicitly upgraded.", {
            op: index,
          }),
        );
      Object.assign(design, { schemaVersion: 3, scope: op.scope });
      return;
    }
    case "setDesignScope": {
      if (design.schemaVersion !== 3)
        throw new OpError(
          finding(
            "INVALID_OPERATION",
            "Explicitly upgrade to schema v3 before editing persistent requirements.",
            { op: index },
          ),
        );
      design.scope = op.scope;
      return;
    }
    case "setOwnership": {
      if (design.schemaVersion !== 3)
        throw new OpError(
          finding(
            "INVALID_OPERATION",
            "Explicitly upgrade to schema v3 before declaring ownership and access.",
            { op: index },
          ),
        );
      if (design.operations) design.operations = operationsAfterOwnership(design, op.ownership);
      design.ownership = op.ownership;
      return;
    }
    case "setOperations": {
      if (design.schemaVersion !== 3)
        throw new OpError(
          finding(
            "INVALID_OPERATION",
            "Explicitly upgrade to schema v3 before declaring operation bindings.",
            { op: index },
          ),
        );
      design.operations = op.operations;
      return;
    }
    case "setGeneration": {
      if (design.schemaVersion !== 3)
        throw new OpError(
          finding(
            "INVALID_OPERATION",
            "Explicitly upgrade to schema v3 before declaring template selections.",
            { op: index },
          ),
        );
      if (op.generation === null) delete design.generation;
      else design.generation = op.generation;
      return;
    }
    case "setArchitecture": {
      const previous = design.architecture?.studio?.entries ?? [];
      const components = design.architecture?.studio?.components ?? [];
      if (op.architecture === null) delete design.architecture;
      else design.architecture = op.architecture;
      pruneOperationEntries(design, previous);
      pruneGenerationTargets(
        design,
        [],
        components
          .filter(
            (entry) =>
              !design.architecture?.studio?.components?.some((next) => next.id === entry.id),
          )
          .map((entry) => entry.id),
      );
      return;
    }
    case "updateArchitectureSystem": {
      if (!design.architecture) throw needsArchitecture("updating its text");
      if (op.name !== undefined) design.architecture.system.name = op.name;
      if (op.description !== undefined) design.architecture.system.description = op.description;
      return;
    }
    case "setStudio": {
      if (!design.architecture) throw needsArchitecture("setting studio intent");
      const previous = design.architecture.studio?.entries ?? [];
      const components = design.architecture.studio?.components ?? [];
      if (op.studio === null) delete design.architecture.studio;
      else design.architecture.studio = op.studio;
      pruneOperationEntries(design, previous);
      pruneGenerationTargets(
        design,
        [],
        components
          .filter(
            (entry) =>
              !design.architecture?.studio?.components?.some((next) => next.id === entry.id),
          )
          .map((entry) => entry.id),
      );
      return;
    }
    case "addElement": {
      ensureFree(op.element.id);
      design.elements.push(op.element);
      return;
    }
    case "updateElement": {
      const element = findElement(op.id);
      if (op.name !== undefined) element.name = op.name;
      if (op.description !== undefined) element.description = op.description;
      if (op.classification !== undefined) element.classification = op.classification;
      return;
    }
    case "removeElement": {
      const element = findElement(op.id);
      const removedConnections = design.connections.filter(
        (c) => c.from.element === op.id || c.to.element === op.id,
      );
      design.elements = design.elements.filter((e) => e !== element);
      design.connections = design.connections.filter(
        (c) => c.from.element !== op.id && c.to.element !== op.id,
      );
      unbindArchitecture(design, element.id);
      pruneStudioAfterDelete(
        design,
        [op.id],
        removedConnections.map((item) => item.id),
      );
      return;
    }
    case "connect": {
      ensureFree(op.connection.id);
      design.connections.push(op.connection);
      return;
    }
    case "updatePlannedConnection": {
      const connection = design.connections.find((item) => item.id === op.id);
      if (!connection) throw missing("connection", op.id);
      for (const field of ["label", "protocol", "interaction", "security"] as const)
        if (op[field] !== undefined) Object.assign(connection.planned, { [field]: op[field] });
      return;
    }
    case "disconnect": {
      if (!design.connections.some((c) => c.id === op.id)) throw missing("connection", op.id);
      design.connections = design.connections.filter((c) => c.id !== op.id);
      pruneStudioAfterDelete(design, [], [op.id]);
      return;
    }
  }
}

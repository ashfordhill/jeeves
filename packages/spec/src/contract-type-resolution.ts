/** Pure design-type resolution. No runtime/serializer support is implied by a resolved shape. */
import type { ContractShape } from "./architecture-contracts.ts";
import type {
  ContractTypeDefinition,
  ContractTypeReference,
  ContractValue,
} from "./contract-shapes.ts";

export const CONTRACT_RESOLUTION_DEPTH = 20;
export const CONTRACT_RESOLUTION_NODES = 2_000;
export const contractTypeKey = (ref: ContractTypeReference) => `${ref.id}@${ref.version}`;
export type ContractTypeIssue = {
  code:
    | "MISSING_TYPE"
    | "CYCLE"
    | "DEPTH"
    | "NODES"
    | "INVALID_UNION"
    | "DUPLICATE_TYPE"
    | "UNRESOLVED";
  path: (string | number)[];
  message: string;
};
export type ContractResolutionLimits = { maxDepth?: number; maxNodes?: number };
type Path = ContractTypeIssue["path"];

function resolver(types: readonly ContractTypeDefinition[], limits: ContractResolutionLimits) {
  const issues: ContractTypeIssue[] = [];
  const references = new Map<string, ContractTypeReference>();
  const definitions = new Map<string, ContractTypeDefinition>();
  const maxDepth = Math.min(
    limits.maxDepth ?? CONTRACT_RESOLUTION_DEPTH,
    CONTRACT_RESOLUTION_DEPTH,
  );
  const maxNodes = Math.min(
    limits.maxNodes ?? CONTRACT_RESOLUTION_NODES,
    CONTRACT_RESOLUTION_NODES,
  );
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || !Number.isInteger(maxNodes) || maxNodes < 1)
    throw new Error(
      "Resolution budgets must be finite nonnegative depth and positive node counts.",
    );
  let visitedNodes = 0;
  let exhausted = false;
  const issue = (code: ContractTypeIssue["code"], path: Path, message: string) => {
    issues.push({ code, path, message });
  };
  types.forEach((type, index) => {
    const key = contractTypeKey(type);
    if (definitions.has(key))
      issue("DUPLICATE_TYPE", ["types", index], `Duplicate local type ${key}.`);
    definitions.set(key, type);
  });
  const visit = (
    value: ContractValue,
    path: Path,
    depth = 0,
    stack: readonly string[] = [],
  ): ContractValue | undefined => {
    if (exhausted) return undefined;
    if (visitedNodes >= maxNodes) {
      exhausted = true;
      issue("NODES", path, `Contract resolution exceeds the ${maxNodes}-node budget.`);
      return undefined;
    }
    visitedNodes++;
    if (depth > maxDepth) {
      issue("DEPTH", path, `Contract resolution exceeds depth ${maxDepth}.`);
      return undefined;
    }
    const unresolved = (message: string) => issue("UNRESOLVED", path, message);
    if (value.type === "ref") {
      if (!value.ref) {
        unresolved("Select an exact local type version.");
        return undefined;
      }
      const key = contractTypeKey(value.ref);
      references.set(key, value.ref);
      const target = definitions.get(key);
      if (!target) {
        issue("MISSING_TYPE", path, `Local type ${key} does not exist in this contract shape.`);
        return undefined;
      }
      if (stack.includes(key)) {
        issue(
          "CYCLE",
          path,
          `Recursive runtime types are unsupported: ${[...stack, key].join(" → ")}.`,
        );
        return undefined;
      }
      const resolved = visit(target.value, [...path, "ref", key], depth + 1, [...stack, key]);
      if (!resolved) return undefined;
      const { type: _type, ref: _ref, nullable, ...metadata } = value;
      return {
        ...resolved,
        ...metadata,
        ...(nullable !== undefined || resolved.nullable !== undefined
          ? { nullable: nullable === true || resolved.nullable === true }
          : {}),
      };
    }
    const result = { ...value };
    if (value.type === "unresolved") unresolved("Type is unresolved.");
    if (value.type === "array") {
      if (!value.items) unresolved("Select an array item type.");
      else result.items = visit(value.items, [...path, "items"], depth + 1, stack);
    }
    if (value.type === "object") {
      if (!value.fields?.length) unresolved("Define object fields.");
      else
        result.fields = value.fields.map((field, index) => {
          const child = visit(field, [...path, "fields", index], depth + 1, stack);
          return child
            ? {
                ...child,
                id: field.id,
                name: field.name,
                required: field.required,
                description: field.description,
              }
            : field;
        });
    }
    if (value.type === "map") {
      if (!value.keys || value.maxEntries === undefined || !value.values)
        unresolved("A map needs bounded string keys, a maximum entry count and a value type.");
      if (value.values) result.values = visit(value.values, [...path, "values"], depth + 1, stack);
    }
    if (value.type === "tagged-union") {
      if (!value.variants) unresolved("Define at least two tagged variants.");
      else {
        const tags = new Set<string>();
        result.variants = value.variants.map((variant, index) => {
          const childPath = [...path, "variants", index];
          const child = visit(variant, childPath, depth + 1, stack);
          if (child && child.type !== "unresolved") {
            const tag = child.fields?.find((f) => f.name === value.discriminator);
            const literal = tag?.enumValues?.[0];
            if (
              tag?.type === "unresolved" ||
              tag?.type === "ref" ||
              (child.type === "object" && !child.fields?.length)
            )
              issue(
                "UNRESOLVED",
                childPath,
                "Resolve the discriminator to one required literal tag.",
              );
            else if (
              child.type !== "object" ||
              child.nullable ||
              !tag?.required ||
              tag.nullable ||
              tag.type !== "text" ||
              tag.enumValues?.length !== 1 ||
              literal === undefined
            )
              issue(
                "INVALID_UNION",
                childPath,
                "Each variant needs a nonnullable object and required nonnullable single text discriminator tag.",
              );
            else if (tags.has(literal))
              issue("INVALID_UNION", childPath, `Duplicate discriminator tag ${literal}.`);
            else tags.add(literal);
          }
          return child ?? variant;
        });
      }
    }
    return result;
  };
  const report = () => ({
    ok: issues.length === 0,
    issues,
    references: [...references.values()],
    visitedNodes,
  });
  return { visit, report };
}

/** Expands only in memory, with budgets counting each expansion of a shared definition. */
export function resolveContractValue(
  value: ContractValue,
  types: readonly ContractTypeDefinition[] = [],
  limits: ContractResolutionLimits = {},
) {
  const context = resolver(types, limits);
  const resolved = context.visit(value, []);
  const report = context.report();
  return { ...report, ...(report.ok && resolved ? { value: resolved } : {}) };
}

/** Validate every definition, including unused drafts, and every operation/outcome payload. */
export function inspectContractShape(shape: ContractShape, limits: ContractResolutionLimits = {}) {
  const context = resolver(shape.types ?? [], limits);
  for (const [index, type] of (shape.types ?? []).entries())
    context.visit(type.value, ["types", index, "value"], 0, [contractTypeKey(type)]);
  for (const [index, field] of shape.payload.entries()) context.visit(field, ["payload", index]);
  for (const [index, operation] of shape.operations.entries()) {
    for (const key of ["input", "output"] as const)
      for (const [i, field] of operation[key].entries())
        context.visit(field, ["operations", index, key, i]);
    for (const [i, outcome] of (operation.outcomes ?? []).entries())
      for (const [j, field] of (outcome.payload ?? []).entries())
        context.visit(field, ["operations", index, "outcomes", i, "payload", j]);
  }
  return context.report();
}

/** Exact logical semantics exclude only the presentation of local definitions. */
export function contractShapeSemantics(shape: ContractShape | undefined) {
  if (!shape?.types) return shape;
  return {
    ...shape,
    types: shape.types.map(({ name: _name, description: _description, ...type }) => type),
  };
}

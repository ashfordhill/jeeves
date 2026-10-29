import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { type Contract, type Operation, responseFor } from "./contract.ts";

/** Where a request problem is. */
export type Location = "path" | "query" | "header" | "body" | "response";

export interface Problem {
  in: Location;
  /** JSON pointer into that part of the request, e.g. `/limit`. */
  path: string;
  message: string;
}

export interface RequestParts {
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
  body: unknown;
}

export interface OperationValidator {
  /** Validates (and coerces path, query, and header values in place); returns problems. */
  request(parts: RequestParts): Problem[];
  /** Checks a response against the contract; returns problems. */
  response(status: number, body: unknown): Problem[];
}

const DOCUMENT_ID = "https://jeeves.local/openapi.json";
// OpenAPI formats with no JSON Schema meaning; accepted so contracts using them still compile.
const OPENAPI_FORMATS = ["int32", "int64", "float", "double", "byte", "binary", "password"];

function createAjv(coerce: boolean, document: Record<string, unknown>) {
  const ajv = new Ajv2020({
    strict: false,
    allErrors: true,
    ...(coerce && { coerceTypes: "array" as const, useDefaults: true }),
  });
  addFormats(ajv);
  for (const format of OPENAPI_FORMATS) ajv.addFormat(format, true);
  // Schemas reference `#/components/...`; registering the document lets them resolve.
  ajv.addSchema({ $id: DOCUMENT_ID, components: rewriteRefs(document.components ?? {}) });
  return ajv;
}

/** Compiles validators for every operation in a contract, by `operationId`. */
export function createValidators(contract: Contract): Map<string, OperationValidator> {
  const params = createAjv(true, contract.document);
  const bodies = createAjv(false, contract.document);
  const validators = new Map<string, OperationValidator>();
  for (const operation of contract.operations) {
    validators.set(operation.operationId, operationValidator(operation, params, bodies));
  }
  return validators;
}

function operationValidator(
  operation: Operation,
  params: Ajv2020,
  bodies: Ajv2020,
): OperationValidator {
  const group = (location: "path" | "query" | "header") => {
    const list = operation.parameters.filter((p) => p.in === location);
    if (list.length === 0) return undefined;
    return params.compile({
      type: "object",
      properties: Object.fromEntries(list.map((p) => [p.name, rewriteRefs(p.schema)])),
      required: list.filter((p) => p.required).map((p) => p.name),
    });
  };
  const checks: [Location, keyof RequestParts, ValidateFunction | undefined][] = [
    ["path", "params", group("path")],
    ["query", "query", group("query")],
    ["header", "headers", group("header")],
  ];
  const body = operation.requestBody;
  const bodyCheck = body?.schema ? bodies.compile(rewriteRefs(body.schema)) : undefined;
  const responseChecks = new Map<string, ValidateFunction>();

  return {
    request(parts) {
      const problems: Problem[] = [];
      for (const [location, key, validate] of checks) {
        if (validate && !validate(parts[key]))
          problems.push(...toProblems(location, validate.errors));
      }
      if (parts.body === undefined) {
        if (body?.required) problems.push({ in: "body", path: "", message: "is required" });
      } else if (bodyCheck && !bodyCheck(parts.body)) {
        problems.push(...toProblems("body", bodyCheck.errors));
      }
      return problems;
    },
    response(status, payload) {
      const documented = responseFor(operation, status);
      if (!documented) {
        return [{ in: "response", path: "", message: `status ${status} isn't documented` }];
      }
      if (!documented.schema) {
        return payload === undefined || payload === null || payload === ""
          ? []
          : [{ in: "response", path: "", message: `status ${status} documents no JSON body` }];
      }
      const key = String(status);
      let validate = responseChecks.get(key);
      if (!validate) {
        validate = bodies.compile(rewriteRefs(documented.schema));
        responseChecks.set(key, validate);
      }
      return validate(payload) ? [] : toProblems("response", validate.errors);
    },
  };
}

function toProblems(location: Location, errors: ErrorObject[] | null | undefined): Problem[] {
  return (errors ?? []).map((error) => {
    // Point at the property itself: the missing one, or the one that isn't allowed.
    const property =
      error.keyword === "required"
        ? `/${error.params.missingProperty}`
        : error.keyword === "additionalProperties"
          ? `/${error.params.additionalProperty}`
          : "";
    const message =
      error.keyword === "additionalProperties" ? "isn't allowed" : (error.message ?? "is invalid");
    return { in: location, path: `${error.instancePath}${property}`, message };
  });
}

/** Points local refs at the registered document, so standalone schemas can use them. */
function rewriteRefs(value: unknown): Record<string, unknown> {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (typeof node !== "object" || node === null) return node;
    return Object.fromEntries(
      Object.entries(node).map(([key, child]) => [
        key,
        key === "$ref" && typeof child === "string" && child.startsWith("#/")
          ? `${DOCUMENT_ID}${child}`
          : walk(child),
      ]),
    );
  };
  return walk(value) as Record<string, unknown>;
}

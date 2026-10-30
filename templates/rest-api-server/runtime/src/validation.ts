import { crc32, inflateSync } from "node:zlib";
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
  response(status: number, body: unknown, headers?: Record<string, string>): Problem[];
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
    response(status, payload, rawHeaders = {}) {
      const documented = responseFor(operation, status);
      if (!documented) {
        return [{ in: "response", path: "", message: `status ${status} isn't documented` }];
      }
      const headers = Object.fromEntries(
        Object.entries(rawHeaders).map(([key, value]) => [key.toLowerCase(), value]),
      );
      const headerProblems: Problem[] = [];
      for (const [name, header] of Object.entries(documented.headers ?? {})) {
        const value = headers[name];
        if (value === undefined) {
          if (header.required)
            headerProblems.push({
              in: "response",
              path: `/headers/${name}`,
              message: "is required",
            });
        } else {
          const validate = bodies.compile(rewriteRefs(header.schema));
          if (!validate(value))
            headerProblems.push(
              ...toProblems("response", validate.errors).map((p) => ({
                ...p,
                path: `/headers/${name}${p.path}`,
              })),
            );
        }
      }
      if (headerProblems.length) return headerProblems;
      const contentTypes = Object.keys(documented.content ?? {});
      const mediaType = headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
      if (mediaType && contentTypes.length && !contentTypes.includes(mediaType))
        return [
          {
            in: "response",
            path: "/headers/content-type",
            message: `expected ${contentTypes.join(" or ")}`,
          },
        ];
      if (contentTypes.length && !documented.schema) {
        if (!mediaType || !contentTypes.includes(mediaType))
          return [
            {
              in: "response",
              path: "/headers/content-type",
              message: `expected ${contentTypes.join(" or ")}`,
            },
          ];
        if (mediaType !== "image/png")
          return [{ in: "response", path: "", message: `no verifier for ${mediaType}` }];
        return validPng(payload)
          ? []
          : [{ in: "response", path: "", message: "expected a nonempty, decodable PNG" }];
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

/** Verify PNG framing and compressed image data. QR decoding belongs to fixed application tests. */
function validPng(payload: unknown): boolean {
  if (!(payload instanceof Uint8Array)) return false;
  const bytes = Buffer.from(payload);
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  const data: Buffer[] = [];
  let header = false;
  let width = 0,
    height = 0,
    bits = 0,
    interlace = 0;
  for (let offset = 8; offset + 12 <= bytes.length; ) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return false;
    const kind = bytes.toString("ascii", offset + 4, offset + 8);
    if (
      crc32(bytes.subarray(offset + 4, offset + 8 + length)) !==
      bytes.readUInt32BE(offset + 8 + length)
    )
      return false;
    if (!header) {
      if (
        kind !== "IHDR" ||
        length !== 13 ||
        !bytes.readUInt32BE(offset + 8) ||
        !bytes.readUInt32BE(offset + 12)
      )
        return false;
      width = bytes.readUInt32BE(offset + 8);
      height = bytes.readUInt32BE(offset + 12);
      const depth = bytes[offset + 16] ?? 0,
        color = bytes[offset + 17] ?? -1;
      const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color];
      if (
        !channels ||
        ![1, 2, 4, 8, 16].includes(depth) ||
        (color === 3 && depth === 16) ||
        (color !== 0 && color !== 3 && depth < 8) ||
        bytes[offset + 18] !== 0 ||
        bytes[offset + 19] !== 0 ||
        ![0, 1].includes(bytes[offset + 20] ?? -1)
      )
        return false;
      bits = channels * depth;
      interlace = bytes[offset + 20] ?? 0;
      header = true;
    }
    if (kind === "IDAT") data.push(bytes.subarray(offset + 8, offset + 8 + length));
    if (kind === "IEND") {
      if (length || end !== bytes.length || !data.length) return false;
      try {
        const decoded = inflateSync(Buffer.concat(data), { maxOutputLength: 32 * 1024 * 1024 });
        const passes = interlace
          ? [
              [0, 0, 8, 8],
              [4, 0, 8, 8],
              [0, 4, 4, 8],
              [2, 0, 4, 4],
              [0, 2, 2, 4],
              [1, 0, 2, 2],
              [0, 1, 1, 2],
            ]
          : [[0, 0, 1, 1]];
        let position = 0;
        for (const [x = 0, y = 0, dx = 1, dy = 1] of passes) {
          const columns = Math.max(0, Math.ceil((width - x) / dx)),
            rows = Math.max(0, Math.ceil((height - y) / dy));
          if (!columns || !rows) continue;
          const stride = 1 + Math.ceil((columns * bits) / 8);
          if (position + rows * stride > decoded.length) return false;
          for (let row = 0; row < rows; row++) {
            if ((decoded[position] ?? 255) > 4) return false;
            position += stride;
          }
        }
        return position === decoded.length;
      } catch {
        return false;
      }
    }
    offset = end;
  }
  return false;
}

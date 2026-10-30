import { readFileSync } from "node:fs";
import { parse } from "yaml";

export const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "head", "options"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

type Json = Record<string, unknown>;

export interface Parameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required: boolean;
  schema: Json;
  example?: unknown;
}

export interface Operation {
  operationId: string;
  method: HttpMethod;
  /** The OpenAPI path, e.g. `/links/{code}`. */
  path: string;
  /** The same path in Fastify's syntax, e.g. `/links/:code`. */
  routePath: string;
  parameters: Parameter[];
  requestBody?: { required: boolean; schema?: Json; example?: unknown };
  /** By status code (`"200"`, `"4XX"`, `"default"`): the JSON body schema, if any. */
  responses: Record<
    string,
    {
      schema?: Json;
      content?: Json;
      headers?: Record<string, { required: boolean; schema: Json }>;
    }
  >;
  /** `x-jeeves-smoke` on the operation: opt in (or out) of contract smoke tests. */
  smoke?: boolean;
  /** OpenAPI security requirements; session-protected operations need a real session. */
  security?: unknown[];
}

export interface Contract {
  document: Json;
  operations: Operation[];
}

/** The contract file can't be served; lists every problem. */
export class ContractError extends Error {
  readonly problems: string[];

  constructor(source: string, problems: string[]) {
    super(`API contract ${source} is invalid:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "ContractError";
    this.problems = problems;
  }
}

export function loadContract(path: string): Contract {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new ContractError(path, ["the file can't be read"]);
  }
  return parseContract(text, path);
}

/** Parses an OpenAPI 3.1 document (YAML or JSON) and lists its operations. */
export function parseContract(text: string, source = "contract"): Contract {
  let document: unknown;
  try {
    document = parse(text);
  } catch (error) {
    throw new ContractError(source, [`not valid YAML: ${(error as Error).message}`]);
  }
  if (!isObject(document)) throw new ContractError(source, ["not an OpenAPI document"]);
  const problems: string[] = [];
  const version = String(document.openapi ?? "");
  if (!/^3\.1\.\d+$/.test(version)) {
    problems.push(`"openapi" must be 3.1.x (got "${version || "nothing"}")`);
  }
  const paths = document.paths ?? {};
  if (!isObject(paths)) problems.push(`"paths" must be an object`);

  const operations: Operation[] = [];
  const ids = new Set<string>();
  for (const [path, item] of Object.entries(isObject(paths) ? paths : {})) {
    if (!isObject(item)) continue;
    const pathItem = resolve(document, item);
    const shared = asArray(pathItem.parameters);
    for (const method of HTTP_METHODS) {
      const raw = pathItem[method];
      if (!isObject(raw)) continue;
      const where = `${method.toUpperCase()} ${path}`;
      const operationId = raw.operationId;
      if (typeof operationId !== "string" || operationId === "") {
        problems.push(`${where} has no operationId`);
        continue;
      }
      if (ids.has(operationId)) problems.push(`operationId "${operationId}" is used twice`);
      ids.add(operationId);
      operations.push({
        operationId,
        method,
        path,
        routePath: path.replace(/\{([^}]+)\}/g, ":$1"),
        parameters: parametersOf(document, [...shared, ...asArray(raw.parameters)]),
        ...requestBodyOf(document, raw.requestBody),
        responses: responsesOf(document, raw.responses),
        ...(typeof raw["x-jeeves-smoke"] === "boolean" && { smoke: raw["x-jeeves-smoke"] }),
        ...(() => {
          const security = asArray(raw.security ?? document.security);
          return security.length > 0 ? { security } : {};
        })(),
      });
    }
  }
  if (problems.length > 0) throw new ContractError(source, problems);
  return { document, operations };
}

/** Path-level and operation-level parameters, the latter winning (OpenAPI rules). */
function parametersOf(document: Json, raw: unknown[]): Parameter[] {
  const byKey = new Map<string, Parameter>();
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const p = resolve(document, entry);
    const location = p.in as Parameter["in"];
    const name = location === "header" ? String(p.name).toLowerCase() : String(p.name);
    byKey.set(`${location}:${name}`, {
      name,
      in: location,
      required: location === "path" || p.required === true,
      schema: isObject(p.schema) ? p.schema : {},
      ...(p.example !== undefined && { example: p.example }),
      ...(p.example === undefined && firstExample(p.examples)),
    });
  }
  return [...byKey.values()];
}

function requestBodyOf(document: Json, raw: unknown): Pick<Operation, "requestBody"> {
  if (!isObject(raw)) return {};
  const body = resolve(document, raw);
  const media = jsonMedia(body.content);
  return {
    requestBody: {
      required: body.required === true,
      ...(media && isObject(media.schema) && { schema: media.schema }),
      ...(media?.example !== undefined && { example: media.example }),
      ...(media?.example === undefined && firstExample(media?.examples)),
    },
  };
}

function responsesOf(document: Json, raw: unknown): Operation["responses"] {
  const responses: Operation["responses"] = {};
  for (const [status, value] of Object.entries(isObject(raw) ? raw : {})) {
    if (!isObject(value)) continue;
    const response = resolve(document, value);
    const media = jsonMedia(response.content);
    const headers = Object.fromEntries(
      Object.entries(isObject(response.headers) ? response.headers : {}).map(([name, raw]) => {
        const header = resolve(document, isObject(raw) ? raw : {});
        return [
          name.toLowerCase(),
          {
            required: header.required === true,
            schema: isObject(header.schema) ? header.schema : {},
          },
        ];
      }),
    );
    responses[status.toUpperCase()] = {
      ...(media && isObject(media.schema) && { schema: media.schema }),
      ...(isObject(response.content) && { content: response.content }),
      ...(Object.keys(headers).length && { headers }),
    };
  }
  return responses;
}

/** The `application/json` (or `+json`) media type object, if any. */
function jsonMedia(content: unknown): Json | undefined {
  if (!isObject(content)) return undefined;
  const key = Object.keys(content).find((k) => /^application\/(.+\+)?json$/.test(k));
  const media = key === undefined ? undefined : content[key];
  return isObject(media) ? media : undefined;
}

function firstExample(examples: unknown): { example?: unknown } {
  if (!isObject(examples)) return {};
  const first = Object.values(examples)[0];
  return isObject(first) && "value" in first ? { example: first.value } : {};
}

/** Follows local `$ref`s (`#/components/...`) on non-schema objects. */
function resolve(document: Json, value: Json, seen = new Set<string>()): Json {
  const ref = value.$ref;
  if (typeof ref !== "string") return value;
  if (!ref.startsWith("#/") || seen.has(ref)) {
    throw new ContractError("contract", [`can't resolve $ref "${ref}" (only local refs work)`]);
  }
  seen.add(ref);
  let target: unknown = document;
  for (const part of ref.slice(2).split("/")) {
    const key = part.replaceAll("~1", "/").replaceAll("~0", "~");
    target = isObject(target) ? target[key] : undefined;
  }
  if (!isObject(target)) throw new ContractError("contract", [`$ref "${ref}" points nowhere`]);
  return resolve(document, target, seen);
}

/** The documented response for a status: exact, then `2XX`-style, then `default`. */
export function responseFor(operation: Operation, status: number) {
  const r = operation.responses;
  return r[String(status)] ?? r[`${String(status)[0]}XX`] ?? r.DEFAULT;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

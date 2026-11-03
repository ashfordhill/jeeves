/** Finite HTTP declarations only. These mappings do not supply an HTTP/serializer runtime. */
import { z } from "zod";
import type { ContractShape } from "./architecture-contracts.ts";
import type { ContractField } from "./contract-shapes.ts";
import { resolveContractValue } from "./contract-type-resolution.ts";
import { idSchema } from "./ids.ts";

const wireName = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/);
const mediaType = z
  .string()
  .max(120)
  .regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/);
export const contractBinaryBodySchema = z.strictObject({
  kind: z.literal("binary"),
  contentType: mediaType,
  maxBytes: z.int().min(1).max(1_000_000_000),
});
export const contractJsonBodySchema = z.strictObject({
  kind: z.literal("json"),
  contentType: z
    .string()
    .max(120)
    .regex(/^application\/(?:json|[a-z0-9][a-z0-9!#$&^_.+-]*\+json)$/),
  fields: z.array(idSchema).max(40),
});
export const contractTransportBodySchema = z.discriminatedUnion("kind", [
  contractJsonBodySchema,
  contractBinaryBodySchema,
]);
export const contractTransportSchema = z.strictObject({
  protocol: z.literal("http"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
  path: z
    .string()
    .min(1)
    .max(500)
    .regex(/^\/(?:[A-Za-z0-9._~{}/-]*)$/),
  parameters: z
    .array(
      z.strictObject({ field: idSchema, in: z.enum(["path", "query", "header"]), name: wireName }),
    )
    .max(40),
  request: contractTransportBodySchema.optional(),
  responses: z
    .array(
      z.strictObject({
        /** Absent means operation.output; an outcome uses its payload or the shared output. */
        outcome: idSchema.optional(),
        outcomeAliases: z.array(idSchema).max(10).optional(),
        status: z.int().min(200).max(599),
        headers: z.array(z.strictObject({ field: idSchema, name: wireName })).max(40),
        body: contractTransportBodySchema.optional(),
      }),
    )
    .min(1)
    .max(31),
});
export type ContractTransport = z.output<typeof contractTransportSchema>;
export type ContractTransportBody = z.output<typeof contractTransportBodySchema>;
export type ContractTransportIssue = {
  code: "INVALID_TRANSPORT";
  path: (string | number)[];
  message: string;
};

export function inspectContractTransport(shape: ContractShape): {
  ok: boolean;
  issues: ContractTransportIssue[];
} {
  const issues: ContractTransportIssue[] = [];
  const routes = new Set<string>();
  for (const [index, operation] of shape.operations.entries()) {
    const transport = operation.transport;
    if (!transport) continue; // Omitted declarations preserve existing contracts and draft intent.
    const path = ["operations", index, "transport"];
    const issue = (message: string, at: (string | number)[] = []) =>
      issues.push({ code: "INVALID_TRANSPORT", path: [...path, ...at], message });
    const segments =
      transport.path === "/" ? [] : transport.path.slice(1).replace(/\/$/, "").split("/");
    if (
      segments.some(
        (s) =>
          !/^(?:[A-Za-z0-9._~-]+|\{[A-Za-z][A-Za-z0-9_]{0,63}\})$/.test(s) ||
          s === "." ||
          s === "..",
      )
    )
      issue(
        "Use an absolute route with literal segments or whole {parameter} segments, without dot/empty segments.",
        ["path"],
      );
    const placeholders = [...transport.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
    if (new Set(placeholders).size !== placeholders.length)
      issue("Route parameter names must be unique.", ["path"]);
    const route = `${transport.method} ${transport.path.replace(/\{[^}]+\}/g, "{}").replace(/\/$/, "") || "/"}`;
    if (routes.has(route))
      issue("Conflicting method/path mappings within this contract.", ["path"]);
    routes.add(route);
    if (["GET", "HEAD"].includes(transport.method) && transport.request)
      issue(`${transport.method} cannot declare a request body.`, ["request"]);

    const projection = (
      fields: ContractField[],
      mappings: { field: string; name?: string; in?: string }[],
      body: ContractTransportBody | undefined,
      at: (string | number)[],
    ) => {
      const used = new Set<string>();
      const names = new Set<string>();
      const select = (id: string, scalar: boolean) => {
        const field = fields.find((f) => f.id === id);
        if (!field) issue(`Mapped field ${id} does not exist in this payload.`, at);
        if (used.has(id)) issue(`Field ${id} is mapped more than once.`, at);
        used.add(id);
        if (field && scalar) {
          const result = resolveContractValue(field, shape.types);
          if (
            result.ok &&
            result.value &&
            (["object", "array", "map", "tagged-union"].includes(result.value.type) ||
              result.value.nullable)
          )
            issue(
              `Parameter/header ${id} must resolve to a nonnullable scalar; use JSON for structured values.`,
              at,
            );
        }
        return field;
      };
      for (const mapping of mappings) {
        const field = select(mapping.field, true);
        const location = mapping.in ?? "header";
        const name = location === "header" ? mapping.name?.toLowerCase() : mapping.name;
        const key = `${location}:${name}`;
        if (names.has(key)) issue(`Conflicting ${location} name ${mapping.name}.`, at);
        names.add(key);
        if (location === "header" && ["content-type", "content-length"].includes(name ?? "")) {
          // A frozen wire may repeat the exact body-owned Content-Type as a literal header.
          // It cannot select a different type or control length independently of the body.
          const literalBodyType =
            name === "content-type" &&
            body &&
            field?.required &&
            !field.nullable &&
            field.type === "text" &&
            field.enumValues?.length === 1 &&
            field.enumValues[0] === body.contentType;
          if (!literalBodyType)
            issue("Content-Type and Content-Length are controlled by the body descriptor.", at);
        }
        if (location === "path" && (!field?.required || !placeholders.includes(mapping.name)))
          issue(`Path parameter ${mapping.name} must be required and occur in the route.`, at);
      }
      if (body?.kind === "json") for (const id of body.fields) select(id, false);
      for (const field of fields)
        if (!used.has(field.id)) issue(`Field ${field.id} has no transport location.`, at);
    };
    projection(operation.input, transport.parameters, transport.request, ["parameters"]);
    for (const name of placeholders)
      if (!transport.parameters.some((p) => p.in === "path" && p.name === name))
        issue(`Route needs a required path parameter ${name}.`, ["parameters"]);
    const statuses = new Set<number>();
    const outcomes = new Set<string | undefined>();
    for (const [i, response] of transport.responses.entries()) {
      const at = ["responses", i];
      if (statuses.has(response.status))
        issue(`Conflicting response status ${response.status}.`, at);
      statuses.add(response.status);
      if (outcomes.has(response.outcome))
        issue("Each output/outcome has one declared response mapping.", at);
      outcomes.add(response.outcome);
      for (const alias of response.outcomeAliases ?? []) {
        if (outcomes.has(alias)) issue("Outcome alias has more than one response mapping.", at);
        outcomes.add(alias);
        const alternate = operation.outcomes?.find((o) => o.id === alias);
        const primary = operation.outcomes?.find((o) => o.id === response.outcome);
        if (
          !alternate ||
          alternate.status !== response.status ||
          alternate.noResponse ||
          alternate.kind !== primary?.kind ||
          JSON.stringify(alternate.payload) !== JSON.stringify(primary?.payload)
        )
          issue("Outcome aliases require the same exact kind, payload and status.", at);
      }
      const outcome = operation.outcomes?.find((o) => o.id === response.outcome);
      if (response.outcome && !outcome) issue(`Outcome ${response.outcome} does not exist.`, at);
      if (outcome?.status !== undefined && outcome.status !== response.status)
        issue(`Response status must match outcome ${outcome.id}'s declared status.`, at);
      if (outcome && (outcome.kind === "Success" ? response.status >= 400 : response.status < 400))
        issue("Success outcomes use 2xx/3xx; rejection/failure outcomes use 4xx/5xx.", at);
      if (
        response.body &&
        (transport.method === "HEAD" || [204, 205, 304].includes(response.status))
      )
        issue("HEAD and bodyless statuses cannot declare response bytes or JSON.", at);
      projection(outcome?.payload ?? operation.output, response.headers, response.body, at);
    }
    for (const outcome of operation.outcomes ?? [])
      if (outcome.internal) {
        if (
          outcome.status !== undefined ||
          outcome.noResponse ||
          outcome.payload?.length ||
          outcome.kind !== "Success" ||
          outcome.state !== "Committed"
        )
          issue(
            "Internal checkpoints describe payload-free committed boundaries without HTTP status.",
            ["responses"],
          );
      } else if (
        outcome.noResponse &&
        (outcome.kind !== "Failure" ||
          outcome.state !== "Unknown" ||
          outcome.status !== undefined ||
          outcome.payload?.length ||
          outcome.retry !== "Reconcile first")
      )
        issue("No-response outcomes require a payload-free Unknown failure with reconciliation.", [
          "responses",
        ]);
      else if (!outcome.noResponse && !outcomes.has(outcome.id))
        issue(`Outcome ${outcome.id} needs a response mapping.`, ["responses"]);
  }
  return { ok: issues.length === 0, issues };
}

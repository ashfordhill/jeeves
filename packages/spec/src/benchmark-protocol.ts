/** Independent acceptance wire contracts. These schemas do not implement an application. */
import { z } from "zod";
import { sessionCredentialsSchema, sessionIdentitySchema } from "./resources.ts";

export const BENCHMARK_PROTOCOL_VERSION = "v1" as const;
export const BENCHMARK_REPLAY_SECONDS = 604800;
export const benchmarkTokenSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
export const benchmarkCorrelationIdSchema = benchmarkTokenSchema;
export const benchmarkIdempotencyKeySchema = benchmarkTokenSchema;
export const benchmarkMutationProtectionSchema = z.object({
  origin: z.url().refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && url.origin === value;
  }, "Use the exact configured HTTP origin"),
  "x-csrf-token": z.string().regex(/^[a-f0-9]{64}$/),
});
/** The existing session boundary owns credentials/identity; benchmark adapters reuse it. */
export const benchmarkCredentialsSchema = sessionCredentialsSchema;
export const benchmarkSessionIdentitySchema = sessionIdentitySchema;
export function benchmarkSessionSecurityScheme(cookieName: string) {
  z.string()
    .regex(/^jeeves_session_[a-f0-9]{32}$/)
    .parse(cookieName);
  return { type: "apiKey", in: "cookie", name: cookieName } as const;
}
export const benchmarkExpectedVersionSchema = z.int().min(1).max(Number.MAX_SAFE_INTEGER);
/** Lexical bound only. The application must also validate cursor integrity and query/scope binding. */
export const benchmarkCursorSchema = z
  .string()
  .min(1)
  .max(2048)
  .regex(/^[A-Za-z0-9_-]+$/);
export const benchmarkPageQuerySchema = z.strictObject({
  limit: z.int().min(1).max(100).optional(),
  cursor: benchmarkCursorSchema.optional(),
});
export function benchmarkPageSchema<T extends z.ZodType>(item: T) {
  return z.strictObject({
    items: z.array(item).max(100),
    nextCursor: benchmarkCursorSchema.nullable(),
  });
}
export const benchmarkErrorSchema = z.strictObject({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
  message: z.string().min(1).max(300),
  correlationId: benchmarkCorrelationIdSchema,
  fieldErrors: z
    .array(
      z.strictObject({
        field: z.string().min(1).max(160),
        message: z.string().min(1).max(160),
      }),
    )
    .min(1)
    .max(20)
    .optional(),
});
export const benchmarkErrorStatuses = [400, 401, 403, 404, 409, 422, 503] as const;
export const benchmarkErrorCodes = {
  INVALID_INPUT: 400,
  INVALID_CURSOR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  COMMAND_IN_PROGRESS: 409,
  DOMAIN_REJECTED: 422,
  HOOK_UNAVAILABLE: 503,
  DEPENDENCY_UNAVAILABLE: 503,
} as const;
export const benchmarkHeadersSchema = z.record(
  z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
  z
    .string()
    .max(4096)
    .regex(/^[^\r\n]*$/),
);
export const benchmarkResponseHeadersSchema = benchmarkHeadersSchema.and(
  z.object({
    "cache-control": z.literal("no-store"),
    "x-correlation-id": benchmarkCorrelationIdSchema,
  }),
);
export const benchmarkCommandIdentitySchema = z.strictObject({
  profile: z.enum(["discourse-core", "vendure-core", "zammad-core", "protocol-synthetic"]),
  version: z.string().regex(/^v[1-9]\d*$/),
  operationId: z.string().regex(/^[A-Za-z][A-Za-z0-9._-]{0,127}$/),
  scopeId: z.uuid(),
  principalId: z.uuid(),
  key: benchmarkIdempotencyKeySchema,
});

/** OpenAPI components from the independent protocol schemas, never runtime descriptors. */
export function benchmarkProtocolComponents() {
  const schema = (value: z.ZodType) => {
    const { $schema: _, ...result } = z.toJSONSchema(value);
    return result;
  };
  return {
    schemas: {
      Error: schema(benchmarkErrorSchema),
      PageQuery: schema(benchmarkPageQuerySchema),
      Cursor: schema(benchmarkCursorSchema),
      ExpectedVersion: schema(benchmarkExpectedVersionSchema),
      IdempotencyKey: schema(benchmarkIdempotencyKeySchema),
      CorrelationId: schema(benchmarkCorrelationIdSchema),
      Credentials: schema(benchmarkCredentialsSchema),
      SessionIdentity: schema(benchmarkSessionIdentitySchema),
    },
    parameters: {
      IdempotencyKey: {
        name: "Idempotency-Key",
        in: "header",
        required: true,
        schema: schema(benchmarkIdempotencyKeySchema),
      },
      CsrfToken: {
        name: "X-CSRF-Token",
        in: "header",
        required: true,
        schema: { type: "string", pattern: "^[a-f0-9]{64}$" },
      },
      Origin: {
        name: "Origin",
        in: "header",
        required: true,
        schema: { type: "string", format: "uri" },
      },
      Limit: {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
      },
      Cursor: {
        name: "cursor",
        in: "query",
        required: false,
        schema: schema(benchmarkCursorSchema),
      },
    },
    headers: {
      CorrelationId: { schema: schema(benchmarkCorrelationIdSchema) },
      CacheControl: { schema: { type: "string", const: "no-store" } },
    },
  };
}

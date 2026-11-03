/** Authored projection of frozen P61b REST payloads; no OpenAPI interpreter or runtime. */
import type {
  ArchitectureContract,
  ContractField,
  ContractTransport,
  OperationOutcome,
} from "./architecture-contracts.ts";

const idField: ContractField = {
  id: "id",
  name: "id",
  required: true,
  description: "",
  type: "uuid",
};

const atField: ContractField = {
  id: "at",
  name: "at",
  required: true,
  description: "",
  type: "timestamp",
};

const postIdField: ContractField = {
  id: "post-id",
  name: "postId",
  required: true,
  description: "",
  type: "uuid",
};

const scopeIdField: ContractField = {
  id: "scope-id",
  name: "scopeId",
  required: true,
  description: "",
  type: "uuid",
};

const groupIdField: ContractField = {
  id: "group-id",
  name: "groupId",
  required: true,
  description: "",
  type: "uuid",
};

const topicIdField: ContractField = {
  id: "topic-id",
  name: "topicId",
  required: true,
  description: "",
  type: "uuid",
};

const ownerIdField: ContractField = {
  id: "owner-id",
  name: "ownerId",
  required: true,
  description: "",
  type: "uuid",
};

const authorIdField: ContractField = {
  id: "author-id",
  name: "authorId",
  required: true,
  description: "",
  type: "uuid",
};

const targetIdField: ContractField = {
  id: "target-id",
  name: "targetId",
  required: true,
  description: "",
  type: "uuid",
};

const categoryIdField: ContractField = {
  id: "category-id",
  name: "categoryId",
  required: true,
  description: "",
  type: "uuid",
};

const reporterIdField: ContractField = {
  id: "reporter-id",
  name: "reporterId",
  required: true,
  description: "",
  type: "uuid",
};

const principalIdField: ContractField = {
  id: "principal-id",
  name: "principalId",
  required: true,
  description: "",
  type: "uuid",
};

const windowEndField: ContractField = {
  id: "window-end",
  name: "windowEnd",
  required: true,
  description: "",
  type: "timestamp",
};

const attachmentIdField: ContractField = {
  id: "attachment-id",
  name: "attachmentId",
  required: true,
  description: "",
  type: "uuid",
};

const sourceTopicIdField: ContractField = {
  id: "source-topic-id",
  name: "sourceTopicId",
  required: true,
  description: "",
  type: "uuid",
};

const targetTopicIdField: ContractField = {
  id: "target-topic-id",
  name: "targetTopicId",
  required: true,
  description: "",
  type: "uuid",
};

const windowStartField: ContractField = {
  id: "window-start",
  name: "windowStart",
  required: true,
  description: "",
  type: "timestamp",
};

const codeField: ContractField = {
  id: "code",
  name: "code",
  required: true,
  description: "",
  type: "text",
  textConstraint: "error-code",
};

const sha256Field: ContractField = {
  id: "sha256",
  name: "sha256",
  required: true,
  description: "",
  type: "text",
  textConstraint: "sha256",
};

const modeField: ContractField = {
  id: "mode",
  name: "mode",
  required: true,
  description: "",
  type: "text",
  enumValues: ["watch", "mute"],
};

const kindField: ContractField = {
  id: "kind",
  name: "kind",
  required: true,
  description: "",
  type: "text",
  enumValues: ["export", "erase"],
};

const fieldField: ContractField = {
  id: "field",
  name: "field",
  required: true,
  description: "",
  type: "text",
  minLength: 1,
  maxLength: 160,
};

const titleField: ContractField = {
  id: "title",
  name: "title",
  required: true,
  description: "",
  type: "text",
  minLength: 1,
  maxLength: 200,
};

const textField: ContractField = {
  id: "text",
  name: "text",
  required: true,
  description: "",
  type: "text",
  minLength: 1,
  maxLength: 20000,
};

const limitField: ContractField = {
  id: "limit",
  name: "limit",
  required: false,
  description: "",
  type: "integer",
  minimum: 1,
  maximum: 100,
};

const accessField: ContractField = {
  id: "access",
  name: "access",
  required: true,
  description: "",
  type: "text",
  enumValues: ["read", "write"],
};

const sizeField: ContractField = {
  id: "size",
  name: "size",
  required: true,
  description: "",
  type: "integer",
  minimum: 1,
  maximum: 10485760,
};

const csrfTokenField: ContractField = {
  id: "csrf-token",
  name: "csrfToken",
  required: true,
  description: "",
  type: "text",
  textConstraint: "sha256",
};

const stateField: ContractField = {
  id: "state",
  name: "state",
  required: true,
  description: "",
  type: "text",
  enumValues: ["active", "revoked"],
};

const roleField: ContractField = {
  id: "role",
  name: "role",
  required: true,
  description: "",
  type: "text",
  enumValues: ["member", "moderator"],
};

const headerSetCookieField: ContractField = {
  id: "header-set-cookie",
  name: "headerSetCookie",
  required: true,
  description: "",
  type: "text",
  minLength: 1,
};

const messageField: ContractField = {
  id: "message",
  name: "message",
  required: true,
  description: "",
  type: "text",
  minLength: 1,
  maxLength: 300,
};

const messageField2: ContractField = {
  id: "message",
  name: "message",
  required: true,
  description: "",
  type: "text",
  minLength: 1,
  maxLength: 160,
};

const headerOriginField: ContractField = {
  id: "header-origin",
  name: "headerOrigin",
  required: true,
  description: "",
  type: "text",
  textConstraint: "uri",
};

const passwordField: ContractField = {
  id: "password",
  name: "password",
  required: true,
  description: "",
  type: "text",
  minLength: 12,
  maxLength: 128,
};

const mimeField: ContractField = {
  id: "mime",
  name: "mime",
  required: true,
  description: "",
  type: "text",
  enumValues: ["text/plain", "image/png"],
};

const messageIdField: ContractField = {
  id: "message-id",
  name: "messageId",
  required: true,
  description: "",
  type: "text",
  minLength: 1,
  maxLength: 200,
};

const formatVersionField: ContractField = {
  id: "format-version",
  name: "formatVersion",
  required: true,
  description: "",
  type: "text",
  enumValues: ["safe-v1"],
};

const emailField: ContractField = {
  id: "email",
  name: "email",
  required: true,
  description: "",
  type: "text",
  textConstraint: "email",
  maxLength: 254,
};

const policyVersionField: ContractField = {
  id: "policy-version",
  name: "policyVersion",
  required: true,
  description: "",
  type: "text",
  enumValues: ["trust-v1"],
};

const headerRetryAfterField: ContractField = {
  id: "header-retry-after",
  name: "headerRetryAfter",
  required: false,
  description: "",
  type: "text",
  enumValues: ["1"],
};

const stateField2: ContractField = {
  id: "state",
  name: "state",
  required: true,
  description: "",
  type: "text",
  enumValues: ["open", "closed", "archived"],
};

const stateField3: ContractField = {
  id: "state",
  name: "state",
  required: true,
  description: "",
  type: "text",
  enumValues: ["visible", "hidden", "removed"],
};

const versionField: ContractField = {
  id: "version",
  name: "version",
  required: true,
  description: "",
  type: "integer",
  minimum: 1,
  maximum: 9007199254740991,
};

const stateField4: ContractField = {
  id: "state",
  name: "state",
  required: true,
  description: "",
  type: "text",
  enumValues: ["pending", "dismissed", "upheld"],
};

const algorithmVersionField: ContractField = {
  id: "algorithm-version",
  name: "algorithmVersion",
  required: true,
  description: "",
  type: "text",
  enumValues: ["rank-v1"],
};

const textField2: ContractField = {
  id: "text",
  name: "text",
  required: true,
  description: "",
  type: "text",
  minLength: 1,
  maxLength: 20000,
  nullable: true,
};

const topicIdsField: ContractField = {
  id: "topic-ids",
  name: "topicIds",
  required: true,
  description: "",
  type: "array",
  items: {
    type: "uuid",
  },
  maxItems: 100,
};

const correlationIdField: ContractField = {
  id: "correlation-id",
  name: "correlationId",
  required: true,
  description: "",
  type: "text",
  textConstraint: "correlation-id",
};

const headerXCsrfTokenField: ContractField = {
  id: "header-x-csrf-token",
  name: "headerXCsrfToken",
  required: true,
  description: "",
  type: "text",
  textConstraint: "sha256",
};

const headerCacheControlField: ContractField = {
  id: "header-cache-control",
  name: "headerCacheControl",
  required: true,
  description: "",
  type: "text",
  enumValues: ["no-store"],
};

const expectedVersionField: ContractField = {
  id: "expected-version",
  name: "expectedVersion",
  required: true,
  description: "",
  type: "integer",
  minimum: 1,
  maximum: 9007199254740991,
};

const headerIdempotencyKeyField: ContractField = {
  id: "header-idempotency-key",
  name: "headerIdempotencyKey",
  required: true,
  description: "",
  type: "text",
  textConstraint: "correlation-id",
};

const headerXCorrelationIdField: ContractField = {
  id: "header-x-correlation-id",
  name: "headerXCorrelationId",
  required: true,
  description: "",
  type: "text",
  textConstraint: "correlation-id",
};

const cursorField: ContractField = {
  id: "cursor",
  name: "cursor",
  required: false,
  description: "",
  type: "text",
  textConstraint: "base64url",
  minLength: 1,
  maxLength: 2048,
};

const stateField5: ContractField = {
  id: "state",
  name: "state",
  required: true,
  description: "",
  type: "text",
  enumValues: ["staged", "validated", "attached", "orphan", "deleted"],
};

const deliveryField: ContractField = {
  id: "delivery",
  name: "delivery",
  required: true,
  description: "",
  type: "text",
  enumValues: ["queued", "delivered", "uncertain", "suppressed"],
};

const channelsField: ContractField = {
  id: "channels",
  name: "channels",
  required: true,
  description: "",
  type: "array",
  items: {
    type: "text",
    enumValues: ["inbox", "email"],
  },
  maxItems: 2,
};

const nextCursorField: ContractField = {
  id: "next-cursor",
  name: "nextCursor",
  required: true,
  description: "",
  type: "text",
  textConstraint: "base64url",
  minLength: 1,
  maxLength: 2048,
  nullable: true,
};

const fieldErrorsField: ContractField = {
  id: "field-errors",
  name: "fieldErrors",
  required: false,
  description: "",
  type: "array",
  items: {
    type: "ref",
    ref: {
      id: "field-error",
      version: "v1",
    },
  },
  minItems: 1,
  maxItems: 20,
};

const response200: ContractTransport["responses"][number] = {
  status: 200,
  headers: [
    {
      field: "header-cache-control",
      name: "Cache-Control",
    },
    {
      field: "header-x-correlation-id",
      name: "X-Correlation-Id",
    },
  ],
  body: {
    kind: "json",
    contentType: "application/json",
    fields: ["items", "next-cursor"],
  },
};

const response2002: ContractTransport["responses"][number] = {
  status: 200,
  headers: [
    {
      field: "header-cache-control",
      name: "Cache-Control",
    },
    {
      field: "header-x-correlation-id",
      name: "X-Correlation-Id",
    },
  ],
  body: {
    kind: "json",
    contentType: "application/json",
    fields: ["id", "category-id", "title", "state", "version"],
  },
};

const response2003: ContractTransport["responses"][number] = {
  status: 200,
  headers: [
    {
      field: "header-cache-control",
      name: "Cache-Control",
    },
    {
      field: "header-x-correlation-id",
      name: "X-Correlation-Id",
    },
  ],
  body: {
    kind: "json",
    contentType: "application/json",
    fields: ["id", "topic-id", "author-id", "text", "state", "version"],
  },
};

const response2004: ContractTransport["responses"][number] = {
  status: 200,
  headers: [
    {
      field: "header-cache-control",
      name: "Cache-Control",
    },
    {
      field: "header-x-correlation-id",
      name: "X-Correlation-Id",
    },
  ],
  body: {
    kind: "json",
    contentType: "application/json",
    fields: ["id", "owner-id", "state", "mime", "size", "sha256", "version"],
  },
};

const response400: ContractTransport["responses"][number] = {
  status: 400,
  headers: [
    {
      field: "header-cache-control",
      name: "Cache-Control",
    },
    {
      field: "header-x-correlation-id",
      name: "X-Correlation-Id",
    },
  ],
  body: {
    kind: "json",
    contentType: "application/json",
    fields: ["code", "message", "correlation-id", "field-errors"],
  },
  outcome: "status-400",
};

const response403: ContractTransport["responses"][number] = {
  status: 403,
  headers: [
    {
      field: "header-cache-control",
      name: "Cache-Control",
    },
    {
      field: "header-x-correlation-id",
      name: "X-Correlation-Id",
    },
  ],
  body: {
    kind: "json",
    contentType: "application/json",
    fields: ["code", "message", "correlation-id", "field-errors"],
  },
  outcome: "status-403",
};

const response409: ContractTransport["responses"][number] = {
  status: 409,
  headers: [
    {
      field: "header-cache-control",
      name: "Cache-Control",
    },
    {
      field: "header-x-correlation-id",
      name: "X-Correlation-Id",
    },
  ],
  body: {
    kind: "json",
    contentType: "application/json",
    fields: ["code", "message", "correlation-id", "field-errors"],
  },
  outcome: "status-409",
};

const response503: ContractTransport["responses"][number] = {
  status: 503,
  headers: [
    {
      field: "header-cache-control",
      name: "Cache-Control",
    },
    {
      field: "header-x-correlation-id",
      name: "X-Correlation-Id",
    },
  ],
  body: {
    kind: "json",
    contentType: "application/json",
    fields: ["code", "message", "correlation-id", "field-errors"],
  },
  outcome: "status-503",
};

const response401: ContractTransport["responses"][number] = {
  status: 401,
  headers: [
    {
      field: "header-cache-control",
      name: "Cache-Control",
    },
    {
      field: "header-x-correlation-id",
      name: "X-Correlation-Id",
    },
  ],
  body: {
    kind: "json",
    contentType: "application/json",
    fields: ["code", "message", "correlation-id", "field-errors"],
  },
  outcome: "status-401",
};

const response404: ContractTransport["responses"][number] = {
  status: 404,
  headers: [
    {
      field: "header-cache-control",
      name: "Cache-Control",
    },
    {
      field: "header-x-correlation-id",
      name: "X-Correlation-Id",
    },
  ],
  body: {
    kind: "json",
    contentType: "application/json",
    fields: ["code", "message", "correlation-id", "field-errors"],
  },
  outcome: "status-404",
};

const response422: ContractTransport["responses"][number] = {
  status: 422,
  headers: [
    {
      field: "header-cache-control",
      name: "Cache-Control",
    },
    {
      field: "header-x-correlation-id",
      name: "X-Correlation-Id",
    },
  ],
  body: {
    kind: "json",
    contentType: "application/json",
    fields: ["code", "message", "correlation-id", "field-errors"],
  },
  outcome: "status-422",
};

const response4092: ContractTransport["responses"][number] = {
  status: 409,
  headers: [
    {
      field: "header-cache-control",
      name: "Cache-Control",
    },
    {
      field: "header-x-correlation-id",
      name: "X-Correlation-Id",
    },
    {
      field: "header-retry-after",
      name: "Retry-After",
    },
  ],
  body: {
    kind: "json",
    contentType: "application/json",
    fields: ["code", "message", "correlation-id", "field-errors"],
  },
  outcome: "status-409",
};

const status503Outcome: OperationOutcome = {
  id: "status-503",
  name: "Shared safe error; see protocol v1",
  kind: "Failure",
  status: 503,
  condition: "Shared safe error; see protocol v1",
  state: "Unknown",
  retry: "Reconcile first",
  payload: [
    headerCacheControlField,
    headerXCorrelationIdField,
    codeField,
    messageField,
    correlationIdField,
    fieldErrorsField,
  ],
};

const status409Outcome: OperationOutcome = {
  id: "status-409",
  name: "Shared safe error; see protocol v1",
  kind: "Rejection",
  status: 409,
  condition: "Shared safe error; see protocol v1",
  state: "Unknown",
  retry: "Reconcile first",
  payload: [
    headerCacheControlField,
    headerXCorrelationIdField,
    codeField,
    messageField,
    correlationIdField,
    fieldErrorsField,
  ],
};

const status400Outcome: OperationOutcome = {
  id: "status-400",
  name: "Shared safe error; see protocol v1",
  kind: "Rejection",
  status: 400,
  condition: "Shared safe error; see protocol v1",
  state: "Unchanged",
  retry: "After correction",
  payload: [
    headerCacheControlField,
    headerXCorrelationIdField,
    codeField,
    messageField,
    correlationIdField,
    fieldErrorsField,
  ],
};

const status403Outcome: OperationOutcome = {
  id: "status-403",
  name: "Shared safe error; see protocol v1",
  kind: "Rejection",
  status: 403,
  condition: "Shared safe error; see protocol v1",
  state: "Unchanged",
  retry: "After correction",
  payload: [
    headerCacheControlField,
    headerXCorrelationIdField,
    codeField,
    messageField,
    correlationIdField,
    fieldErrorsField,
  ],
};

const status401Outcome: OperationOutcome = {
  id: "status-401",
  name: "Shared safe error; see protocol v1",
  kind: "Rejection",
  status: 401,
  condition: "Shared safe error; see protocol v1",
  state: "Unchanged",
  retry: "After correction",
  payload: [
    headerCacheControlField,
    headerXCorrelationIdField,
    codeField,
    messageField,
    correlationIdField,
    fieldErrorsField,
  ],
};

const status404Outcome: OperationOutcome = {
  id: "status-404",
  name: "Shared safe error; see protocol v1",
  kind: "Rejection",
  status: 404,
  condition: "Shared safe error; see protocol v1",
  state: "Unchanged",
  retry: "After correction",
  payload: [
    headerCacheControlField,
    headerXCorrelationIdField,
    codeField,
    messageField,
    correlationIdField,
    fieldErrorsField,
  ],
};

const status422Outcome: OperationOutcome = {
  id: "status-422",
  name: "Shared safe error; see protocol v1",
  kind: "Rejection",
  status: 422,
  condition: "Shared safe error; see protocol v1",
  state: "Unchanged",
  retry: "After correction",
  payload: [
    headerCacheControlField,
    headerXCorrelationIdField,
    codeField,
    messageField,
    correlationIdField,
    fieldErrorsField,
  ],
};

const status409Outcome2: OperationOutcome = {
  id: "status-409",
  name: "Shared safe error; see protocol v1",
  kind: "Rejection",
  status: 409,
  condition: "Shared safe error; see protocol v1",
  state: "Unknown",
  retry: "Reconcile first",
  payload: [
    headerCacheControlField,
    headerXCorrelationIdField,
    headerRetryAfterField,
    codeField,
    messageField,
    correlationIdField,
    fieldErrorsField,
  ],
};

export const discourseCoreContracts = [
  {
    id: "dc-sessions-api",
    version: "v1",
    name: "Sessions REST contract",
    kind: "api",
    coverage: "Partial",
    description:
      "Frozen Discourse-core v1 REST adaptation. Transport and payloads are explicit; P71b owns executable command/effect bindings. No runtime is supplied.",
    shape: {
      payload: [],
      operations: [
        {
          id: "register",
          name: "register",
          description: "Public; exact configured Origin; no role or membership bootstrap.",
          input: [headerOriginField, emailField, passwordField],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            headerSetCookieField,
            idField,
            csrfTokenField,
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/accounts",
            parameters: [
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
            ],
            responses: [
              {
                status: 201,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                  {
                    field: "header-set-cookie",
                    name: "set-cookie",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: ["id", "csrf-token"],
                },
              },
              response400,
              response403,
              response409,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["email", "password"],
            },
          },
          outcomes: [status400Outcome, status403Outcome, status409Outcome, status503Outcome],
        },
        {
          id: "login",
          name: "login",
          description: "Public; exact configured Origin; verified credentials; no scope grants.",
          input: [headerOriginField, emailField, passwordField],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            headerSetCookieField,
            idField,
            csrfTokenField,
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/session",
            parameters: [
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
            ],
            responses: [
              {
                status: 200,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                  {
                    field: "header-set-cookie",
                    name: "set-cookie",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: ["id", "csrf-token"],
                },
              },
              response400,
              response401,
              response403,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["email", "password"],
            },
          },
          outcomes: [status400Outcome, status401Outcome, status403Outcome, status503Outcome],
        },
        {
          id: "get-session",
          name: "getSession",
          description: "Current durable session; application cookie only.",
          input: [],
          output: [headerCacheControlField, headerXCorrelationIdField, idField, csrfTokenField],
          transport: {
            protocol: "http",
            method: "GET",
            path: "/api/session",
            parameters: [],
            responses: [
              {
                status: 200,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: ["id", "csrf-token"],
                },
              },
              response401,
            ],
          },
          outcomes: [status401Outcome],
        },
        {
          id: "logout",
          name: "logout",
          description: "Current session, exact Origin and CSRF; invalidate persistent session.",
          input: [headerIdempotencyKeyField, headerOriginField, headerXCsrfTokenField],
          output: [headerCacheControlField, headerXCorrelationIdField, headerSetCookieField],
          transport: {
            protocol: "http",
            method: "DELETE",
            path: "/api/session",
            parameters: [
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              {
                status: 204,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                  {
                    field: "header-set-cookie",
                    name: "set-cookie",
                  },
                ],
              },
              response400,
              response401,
              response403,
              response4092,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: [],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status409Outcome2,
            status503Outcome,
          ],
        },
      ],
      types: [
        {
          id: "field-error",
          version: "v1",
          name: "Field validation error",
          description: "",
          value: {
            type: "object",
            fields: [fieldField, messageField2],
          },
        },
      ],
    },
  },
  {
    id: "dc-access-api",
    version: "v1",
    name: "Access REST contract",
    kind: "api",
    coverage: "Partial",
    description:
      "Frozen Discourse-core v1 REST adaptation. Transport and payloads are explicit; P71b owns executable command/effect bindings. No runtime is supplied.",
    shape: {
      payload: [],
      operations: [
        {
          id: "put-membership",
          name: "putMembership",
          description:
            "Current workspace administrator; same-scope group/principal; no self escalation.",
          input: [
            scopeIdField,
            groupIdField,
            principalIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            stateField,
            roleField,
            expectedVersionField,
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            principalIdField,
            groupIdField,
            stateField,
            roleField,
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "PUT",
            path: "/api/scopes/{scopeId}/groups/{groupId}/members/{principalId}",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "group-id",
                name: "groupId",
                in: "path",
              },
              {
                field: "principal-id",
                name: "principalId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              {
                status: 200,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: ["principal-id", "group-id", "state", "role", "version"],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["state", "role", "expected-version"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
        {
          id: "put-grant",
          name: "putGrant",
          description: "Current workspace administrator; same-scope category/group.",
          input: [
            scopeIdField,
            categoryIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            groupIdField,
            accessField,
            expectedVersionField,
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            categoryIdField,
            groupIdField,
            accessField,
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "PUT",
            path: "/api/scopes/{scopeId}/categories/{categoryId}/grants",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "category-id",
                name: "categoryId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              {
                status: 200,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: ["category-id", "group-id", "access", "version"],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["group-id", "access", "expected-version"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
      ],
      types: [
        {
          id: "field-error",
          version: "v1",
          name: "Field validation error",
          description: "",
          value: {
            type: "object",
            fields: [fieldField, messageField2],
          },
        },
      ],
    },
  },
  {
    id: "dc-content-api",
    version: "v1",
    name: "Content REST contract",
    kind: "api",
    coverage: "Partial",
    description:
      "Frozen Discourse-core v1 REST adaptation. Transport and payloads are explicit; P71b owns executable command/effect bindings. No runtime is supplied.",
    shape: {
      payload: [],
      operations: [
        {
          id: "create-topic",
          name: "createTopic",
          description:
            "Current workspace member with category write grant; private/foreign category 404.",
          input: [
            scopeIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            categoryIdField,
            titleField,
            textField,
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            {
              id: "topic",
              name: "topic",
              required: true,
              description: "",
              type: "object",
              fields: [idField, categoryIdField, titleField, stateField2, versionField],
            },
            {
              id: "post",
              name: "post",
              required: true,
              description: "",
              type: "object",
              fields: [idField, topicIdField, authorIdField, textField2, stateField3, versionField],
            },
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/scopes/{scopeId}/topics",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              {
                status: 201,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: ["topic", "post"],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["category-id", "title", "text"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
        {
          id: "list-topics",
          name: "listTopics",
          description: "Current workspace member; category access before keyset/limit.",
          input: [scopeIdField, limitField, cursorField],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            {
              id: "items",
              name: "items",
              required: true,
              description: "",
              type: "array",
              items: {
                type: "object",
                fields: [idField, categoryIdField, titleField, stateField2, versionField],
              },
              maxItems: 100,
            },
            nextCursorField,
          ],
          transport: {
            protocol: "http",
            method: "GET",
            path: "/api/scopes/{scopeId}/topics",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "limit",
                name: "limit",
                in: "query",
              },
              {
                field: "cursor",
                name: "cursor",
                in: "query",
              },
            ],
            responses: [
              response200,
              response400,
              response401,
              response403,
              response404,
              response503,
            ],
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status503Outcome,
          ],
        },
        {
          id: "get-topic",
          name: "getTopic",
          description: "Current workspace and category read grant; inaccessible/absent 404.",
          input: [scopeIdField, topicIdField],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            idField,
            categoryIdField,
            titleField,
            stateField2,
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "GET",
            path: "/api/scopes/{scopeId}/topics/{topicId}",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "topic-id",
                name: "topicId",
                in: "path",
              },
            ],
            responses: [
              response2002,
              response400,
              response401,
              response403,
              response404,
              response503,
            ],
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status503Outcome,
          ],
        },
        {
          id: "reply",
          name: "reply",
          description: "Current category write grant; open topic; server-established author.",
          input: [
            scopeIdField,
            topicIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            textField,
            expectedVersionField,
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            idField,
            topicIdField,
            authorIdField,
            textField2,
            stateField3,
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/scopes/{scopeId}/topics/{topicId}/posts",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "topic-id",
                name: "topicId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              {
                status: 201,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: ["id", "topic-id", "author-id", "text", "state", "version"],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["text", "expected-version"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
        {
          id: "list-posts",
          name: "listPosts",
          description: "Current category read grant; ordinary hidden/removed text redacted.",
          input: [scopeIdField, topicIdField, limitField, cursorField],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            {
              id: "items",
              name: "items",
              required: true,
              description: "",
              type: "array",
              items: {
                type: "object",
                fields: [
                  idField,
                  topicIdField,
                  authorIdField,
                  textField2,
                  stateField3,
                  versionField,
                ],
              },
              maxItems: 100,
            },
            nextCursorField,
          ],
          transport: {
            protocol: "http",
            method: "GET",
            path: "/api/scopes/{scopeId}/topics/{topicId}/posts",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "topic-id",
                name: "topicId",
                in: "path",
              },
              {
                field: "limit",
                name: "limit",
                in: "query",
              },
              {
                field: "cursor",
                name: "cursor",
                in: "query",
              },
            ],
            responses: [
              response200,
              response400,
              response401,
              response403,
              response404,
              response503,
            ],
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status503Outcome,
          ],
        },
        {
          id: "edit-post",
          name: "editPost",
          description: "Current category write grant plus author or moderator; post CAS.",
          input: [
            scopeIdField,
            postIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            textField,
            expectedVersionField,
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            idField,
            topicIdField,
            authorIdField,
            textField2,
            stateField3,
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "PATCH",
            path: "/api/scopes/{scopeId}/posts/{postId}",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "post-id",
                name: "postId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              response2003,
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["text", "expected-version"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
        {
          id: "post-history",
          name: "postHistory",
          description:
            "Current category read grant; hidden text moderator only; ordinary removed history empty.",
          input: [scopeIdField, postIdField, limitField, cursorField],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            {
              id: "items",
              name: "items",
              required: true,
              description: "",
              type: "array",
              items: {
                type: "object",
                fields: [postIdField, versionField, textField, authorIdField, atField],
              },
              maxItems: 100,
            },
            nextCursorField,
          ],
          transport: {
            protocol: "http",
            method: "GET",
            path: "/api/scopes/{scopeId}/posts/{postId}/history",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "post-id",
                name: "postId",
                in: "path",
              },
              {
                field: "limit",
                name: "limit",
                in: "query",
              },
              {
                field: "cursor",
                name: "cursor",
                in: "query",
              },
            ],
            responses: [
              response200,
              response400,
              response401,
              response403,
              response404,
              response503,
            ],
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status503Outcome,
          ],
        },
        {
          id: "transition-topic",
          name: "transitionTopic",
          description:
            "Current same-scope moderator with category access; finite transitions and CAS.",
          input: [
            scopeIdField,
            topicIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            {
              id: "action",
              name: "action",
              required: true,
              description: "",
              type: "text",
              enumValues: ["close", "reopen", "archive"],
            },
            expectedVersionField,
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            idField,
            categoryIdField,
            titleField,
            stateField2,
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/scopes/{scopeId}/topics/{topicId}/transitions",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "topic-id",
                name: "topicId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              response2002,
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["action", "expected-version"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
        {
          id: "transition-post",
          name: "transitionPost",
          description:
            "Current same-scope moderator with category access; finite transitions and CAS.",
          input: [
            scopeIdField,
            postIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            {
              id: "action",
              name: "action",
              required: true,
              description: "",
              type: "text",
              enumValues: ["hide", "restore", "remove"],
            },
            expectedVersionField,
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            idField,
            topicIdField,
            authorIdField,
            textField2,
            stateField3,
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/scopes/{scopeId}/posts/{postId}/transitions",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "post-id",
                name: "postId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              response2003,
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["action", "expected-version"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
        {
          id: "render",
          name: "render",
          description:
            "Current category write grant; mentions intersect current eligible principals; pure result only.",
          input: [
            scopeIdField,
            topicIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            {
              id: "source",
              name: "source",
              required: true,
              description: "",
              type: "text",
              minLength: 1,
              maxLength: 4096,
            },
            formatVersionField,
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            {
              id: "html",
              name: "html",
              required: true,
              description: "",
              type: "text",
              maxLength: 40000,
            },
            {
              id: "mention-ids",
              name: "mentionIds",
              required: true,
              description: "",
              type: "array",
              items: {
                type: "uuid",
              },
              maxItems: 100,
            },
            formatVersionField,
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/scopes/{scopeId}/hooks/render/{topicId}",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "topic-id",
                name: "topicId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              {
                status: 200,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: ["html", "mention-ids", "format-version"],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["source", "format-version"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
        {
          id: "restructure",
          name: "restructure",
          description:
            "Current moderator on both open topics in same scope/category; lock/recheck both versions.",
          input: [
            scopeIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            {
              id: "action",
              name: "action",
              required: true,
              description: "",
              type: "text",
              enumValues: ["split", "merge"],
            },
            sourceTopicIdField,
            targetTopicIdField,
            {
              id: "post-ids",
              name: "postIds",
              required: true,
              description: "",
              type: "array",
              items: {
                type: "uuid",
              },
              minItems: 1,
              maxItems: 100,
            },
            {
              id: "source-expected-version",
              name: "sourceExpectedVersion",
              required: true,
              description: "",
              type: "integer",
              minimum: 1,
              maximum: 9007199254740991,
            },
            {
              id: "target-expected-version",
              name: "targetExpectedVersion",
              required: true,
              description: "",
              type: "integer",
              minimum: 1,
              maximum: 9007199254740991,
            },
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            sourceTopicIdField,
            targetTopicIdField,
            {
              id: "post-ids",
              name: "postIds",
              required: true,
              description: "",
              type: "array",
              items: {
                type: "uuid",
              },
              maxItems: 100,
            },
            {
              id: "source-version",
              name: "sourceVersion",
              required: true,
              description: "",
              type: "integer",
              minimum: 1,
              maximum: 9007199254740991,
            },
            {
              id: "target-version",
              name: "targetVersion",
              required: true,
              description: "",
              type: "integer",
              minimum: 1,
              maximum: 9007199254740991,
            },
            {
              id: "subscription-principal-ids",
              name: "subscriptionPrincipalIds",
              required: true,
              description: "",
              type: "array",
              items: {
                type: "uuid",
              },
              maxItems: 100,
            },
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/scopes/{scopeId}/hooks/restructure",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              {
                status: 200,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: [
                    "source-topic-id",
                    "target-topic-id",
                    "post-ids",
                    "source-version",
                    "target-version",
                    "subscription-principal-ids",
                  ],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: [
                "action",
                "source-topic-id",
                "target-topic-id",
                "post-ids",
                "source-expected-version",
                "target-expected-version",
              ],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
      ],
      types: [
        {
          id: "field-error",
          version: "v1",
          name: "Field validation error",
          description: "",
          value: {
            type: "object",
            fields: [fieldField, messageField2],
          },
        },
      ],
    },
  },
  {
    id: "dc-subscriptions-api",
    version: "v1",
    name: "Subscriptions REST contract",
    kind: "api",
    coverage: "Partial",
    description:
      "Frozen Discourse-core v1 REST adaptation. Transport and payloads are explicit; P71b owns executable command/effect bindings. No runtime is supplied.",
    shape: {
      payload: [],
      operations: [
        {
          id: "put-subscription",
          name: "putSubscription",
          description:
            "Principal must equal session principal; current category access on write and replay.",
          input: [
            scopeIdField,
            topicIdField,
            principalIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            modeField,
            channelsField,
            expectedVersionField,
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            principalIdField,
            topicIdField,
            modeField,
            channelsField,
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "PUT",
            path: "/api/scopes/{scopeId}/topics/{topicId}/subscriptions/{principalId}",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "topic-id",
                name: "topicId",
                in: "path",
              },
              {
                field: "principal-id",
                name: "principalId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              {
                status: 200,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: ["principal-id", "topic-id", "mode", "channels", "version"],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["mode", "channels", "expected-version"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
        {
          id: "inbox",
          name: "inbox",
          description:
            "Session principal only; current membership/access/preferences before every projection/page.",
          input: [scopeIdField, limitField, cursorField],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            {
              id: "items",
              name: "items",
              required: true,
              description: "",
              type: "array",
              items: {
                type: "object",
                fields: [
                  idField,
                  {
                    id: "event-id",
                    name: "eventId",
                    required: true,
                    description: "",
                    type: "uuid",
                  },
                  topicIdField,
                  titleField,
                ],
              },
              maxItems: 100,
            },
            nextCursorField,
          ],
          transport: {
            protocol: "http",
            method: "GET",
            path: "/api/scopes/{scopeId}/inbox",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "limit",
                name: "limit",
                in: "query",
              },
              {
                field: "cursor",
                name: "cursor",
                in: "query",
              },
            ],
            responses: [
              response200,
              response400,
              response401,
              response403,
              response404,
              response503,
            ],
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status503Outcome,
          ],
        },
      ],
      types: [
        {
          id: "field-error",
          version: "v1",
          name: "Field validation error",
          description: "",
          value: {
            type: "object",
            fields: [fieldField, messageField2],
          },
        },
      ],
    },
  },
  {
    id: "dc-files-api",
    version: "v1",
    name: "Files REST contract",
    kind: "api",
    coverage: "Partial",
    description:
      "Frozen Discourse-core v1 REST adaptation. Transport and payloads are explicit; P71b owns executable command/effect bindings. No runtime is supplied.",
    shape: {
      payload: [],
      operations: [
        {
          id: "stage-file",
          name: "stageFile",
          description: "Current workspace member; server-established owner; finite MIME/size/hash.",
          input: [
            scopeIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            {
              id: "filename",
              name: "filename",
              required: true,
              description: "",
              type: "text",
              minLength: 1,
              maxLength: 120,
            },
            mimeField,
            sizeField,
            sha256Field,
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            idField,
            ownerIdField,
            stateField5,
            mimeField,
            sizeField,
            sha256Field,
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/scopes/{scopeId}/attachments",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              {
                status: 201,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: ["id", "owner-id", "state", "mime", "size", "sha256", "version"],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["filename", "mime", "size", "sha256"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
        {
          id: "put-file-bytes",
          name: "putFileBytes",
          description:
            "Current file owner in scope; staged or recoverable incomplete file; hash/size/MIME verified.",
          input: [
            scopeIdField,
            attachmentIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            {
              id: "base64",
              name: "base64",
              required: true,
              description: "",
              type: "text",
              textConstraint: "base64",
              minLength: 1,
              maxLength: 14000000,
            },
            expectedVersionField,
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            idField,
            ownerIdField,
            stateField5,
            mimeField,
            sizeField,
            sha256Field,
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "PUT",
            path: "/api/scopes/{scopeId}/attachments/{attachmentId}/bytes",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "attachment-id",
                name: "attachmentId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              response2004,
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["base64", "expected-version"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
        {
          id: "download-file",
          name: "downloadFile",
          description:
            "Attached file only; current parent category read grant on every byte request; proxy only.",
          input: [scopeIdField, attachmentIdField],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            {
              id: "header-content-disposition",
              name: "headerContentDisposition",
              required: true,
              description: "",
              type: "text",
              enumValues: ['attachment; filename="hello.txt"'],
            },
          ],
          transport: {
            protocol: "http",
            method: "GET",
            path: "/api/scopes/{scopeId}/attachments/{attachmentId}/bytes",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "attachment-id",
                name: "attachmentId",
                in: "path",
              },
            ],
            responses: [
              {
                status: 200,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                  {
                    field: "header-content-disposition",
                    name: "content-disposition",
                  },
                ],
                body: {
                  kind: "binary",
                  contentType: "text/plain",
                  maxBytes: 10485760,
                },
              },
              response400,
              response401,
              response403,
              response404,
              response503,
            ],
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status503Outcome,
          ],
        },
        {
          id: "attach-file",
          name: "attachFile",
          description:
            "Current file owner plus current parent category write grant; same-scope file/post.",
          input: [
            scopeIdField,
            attachmentIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            postIdField,
            expectedVersionField,
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            idField,
            ownerIdField,
            stateField5,
            mimeField,
            sizeField,
            sha256Field,
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/scopes/{scopeId}/attachments/{attachmentId}/links",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "attachment-id",
                name: "attachmentId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              response2004,
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["post-id", "expected-version"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
      ],
      types: [
        {
          id: "field-error",
          version: "v1",
          name: "Field validation error",
          description: "",
          value: {
            type: "object",
            fields: [fieldField, messageField2],
          },
        },
      ],
    },
  },
  {
    id: "dc-moderation-api",
    version: "v1",
    name: "Moderation REST contract",
    kind: "api",
    coverage: "Partial",
    description:
      "Frozen Discourse-core v1 REST adaptation. Transport and payloads are explicit; P71b owns executable command/effect bindings. No runtime is supplied.",
    shape: {
      payload: [],
      operations: [
        {
          id: "flag-post",
          name: "flagPost",
          description:
            "Current category read grant; visible post; unique active reporter/post identity.",
          input: [
            scopeIdField,
            postIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            {
              id: "reason",
              name: "reason",
              required: true,
              description: "",
              type: "text",
              enumValues: ["spam", "abuse"],
            },
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            idField,
            postIdField,
            reporterIdField,
            stateField4,
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/scopes/{scopeId}/posts/{postId}/flags",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "post-id",
                name: "postId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              {
                status: 201,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: ["id", "post-id", "reporter-id", "state", "version"],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["reason"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
        {
          id: "review-queue",
          name: "reviewQueue",
          description: "Current same-scope moderator; authorized category filtering before paging.",
          input: [scopeIdField, limitField, cursorField],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            {
              id: "items",
              name: "items",
              required: true,
              description: "",
              type: "array",
              items: {
                type: "object",
                fields: [idField, postIdField, reporterIdField, stateField4, versionField],
              },
              maxItems: 100,
            },
            nextCursorField,
          ],
          transport: {
            protocol: "http",
            method: "GET",
            path: "/api/scopes/{scopeId}/reviews",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "limit",
                name: "limit",
                in: "query",
              },
              {
                field: "cursor",
                name: "cursor",
                in: "query",
              },
            ],
            responses: [
              response200,
              response400,
              response401,
              response403,
              response404,
              response503,
            ],
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status503Outcome,
          ],
        },
        {
          id: "review-flag",
          name: "reviewFlag",
          description:
            "Current same-scope moderator with category access; flag CAS; audited action.",
          input: [
            scopeIdField,
            {
              id: "flag-id",
              name: "flagId",
              required: true,
              description: "",
              type: "uuid",
            },
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            {
              id: "action",
              name: "action",
              required: true,
              description: "",
              type: "text",
              enumValues: ["uphold", "dismiss"],
            },
            expectedVersionField,
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            idField,
            postIdField,
            reporterIdField,
            stateField4,
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/scopes/{scopeId}/reviews/{flagId}",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "flag-id",
                name: "flagId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              {
                status: 200,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: ["id", "post-id", "reporter-id", "state", "version"],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["action", "expected-version"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
        {
          id: "adjudicate",
          name: "adjudicate",
          description:
            "Current post author may evaluate/appeal; moderator may override; category access required.",
          input: [
            scopeIdField,
            postIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            {
              id: "action",
              name: "action",
              required: true,
              description: "",
              type: "text",
              enumValues: ["evaluate", "appeal", "override-allow"],
            },
            {
              id: "rule-version",
              name: "ruleVersion",
              required: true,
              description: "",
              type: "text",
              enumValues: ["abuse-v1"],
            },
            expectedVersionField,
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            idField,
            postIdField,
            {
              id: "decision",
              name: "decision",
              required: true,
              description: "",
              type: "text",
              enumValues: ["allow", "review", "reject"],
            },
            {
              id: "reason",
              name: "reason",
              required: true,
              description: "",
              type: "text",
              enumValues: ["fixture-token", "appeal-accepted", "moderator-override"],
            },
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/scopes/{scopeId}/hooks/abuse/{postId}",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "post-id",
                name: "postId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              {
                status: 200,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: ["id", "post-id", "decision", "reason", "version"],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["action", "rule-version", "expected-version"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
      ],
      types: [
        {
          id: "field-error",
          version: "v1",
          name: "Field validation error",
          description: "",
          value: {
            type: "object",
            fields: [fieldField, messageField2],
          },
        },
      ],
    },
  },
  {
    id: "dc-search-api",
    version: "v1",
    name: "Search REST contract",
    kind: "api",
    coverage: "Partial",
    description:
      "Frozen Discourse-core v1 REST adaptation. Transport and payloads are explicit; P71b owns executable command/effect bindings. No runtime is supplied.",
    shape: {
      payload: [],
      operations: [
        {
          id: "search",
          name: "search",
          description:
            "Current workspace/category policy before matching/snippets/limit; authoritative removal check.",
          input: [
            scopeIdField,
            limitField,
            cursorField,
            {
              id: "q",
              name: "q",
              required: true,
              description: "",
              type: "text",
              minLength: 1,
              maxLength: 200,
            },
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            {
              id: "items",
              name: "items",
              required: true,
              description: "",
              type: "array",
              items: {
                type: "object",
                fields: [
                  topicIdField,
                  postIdField,
                  titleField,
                  {
                    id: "snippet",
                    name: "snippet",
                    required: true,
                    description: "",
                    type: "text",
                    minLength: 1,
                    maxLength: 20000,
                  },
                ],
              },
              maxItems: 100,
            },
            nextCursorField,
          ],
          transport: {
            protocol: "http",
            method: "GET",
            path: "/api/scopes/{scopeId}/search",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "limit",
                name: "limit",
                in: "query",
              },
              {
                field: "cursor",
                name: "cursor",
                in: "query",
              },
              {
                field: "q",
                name: "q",
                in: "query",
              },
            ],
            responses: [
              response200,
              response400,
              response401,
              response403,
              response404,
              response503,
            ],
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status503Outcome,
          ],
        },
        {
          id: "rank",
          name: "rank",
          description:
            "Current workspace member; features and result subset from current readable candidates only.",
          input: [scopeIdField, limitField, algorithmVersionField],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            topicIdsField,
            algorithmVersionField,
            {
              id: "projection-version",
              name: "projectionVersion",
              required: true,
              description: "",
              type: "integer",
              minimum: 1,
              maximum: 9007199254740991,
            },
            {
              id: "as-of",
              name: "asOf",
              required: true,
              description: "",
              type: "timestamp",
            },
          ],
          transport: {
            protocol: "http",
            method: "GET",
            path: "/api/scopes/{scopeId}/hooks/ranking",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "limit",
                name: "limit",
                in: "query",
              },
              {
                field: "algorithm-version",
                name: "algorithmVersion",
                in: "query",
              },
            ],
            responses: [
              {
                status: 200,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: ["topic-ids", "algorithm-version", "projection-version", "as-of"],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response503,
            ],
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status503Outcome,
          ],
        },
      ],
      types: [
        {
          id: "field-error",
          version: "v1",
          name: "Field validation error",
          description: "",
          value: {
            type: "object",
            fields: [fieldField, messageField2],
          },
        },
      ],
    },
  },
  {
    id: "dc-audit-api",
    version: "v1",
    name: "Audit REST contract",
    kind: "api",
    coverage: "Partial",
    description:
      "Frozen Discourse-core v1 REST adaptation. Transport and payloads are explicit; P71b owns executable command/effect bindings. No runtime is supplied.",
    shape: {
      payload: [],
      operations: [
        {
          id: "audit",
          name: "audit",
          description: "Current same-scope moderator with category access; safe metadata only.",
          input: [scopeIdField, limitField, cursorField, targetIdField],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            {
              id: "items",
              name: "items",
              required: true,
              description: "",
              type: "array",
              items: {
                type: "object",
                fields: [
                  idField,
                  {
                    id: "actor-id",
                    name: "actorId",
                    required: true,
                    description: "",
                    type: "uuid",
                  },
                  targetIdField,
                  {
                    id: "action",
                    name: "action",
                    required: true,
                    description: "",
                    type: "text",
                    minLength: 1,
                    maxLength: 80,
                  },
                  atField,
                ],
              },
              maxItems: 100,
            },
            nextCursorField,
          ],
          transport: {
            protocol: "http",
            method: "GET",
            path: "/api/scopes/{scopeId}/audit",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "limit",
                name: "limit",
                in: "query",
              },
              {
                field: "cursor",
                name: "cursor",
                in: "query",
              },
              {
                field: "target-id",
                name: "targetId",
                in: "query",
              },
            ],
            responses: [
              response200,
              response400,
              response401,
              response403,
              response404,
              response503,
            ],
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status503Outcome,
          ],
        },
      ],
      types: [
        {
          id: "field-error",
          version: "v1",
          name: "Field validation error",
          description: "",
          value: {
            type: "object",
            fields: [fieldField, messageField2],
          },
        },
      ],
    },
  },
  {
    id: "dc-trust-api",
    version: "v1",
    name: "Trust REST contract",
    kind: "api",
    coverage: "Partial",
    description:
      "Frozen Discourse-core v1 REST adaptation. Transport and payloads are explicit; P71b owns executable command/effect bindings. No runtime is supplied.",
    shape: {
      payload: [],
      operations: [
        {
          id: "evaluate-trust",
          name: "evaluateTrust",
          description:
            "Current workspace administrator; trusted server activity only; no role grants.",
          input: [
            scopeIdField,
            principalIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            policyVersionField,
            {
              id: "override",
              name: "override",
              required: true,
              description: "",
              type: "integer",
              minimum: 0,
              maximum: 2,
              nullable: true,
            },
            expectedVersionField,
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            principalIdField,
            {
              id: "level",
              name: "level",
              required: true,
              description: "",
              type: "integer",
              minimum: 0,
              maximum: 2,
            },
            {
              id: "reasons",
              name: "reasons",
              required: true,
              description: "",
              type: "array",
              items: {
                type: "text",
                enumValues: ["qualified", "inactive", "override"],
              },
              maxItems: 3,
            },
            policyVersionField,
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/scopes/{scopeId}/hooks/trust/{principalId}",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "principal-id",
                name: "principalId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              {
                status: 200,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: ["principal-id", "level", "reasons", "policy-version", "version"],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["policy-version", "override", "expected-version"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
      ],
      types: [
        {
          id: "field-error",
          version: "v1",
          name: "Field validation error",
          description: "",
          value: {
            type: "object",
            fields: [fieldField, messageField2],
          },
        },
      ],
    },
  },
  {
    id: "dc-digests-api",
    version: "v1",
    name: "Digests REST contract",
    kind: "api",
    coverage: "Partial",
    description:
      "Frozen Discourse-core v1 REST adaptation. Transport and payloads are explicit; P71b owns executable command/effect bindings. No runtime is supplied.",
    shape: {
      payload: [],
      operations: [
        {
          id: "schedule-digest",
          name: "scheduleDigest",
          description:
            "Self or current workspace administrator; current preferences and public eligible candidates.",
          input: [
            scopeIdField,
            principalIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            windowStartField,
            windowEndField,
            {
              id: "timezone",
              name: "timezone",
              required: true,
              description: "",
              type: "text",
              enumValues: ["America/Chicago"],
            },
            {
              id: "policy-version",
              name: "policyVersion",
              required: true,
              description: "",
              type: "text",
              enumValues: ["digest-v1"],
            },
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            idField,
            principalIdField,
            windowStartField,
            windowEndField,
            topicIdsField,
            deliveryField,
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/scopes/{scopeId}/hooks/digests/{principalId}",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "principal-id",
                name: "principalId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              {
                status: 201,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: [
                    "id",
                    "principal-id",
                    "window-start",
                    "window-end",
                    "topic-ids",
                    "delivery",
                    "version",
                  ],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["window-start", "window-end", "timezone", "policy-version"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
        {
          id: "get-digest",
          name: "getDigest",
          description:
            "Self or current workspace administrator; redact newly inaccessible selection before return.",
          input: [
            scopeIdField,
            {
              id: "digest-id",
              name: "digestId",
              required: true,
              description: "",
              type: "uuid",
            },
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            idField,
            principalIdField,
            windowStartField,
            windowEndField,
            topicIdsField,
            deliveryField,
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "GET",
            path: "/api/scopes/{scopeId}/hooks/digests/{digestId}",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "digest-id",
                name: "digestId",
                in: "path",
              },
            ],
            responses: [
              {
                status: 200,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: [
                    "id",
                    "principal-id",
                    "window-start",
                    "window-end",
                    "topic-ids",
                    "delivery",
                    "version",
                  ],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response503,
            ],
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status503Outcome,
          ],
        },
      ],
      types: [
        {
          id: "field-error",
          version: "v1",
          name: "Field validation error",
          description: "",
          value: {
            type: "object",
            fields: [fieldField, messageField2],
          },
        },
      ],
    },
  },
  {
    id: "dc-privacy-api",
    version: "v1",
    name: "Privacy REST contract",
    kind: "api",
    coverage: "Partial",
    description:
      "Frozen Discourse-core v1 REST adaptation. Transport and payloads are explicit; P71b owns executable command/effect bindings. No runtime is supplied.",
    shape: {
      payload: [],
      operations: [
        {
          id: "privacy",
          name: "privacy",
          description:
            "Self or current workspace administrator; authoritative holds/retention; no foreign text export.",
          input: [
            scopeIdField,
            principalIdField,
            headerIdempotencyKeyField,
            headerOriginField,
            headerXCsrfTokenField,
            kindField,
            {
              id: "policy-version",
              name: "policyVersion",
              required: true,
              description: "",
              type: "text",
              enumValues: ["privacy-v1"],
            },
            expectedVersionField,
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            idField,
            {
              id: "subject-id",
              name: "subjectId",
              required: true,
              description: "",
              type: "uuid",
            },
            kindField,
            {
              id: "status",
              name: "status",
              required: true,
              description: "",
              type: "text",
              enumValues: ["ready", "complete"],
            },
            {
              id: "exported-post-ids",
              name: "exportedPostIds",
              required: true,
              description: "",
              type: "array",
              items: {
                type: "uuid",
              },
              maxItems: 100,
            },
            {
              id: "erased-post-ids",
              name: "erasedPostIds",
              required: true,
              description: "",
              type: "array",
              items: {
                type: "uuid",
              },
              maxItems: 100,
            },
            {
              id: "retained-post-ids",
              name: "retainedPostIds",
              required: true,
              description: "",
              type: "array",
              items: {
                type: "uuid",
              },
              maxItems: 100,
            },
            {
              id: "retained-reason",
              name: "retainedReason",
              required: true,
              description: "",
              type: "text",
              enumValues: ["legal-hold", "audit-only", "none"],
            },
            {
              id: "cancelled-deliveries",
              name: "cancelledDeliveries",
              required: true,
              description: "",
              type: "integer",
              minimum: 0,
              maximum: 1000000,
            },
            versionField,
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/scopes/{scopeId}/hooks/privacy/{principalId}",
            parameters: [
              {
                field: "scope-id",
                name: "scopeId",
                in: "path",
              },
              {
                field: "principal-id",
                name: "principalId",
                in: "path",
              },
              {
                field: "header-idempotency-key",
                name: "Idempotency-Key",
                in: "header",
              },
              {
                field: "header-origin",
                name: "Origin",
                in: "header",
              },
              {
                field: "header-x-csrf-token",
                name: "X-CSRF-Token",
                in: "header",
              },
            ],
            responses: [
              {
                status: 200,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: [
                    "id",
                    "subject-id",
                    "kind",
                    "status",
                    "exported-post-ids",
                    "erased-post-ids",
                    "retained-post-ids",
                    "retained-reason",
                    "cancelled-deliveries",
                    "version",
                  ],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response4092,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["kind", "policy-version", "expected-version"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome2,
            status422Outcome,
            status503Outcome,
          ],
        },
      ],
      types: [
        {
          id: "field-error",
          version: "v1",
          name: "Field validation error",
          description: "",
          value: {
            type: "object",
            fields: [fieldField, messageField2],
          },
        },
      ],
    },
  },
  {
    id: "dc-inbound-api",
    version: "v1",
    name: "Inbound REST contract",
    kind: "api",
    coverage: "Partial",
    description:
      "Frozen Discourse-core v1 REST adaptation. Transport and payloads are explicit; P71b owns executable command/effect bindings. No runtime is supplied.",
    shape: {
      payload: [],
      operations: [
        {
          id: "inbound-email",
          name: "inboundEmail",
          description:
            "Authenticated original-byte source/timestamp; exact confirmed sender/thread mapping and current posting grant.",
          input: [
            {
              id: "header-x-mail-timestamp",
              name: "headerXMailTimestamp",
              required: true,
              description: "",
              type: "text",
              minLength: 1,
              maxLength: 256,
            },
            {
              id: "header-x-mail-signature",
              name: "headerXMailSignature",
              required: true,
              description: "",
              type: "text",
              minLength: 1,
              maxLength: 256,
            },
            messageIdField,
            {
              id: "sender",
              name: "sender",
              required: true,
              description: "",
              type: "text",
              textConstraint: "email",
            },
            {
              id: "topic-token",
              name: "topicToken",
              required: true,
              description: "",
              type: "text",
              minLength: 1,
              maxLength: 200,
            },
            {
              id: "raw-base64",
              name: "rawBase64",
              required: true,
              description: "",
              type: "text",
              minLength: 1,
              maxLength: 1400000,
            },
          ],
          output: [
            headerCacheControlField,
            headerXCorrelationIdField,
            messageIdField,
            postIdField,
            topicIdField,
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/api/providers/mail/replies",
            parameters: [
              {
                field: "header-x-mail-timestamp",
                name: "X-Mail-Timestamp",
                in: "header",
              },
              {
                field: "header-x-mail-signature",
                name: "X-Mail-Signature",
                in: "header",
              },
            ],
            responses: [
              {
                status: 201,
                headers: [
                  {
                    field: "header-cache-control",
                    name: "Cache-Control",
                  },
                  {
                    field: "header-x-correlation-id",
                    name: "X-Correlation-Id",
                  },
                ],
                body: {
                  kind: "json",
                  contentType: "application/json",
                  fields: ["message-id", "post-id", "topic-id"],
                },
              },
              response400,
              response401,
              response403,
              response404,
              response409,
              response422,
              response503,
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["message-id", "sender", "topic-token", "raw-base64"],
            },
          },
          outcomes: [
            status400Outcome,
            status401Outcome,
            status403Outcome,
            status404Outcome,
            status409Outcome,
            status422Outcome,
            status503Outcome,
          ],
        },
      ],
      types: [
        {
          id: "field-error",
          version: "v1",
          name: "Field validation error",
          description: "",
          value: {
            type: "object",
            fields: [fieldField, messageField2],
          },
        },
      ],
    },
  },
] satisfies ArchitectureContract[];

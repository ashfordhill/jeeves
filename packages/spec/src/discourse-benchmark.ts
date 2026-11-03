/** Independent Discourse acceptance contract. No application logic, storage or hook implementation. */
import { createHash } from "node:crypto";
import { z } from "zod";
import type { BenchmarkFixtureContract, BenchmarkProtocolOperation } from "./benchmark-fixtures.ts";
import {
  benchmarkCredentialsSchema,
  benchmarkErrorSchema,
  benchmarkPageQuerySchema,
  benchmarkPageSchema,
  benchmarkProtocolComponents,
  benchmarkSessionIdentitySchema,
  benchmarkSessionSecurityScheme,
  benchmarkExpectedVersionSchema as version,
} from "./benchmark-protocol.ts";

const id = z.uuid();
const text = z.string().min(1).max(20000);
const title = z.string().min(1).max(200);
const time = z.iso.datetime();
const count = z.int().nonnegative().max(1000000);
const empty = z.strictObject({});
const scoped = z.strictObject({ scopeId: id });
const expected = { expectedVersion: version };
const topicState = z.enum(["open", "closed", "archived"]);
const postState = z.enum(["visible", "hidden", "removed"]);
const channels = z.array(z.enum(["inbox", "email"])).max(2);
const refs = z.array(id).max(100);
const topic = z.strictObject({ id, categoryId: id, title, state: topicState, version });
const post = z.strictObject({
  id,
  topicId: id,
  authorId: id,
  text: text.nullable(),
  state: postState,
  version,
});
const revision = z.strictObject({ postId: id, version, text, authorId: id, at: time });
const subscription = z.strictObject({
  principalId: id,
  topicId: id,
  mode: z.enum(["watch", "mute"]),
  channels,
  version,
});
const attachment = z.strictObject({
  id,
  ownerId: id,
  state: z.enum(["staged", "validated", "attached", "orphan", "deleted"]),
  mime: z.enum(["text/plain", "image/png"]),
  size: z.int().min(1).max(10485760),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  version,
});
const flag = z.strictObject({
  id,
  postId: id,
  reporterId: id,
  state: z.enum(["pending", "dismissed", "upheld"]),
  version,
});
const audit = z.strictObject({
  id,
  actorId: id,
  targetId: id,
  action: z.string().min(1).max(80),
  at: time,
});
const searchItem = z.strictObject({ topicId: id, postId: id, title, snippet: text });
const member = z.strictObject({
  principalId: id,
  groupId: id,
  state: z.enum(["active", "revoked"]),
  role: z.enum(["member", "moderator"]),
  version,
});
const grant = z.strictObject({
  categoryId: id,
  groupId: id,
  access: z.enum(["read", "write"]),
  version,
});
const trust = z.strictObject({
  principalId: id,
  level: z.int().min(0).max(2),
  reasons: z.array(z.enum(["qualified", "inactive", "override"])).max(3),
  policyVersion: z.literal("trust-v1"),
  version,
});
const adjudication = z.strictObject({
  id,
  postId: id,
  decision: z.enum(["allow", "review", "reject"]),
  reason: z.enum(["fixture-token", "appeal-accepted", "moderator-override"]),
  version,
});
const digest = z.strictObject({
  id,
  principalId: id,
  windowStart: time,
  windowEnd: time,
  topicIds: refs,
  delivery: z.enum(["queued", "delivered", "uncertain", "suppressed"]),
  version,
});
const rendered = z.strictObject({
  html: z.string().max(40000),
  mentionIds: refs,
  formatVersion: z.literal("safe-v1"),
});
const restructure = z.strictObject({
  sourceTopicId: id,
  targetTopicId: id,
  postIds: refs,
  sourceVersion: version,
  targetVersion: version,
  subscriptionPrincipalIds: refs,
});
const privacy = z.strictObject({
  id,
  subjectId: id,
  kind: z.enum(["export", "erase"]),
  status: z.enum(["ready", "complete"]),
  exportedPostIds: refs,
  erasedPostIds: refs,
  retainedPostIds: refs,
  retainedReason: z.enum(["legal-hold", "audit-only", "none"]),
  cancelledDeliveries: count,
  version,
});
const ranking = z.strictObject({
  topicIds: refs,
  algorithmVersion: z.literal("rank-v1"),
  projectionVersion: version,
  asOf: time,
});
const jsonHeaders = z.object({ "content-type": z.literal("application/json") });
const operations: BenchmarkProtocolOperation[] = [];
function op(
  operationId: string,
  method: BenchmarkProtocolOperation["method"],
  path: string,
  body: z.ZodType,
  response: z.ZodType,
  options: {
    params?: z.ZodType;
    query?: z.ZodType;
    status?: number;
    auth?: BenchmarkProtocolOperation["authentication"];
    errors?: BenchmarkProtocolOperation["errors"];
    headers?: z.ZodType;
  } = {},
) {
  const auth = options.auth ?? "session";
  const status = options.status ?? 200;
  operations.push({
    id: operationId,
    method,
    path,
    authentication: auth,
    idempotency:
      method === "GET" || auth === "public"
        ? "none"
        : auth === "provider"
          ? "provider"
          : "required",
    input: { params: options.params ?? scoped, query: options.query ?? empty, body },
    responses: { [status]: response },
    errors:
      options.errors ??
      (method === "GET" ? [400, 401, 403, 404, 503] : [400, 401, 403, 404, 409, 422, 503]),
    ...(options.headers ? { responseHeaders: { [status]: options.headers } } : {}),
  });
}
const route = "/api/scopes/{scopeId}";
const params = (key: string) => z.strictObject({ scopeId: id, [key]: id });
op(
  "register",
  "POST",
  "/api/accounts",
  benchmarkCredentialsSchema,
  benchmarkSessionIdentitySchema,
  {
    params: empty,
    auth: "public",
    status: 201,
    errors: [400, 403, 409, 503],
    headers: jsonHeaders.extend({ "set-cookie": z.string().min(1) }),
  },
);
op("login", "POST", "/api/session", benchmarkCredentialsSchema, benchmarkSessionIdentitySchema, {
  params: empty,
  auth: "public",
  errors: [400, 401, 403, 503],
  headers: jsonHeaders.extend({ "set-cookie": z.string().min(1) }),
});
op("getSession", "GET", "/api/session", z.null(), benchmarkSessionIdentitySchema, {
  params: empty,
  errors: [401],
});
op("logout", "DELETE", "/api/session", empty, z.null(), {
  params: empty,
  status: 204,
  errors: [400, 401, 403, 409, 503],
  headers: z.object({ "set-cookie": z.string().min(1) }).refine((h) => !("content-type" in h)),
});
op(
  "putMembership",
  "PUT",
  `${route}/groups/{groupId}/members/{principalId}`,
  z.strictObject({ state: member.shape.state, role: member.shape.role, ...expected }),
  member,
  { params: z.strictObject({ scopeId: id, groupId: id, principalId: id }) },
);
op(
  "putGrant",
  "PUT",
  `${route}/categories/{categoryId}/grants`,
  z.strictObject({ groupId: id, access: grant.shape.access, ...expected }),
  grant,
  { params: params("categoryId") },
);
op(
  "createTopic",
  "POST",
  `${route}/topics`,
  z.strictObject({ categoryId: id, title, text }),
  z.strictObject({ topic, post }),
  { status: 201 },
);
op("getTopic", "GET", `${route}/topics/{topicId}`, z.null(), topic, { params: params("topicId") });
op("listTopics", "GET", `${route}/topics`, z.null(), benchmarkPageSchema(topic), {
  query: benchmarkPageQuerySchema,
});
op(
  "reply",
  "POST",
  `${route}/topics/{topicId}/posts`,
  z.strictObject({ text, ...expected }),
  post,
  { params: params("topicId"), status: 201 },
);
op("listPosts", "GET", `${route}/topics/{topicId}/posts`, z.null(), benchmarkPageSchema(post), {
  params: params("topicId"),
  query: benchmarkPageQuerySchema,
});
op("editPost", "PATCH", `${route}/posts/{postId}`, z.strictObject({ text, ...expected }), post, {
  params: params("postId"),
});
op(
  "postHistory",
  "GET",
  `${route}/posts/{postId}/history`,
  z.null(),
  benchmarkPageSchema(revision),
  { params: params("postId"), query: benchmarkPageQuerySchema },
);
op(
  "transitionTopic",
  "POST",
  `${route}/topics/{topicId}/transitions`,
  z.strictObject({ action: z.enum(["close", "reopen", "archive"]), ...expected }),
  topic,
  { params: params("topicId") },
);
op(
  "transitionPost",
  "POST",
  `${route}/posts/{postId}/transitions`,
  z.strictObject({ action: z.enum(["hide", "restore", "remove"]), ...expected }),
  post,
  { params: params("postId") },
);
op(
  "putSubscription",
  "PUT",
  `${route}/topics/{topicId}/subscriptions/{principalId}`,
  z.strictObject({ mode: subscription.shape.mode, channels, ...expected }),
  subscription,
  { params: z.strictObject({ scopeId: id, topicId: id, principalId: id }) },
);
op(
  "inbox",
  "GET",
  `${route}/inbox`,
  z.null(),
  benchmarkPageSchema(z.strictObject({ id, eventId: id, topicId: id, title })),
  { query: benchmarkPageQuerySchema },
);
op(
  "stageFile",
  "POST",
  `${route}/attachments`,
  z.strictObject({
    filename: z.string().min(1).max(120),
    mime: attachment.shape.mime,
    size: attachment.shape.size,
    sha256: attachment.shape.sha256,
  }),
  attachment,
  { status: 201 },
);
op(
  "putFileBytes",
  "PUT",
  `${route}/attachments/{attachmentId}/bytes`,
  z.strictObject({
    base64: z
      .string()
      .min(1)
      .max(14000000)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
    ...expected,
  }),
  attachment,
  { params: params("attachmentId") },
);
op(
  "attachFile",
  "POST",
  `${route}/attachments/{attachmentId}/links`,
  z.strictObject({ postId: id, ...expected }),
  attachment,
  { params: params("attachmentId") },
);
op(
  "downloadFile",
  "GET",
  `${route}/attachments/{attachmentId}/bytes`,
  z.null(),
  z.strictObject({
    fixtureFile: z.literal("hello.txt"),
    size: z.literal(6),
    sha256: attachment.shape.sha256,
  }),
  {
    params: params("attachmentId"),
    headers: z.object({
      "content-type": z.literal("text/plain"),
      "content-length": z.literal("6"),
      "content-disposition": z.literal('attachment; filename="hello.txt"'),
    }),
  },
);
op(
  "flagPost",
  "POST",
  `${route}/posts/{postId}/flags`,
  z.strictObject({ reason: z.enum(["spam", "abuse"]) }),
  flag,
  { params: params("postId"), status: 201 },
);
op("reviewQueue", "GET", `${route}/reviews`, z.null(), benchmarkPageSchema(flag), {
  query: benchmarkPageQuerySchema,
});
op(
  "reviewFlag",
  "POST",
  `${route}/reviews/{flagId}`,
  z.strictObject({ action: z.enum(["uphold", "dismiss"]), ...expected }),
  flag,
  { params: params("flagId") },
);
op("search", "GET", `${route}/search`, z.null(), benchmarkPageSchema(searchItem), {
  query: benchmarkPageQuerySchema.extend({ q: z.string().min(1).max(200) }),
});
op("audit", "GET", `${route}/audit`, z.null(), benchmarkPageSchema(audit), {
  query: benchmarkPageQuerySchema.extend({ targetId: id }),
});
op(
  "evaluateTrust",
  "POST",
  `${route}/hooks/trust/{principalId}`,
  z.strictObject({
    policyVersion: z.literal("trust-v1"),
    override: z.int().min(0).max(2).nullable(),
    ...expected,
  }),
  trust,
  { params: params("principalId") },
);
op(
  "adjudicate",
  "POST",
  `${route}/hooks/abuse/{postId}`,
  z.strictObject({
    action: z.enum(["evaluate", "appeal", "override-allow"]),
    ruleVersion: z.literal("abuse-v1"),
    ...expected,
  }),
  adjudication,
  { params: params("postId") },
);
op(
  "scheduleDigest",
  "POST",
  `${route}/hooks/digests/{principalId}`,
  z.strictObject({
    windowStart: time,
    windowEnd: time,
    timezone: z.literal("America/Chicago"),
    policyVersion: z.literal("digest-v1"),
  }),
  digest,
  { params: params("principalId"), status: 201 },
);
op("getDigest", "GET", `${route}/hooks/digests/{digestId}`, z.null(), digest, {
  params: params("digestId"),
});
op(
  "render",
  "POST",
  `${route}/hooks/render/{topicId}`,
  z.strictObject({ source: z.string().min(1).max(4096), formatVersion: z.literal("safe-v1") }),
  rendered,
  { params: params("topicId") },
);
op(
  "restructure",
  "POST",
  `${route}/hooks/restructure`,
  z.strictObject({
    action: z.enum(["split", "merge"]),
    sourceTopicId: id,
    targetTopicId: id,
    postIds: refs.min(1),
    sourceExpectedVersion: version,
    targetExpectedVersion: version,
  }),
  restructure,
);
op(
  "privacy",
  "POST",
  `${route}/hooks/privacy/{principalId}`,
  z.strictObject({
    kind: z.enum(["export", "erase"]),
    policyVersion: z.literal("privacy-v1"),
    ...expected,
  }),
  privacy,
  { params: params("principalId") },
);
op(
  "inboundEmail",
  "POST",
  "/api/providers/mail/replies",
  z.strictObject({
    messageId: z.string().min(1).max(200),
    sender: z.email(),
    topicToken: z.string().min(1).max(200),
    rawBase64: z.string().min(1).max(1400000),
  }),
  z.strictObject({ messageId: z.string().min(1).max(200), postId: id, topicId: id }),
  { params: empty, auth: "provider", status: 201 },
);
op("rank", "GET", `${route}/hooks/ranking`, z.null(), ranking, {
  query: z.strictObject({
    limit: z.int().min(1).max(100).optional(),
    algorithmVersion: z.literal("rank-v1"),
  }),
});

/** No network/provider control is an application route. Values are fixture support contracts only. */
const snapshot = z
  .strictObject({
    topics: count.optional(),
    posts: count.optional(),
    revisions: count.optional(),
    receipts: count.optional(),
    intents: count.optional(),
    audits: count.optional(),
    inbox: count.optional(),
    inboxReceipts: count.optional(),
    subscriptions: count.optional(),
    flags: count.optional(),
    links: count.optional(),
    objects: count.optional(),
    orphanObjects: count.optional(),
    deliveries: count.optional(),
    cancelledDeliveries: count.optional(),
    trustChanges: count.optional(),
    messageReceipts: count.optional(),
    privacyPlans: count.optional(),
    mutationWinners: count.optional(),
    versionConflicts: count.optional(),
    versions: z.array(version).max(100).optional(),
    postIds: refs.optional(),
    topicIds: refs.optional(),
    auditActorIds: refs.optional(),
    forbiddenTextOccurrences: count.optional(),
    hookWrites: count.optional(),
    uncertainDeliveries: count.optional(),
    providerAttempts: count.optional(),
    logicalDeliveries: count.optional(),
    heldPostIds: refs.optional(),
    states: z.array(z.string().min(1).max(80)).max(100).optional(),
  })
  .refine((s) => Object.keys(s).length > 0);
export const discourseFixtureContract: BenchmarkFixtureContract = {
  operations,
  datasets: {
    principals: z.strictObject({
      id,
      scopeId: id,
      email: z.email(),
      role: z.enum(["member", "moderator", "administrator"]),
      version,
    }),
    trust: z.strictObject({
      principalId: id,
      level: z.int().min(0).max(2),
      policyVersion: z.literal("trust-v1"),
      version,
    }),
    projections: z.strictObject({ scopeId: id, version, asOf: time, state: z.literal("ready") }),
    groups: z.strictObject({ id, scopeId: id, name: title }),
    memberships: member.extend({ scopeId: id }),
    categories: z.strictObject({
      id,
      scopeId: id,
      name: title,
      visibility: z.enum(["public", "private"]),
      version,
    }),
    grants: grant.extend({ scopeId: id }),
    topics: topic.extend({ scopeId: id, createdAt: time }),
    posts: post.extend({ scopeId: id, createdAt: time }),
    revisions: revision.extend({ scopeId: id }),
    subscriptions: subscription.extend({ scopeId: id }),
    attachments: attachment.extend({ scopeId: id, postId: id.nullable() }),
    flags: flag.extend({ scopeId: id }),
    activity: z.strictObject({
      id,
      principalId: id,
      at: time,
      kind: z.enum(["read", "reply", "approved"]),
      count,
    }),
    holds: z.strictObject({ postId: id, reason: z.literal("legal-hold") }),
    notifications: z.strictObject({
      id,
      scopeId: id,
      eventId: id,
      topicId: id,
      recipientId: id,
      state: z.enum(["pending", "delivered", "cancelled"]),
    }),
  },
  controls: {
    inspect: {
      kind: "inspection",
      input: z.strictObject({ scopeId: id, selector: z.string().min(1).max(128), ids: refs }),
      output: snapshot,
    },
    fault: {
      kind: "fault",
      input: z.strictObject({
        point: z.enum([
          "topic-before-commit",
          "response-after-commit",
          "worker-after-inbox-commit",
          "bytes-before-complete",
          "association-before-commit",
          "restructure-before-commit",
          "privacy-after-batch",
          "hook-timeout",
          "hook-invalid-output",
        ]),
        action: z.enum(["arm", "clear"]),
        operationId: z.string().min(1).max(128),
      }),
      output: z.strictObject({ armed: z.boolean() }),
    },
    barrier: {
      kind: "fault",
      input: z.strictObject({
        requestIds: z.array(z.string()).min(2).max(25),
        winnerRequestId: z.string(),
        phase: z.enum(["before-cas", "after-receipt-lock"]),
      }),
      output: z.strictObject({ ready: z.literal(true) }),
    },
    restart: {
      kind: "worker",
      input: z.strictObject({ process: z.enum(["api", "worker"]), clock: time }),
      output: z.strictObject({ ready: z.literal(true) }),
    },
    rebuild: {
      kind: "worker",
      input: z.strictObject({ scopeId: id, projectionVersion: version }),
      output: z.strictObject({ queued: z.literal(true) }),
    },
    drain: {
      kind: "worker",
      input: z.strictObject({
        channel: z.enum(["notifications", "mail", "projection", "cleanup", "privacy"]),
        maxJobs: z.int().min(1).max(100),
        now: time,
      }),
      output: z.strictObject({
        completed: count,
        suppressed: count,
        crashed: count,
        uncertain: count,
      }),
    },
    hook: {
      kind: "provider",
      input: z.strictObject({
        hookId: z.enum([
          "JH-trust",
          "JH-abuse",
          "JH-digest",
          "JH-render",
          "JH-restructure",
          "JH-privacy",
          "JH-email",
          "JH-ranking",
        ]),
        mode: z.enum(["reference", "unavailable", "invalid-result", "timeout"]),
      }),
      output: z.strictObject({ configured: z.literal(true) }),
    },
    clock: {
      kind: "clock",
      input: z.strictObject({ now: time }),
      output: z.strictObject({ now: time }),
    },
    mail: {
      kind: "provider",
      input: z.strictObject({
        mode: z.enum(["accept", "reject-before-accept", "accept-lose-ack", "reconcile-accepted"]),
        deliveryId: id,
      }),
      output: z.strictObject({ configured: z.literal(true) }),
    },
  },
};

/** Human-reviewable policy declarations; not executable authorization predicates. */
export const discourseOperationPolicies: Record<string, string> = {
  register: "Public; exact configured Origin; no role or membership bootstrap.",
  login: "Public; exact configured Origin; verified credentials; no scope grants.",
  getSession: "Current durable session; application cookie only.",
  logout: "Current session, exact Origin and CSRF; invalidate persistent session.",
  putMembership: "Current workspace administrator; same-scope group/principal; no self escalation.",
  putGrant: "Current workspace administrator; same-scope category/group.",
  createTopic: "Current workspace member with category write grant; private/foreign category 404.",
  getTopic: "Current workspace and category read grant; inaccessible/absent 404.",
  listTopics: "Current workspace member; category access before keyset/limit.",
  reply: "Current category write grant; open topic; server-established author.",
  listPosts: "Current category read grant; ordinary hidden/removed text redacted.",
  editPost: "Current category write grant plus author or moderator; post CAS.",
  postHistory:
    "Current category read grant; hidden text moderator only; ordinary removed history empty.",
  transitionTopic: "Current same-scope moderator with category access; finite transitions and CAS.",
  transitionPost: "Current same-scope moderator with category access; finite transitions and CAS.",
  putSubscription:
    "Principal must equal session principal; current category access on write and replay.",
  inbox:
    "Session principal only; current membership/access/preferences before every projection/page.",
  stageFile: "Current workspace member; server-established owner; finite MIME/size/hash.",
  putFileBytes:
    "Current file owner in scope; staged or recoverable incomplete file; hash/size/MIME verified.",
  attachFile: "Current file owner plus current parent category write grant; same-scope file/post.",
  downloadFile:
    "Attached file only; current parent category read grant on every byte request; proxy only.",
  flagPost: "Current category read grant; visible post; unique active reporter/post identity.",
  reviewQueue: "Current same-scope moderator; authorized category filtering before paging.",
  reviewFlag: "Current same-scope moderator with category access; flag CAS; audited action.",
  search:
    "Current workspace/category policy before matching/snippets/limit; authoritative removal check.",
  audit: "Current same-scope moderator with category access; safe metadata only.",
  evaluateTrust: "Current workspace administrator; trusted server activity only; no role grants.",
  adjudicate:
    "Current post author may evaluate/appeal; moderator may override; category access required.",
  scheduleDigest:
    "Self or current workspace administrator; current preferences and public eligible candidates.",
  getDigest:
    "Self or current workspace administrator; redact newly inaccessible selection before return.",
  render:
    "Current category write grant; mentions intersect current eligible principals; pure result only.",
  restructure:
    "Current moderator on both open topics in same scope/category; lock/recheck both versions.",
  privacy:
    "Self or current workspace administrator; authoritative holds/retention; no foreign text export.",
  inboundEmail:
    "Authenticated original-byte source/timestamp; exact confirmed sender/thread mapping and current posting grant.",
  rank: "Current workspace member; features and result subset from current readable candidates only.",
};

export const DISCOURSE_FIXTURE_ORIGIN = "http://127.0.0.1:4321";
export const DISCOURSE_FIXTURE_COOKIE = `jeeves_session_${createHash("sha256").update(DISCOURSE_FIXTURE_ORIGIN).digest("hex").slice(0, 32)}`;
/** JSON-compatible OpenAPI 3.1 document exported solely from acceptance-side schemas. */
export function discourseOpenApi() {
  const schema = (value: z.ZodType) => {
    const { $schema: _, ...result } = z.toJSONSchema(value);
    return result;
  };
  const paths: Record<string, Record<string, unknown>> = {};
  for (const operation of operations) {
    const parameters: unknown[] = [];
    for (const part of ["params", "query"] as const) {
      const object = schema(operation.input[part]) as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
      for (const [name, property] of Object.entries(object.properties ?? {}))
        parameters.push({
          name,
          in: part === "params" ? "path" : "query",
          required: part === "params" || !!object.required?.includes(name),
          schema: property,
        });
    }
    if (operation.idempotency === "required")
      parameters.push({ $ref: "#/components/parameters/IdempotencyKey" });
    if (operation.method !== "GET" && operation.authentication !== "provider") {
      parameters.push({ $ref: "#/components/parameters/Origin" });
      if (operation.authentication === "session")
        parameters.push({ $ref: "#/components/parameters/CsrfToken" });
    }
    if (operation.authentication === "provider")
      for (const name of ["X-Mail-Timestamp", "X-Mail-Signature"])
        parameters.push({
          name,
          in: "header",
          required: true,
          schema: { type: "string", minLength: 1, maxLength: 256 },
        });
    const responses: Record<string, unknown> = {};
    const commonHeaders = {
      "Cache-Control": { $ref: "#/components/headers/CacheControl" },
      "X-Correlation-Id": { $ref: "#/components/headers/CorrelationId" },
    };
    for (const [status, response] of Object.entries(operation.responses)) {
      const headers: Record<string, unknown> = { ...commonHeaders };
      const extra = operation.responseHeaders?.[+status];
      if (extra)
        for (const [name, property] of Object.entries(schema(extra).properties ?? {}))
          headers[name] = { schema: property };
      responses[status] = {
        description: "Fixed success contract; subject to current authorization",
        headers,
        ...(+status === 204
          ? {}
          : operation.id === "downloadFile"
            ? {
                content: { "text/plain": { schema: { type: "string", format: "binary" } } },
                "x-fixture-descriptor": schema(response),
              }
            : { content: { "application/json": { schema: schema(response) } } }),
      };
    }
    for (const status of operation.errors)
      responses[status] = {
        description: "Shared safe error; see protocol v1",
        headers: {
          ...commonHeaders,
          ...(status === 409 && operation.idempotency === "required"
            ? {
                "Retry-After": {
                  schema: { type: "string", const: "1" },
                  description: "Required only for COMMAND_IN_PROGRESS",
                },
              }
            : {}),
        },
        content: { "application/json": { schema: schema(benchmarkErrorSchema) } },
      };
    const pathItem = paths[operation.path] ?? {};
    paths[operation.path] = pathItem;
    pathItem[operation.method.toLowerCase()] = {
      operationId: operation.id,
      "x-access-policy": discourseOperationPolicies[operation.id],
      security:
        operation.authentication === "public"
          ? []
          : operation.authentication === "provider"
            ? [{ MailSignature: [] }]
            : [{ Session: [] }],
      parameters,
      ...(operation.method === "GET"
        ? {}
        : {
            requestBody: {
              required: true,
              content: { "application/json": { schema: schema(operation.input.body) } },
            },
          }),
      responses,
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Independent Jeeves Discourse-core v1 acceptance contract",
      version: "v1",
      description:
        "P61b contract only. Application absent/not run. No upstream API compatibility claim. Scope/access/hook policy is in README.md and hooks.md.",
    },
    servers: [{ url: DISCOURSE_FIXTURE_ORIGIN }],
    paths,
    components: {
      ...benchmarkProtocolComponents(),
      securitySchemes: {
        Session: benchmarkSessionSecurityScheme(DISCOURSE_FIXTURE_COOKIE),
        MailSignature: {
          type: "apiKey",
          in: "header",
          name: "X-Mail-Signature",
          description:
            "HMAC-SHA256 over timestamp + dot + original body bytes; see hooks.md; fixture-only secret supplied by test support",
        },
      },
    },
  };
}

/** Pure hook seam contracts; trusted snapshots are built by the command/query owner. */
const hookContext = { scopeId: id, principalId: id, policyVersion: z.string().min(1).max(80) };
const hookCandidates = z
  .array(z.strictObject({ topicId: id, replies: count, lastActivity: time }))
  .max(100);
export const discourseHookContracts = {
  "JH-trust": {
    input: z.strictObject({
      ...hookContext,
      currentLevel: z.int().min(0).max(2),
      reads: count,
      replies: count,
      approvals: count,
      windowStart: time,
      windowEnd: time,
      override: z.int().min(0).max(2).nullable(),
    }),
    result: z.strictObject({ level: z.int().min(0).max(2), reasons: trust.shape.reasons }),
  },
  "JH-abuse": {
    input: z.strictObject({
      ...hookContext,
      postId: id,
      text,
      historyDecisions: z.array(z.enum(["allow", "review", "reject"])).max(20),
      action: z.enum(["evaluate", "appeal", "override-allow"]),
      moderatorAuthorized: z.boolean(),
    }),
    result: z.strictObject({
      decision: adjudication.shape.decision,
      reason: adjudication.shape.reason,
    }),
  },
  "JH-digest": {
    input: z.strictObject({
      ...hookContext,
      timezone: z.literal("America/Chicago"),
      windowStart: time,
      windowEnd: time,
      eligibleTopicIds: refs,
    }),
    result: z.strictObject({ topicIds: refs.max(20), windowIdentity: z.string().min(1).max(200) }),
  },
  "JH-render": {
    input: z.strictObject({
      ...hookContext,
      source: z.string().min(1).max(4096),
      formatVersion: z.literal("safe-v1"),
      eligibleMentionIds: refs,
    }),
    result: rendered,
  },
  "JH-restructure": {
    input: z.strictObject({
      ...hookContext,
      action: z.enum(["split", "merge"]),
      sourceTopicId: id,
      targetTopicId: id,
      postIds: refs.min(1),
      sourceVersion: version,
      targetVersion: version,
      subscriptionPrincipalIds: refs,
    }),
    result: z.strictObject({
      sourceTopicId: id,
      targetTopicId: id,
      postIds: refs.min(1),
      subscriptionPrincipalIds: refs,
    }),
  },
  "JH-privacy": {
    input: z.strictObject({
      ...hookContext,
      subjectId: id,
      kind: z.enum(["export", "erase"]),
      subjectPostIds: refs,
      legalHoldPostIds: refs,
      pendingDeliveryIds: refs,
      progressId: id.nullable(),
    }),
    result: z.strictObject({
      erasePostIds: refs,
      exportPostIds: refs,
      retainedPostIds: refs,
      cancelDeliveryIds: refs,
      retainedReason: privacy.shape.retainedReason,
    }),
  },
  "JH-email": {
    input: z.strictObject({
      scopeId: id,
      authenticatedSourceId: z.literal("fixture-mail"),
      messageId: z.string().min(1).max(200),
      verifiedBodySha256: attachment.shape.sha256,
      senderCandidates: refs,
      topicCandidates: refs,
      rawBase64: z.string().min(1).max(1400000),
    }),
    result: z.strictObject({
      senderId: id,
      topicId: id,
      text: z.string().min(1).max(20000),
      attachmentIds: refs.max(5),
    }),
  },
  "JH-ranking": {
    input: z.strictObject({
      ...hookContext,
      candidates: hookCandidates,
      asOf: time,
      projectionVersion: version,
      limit: z.int().min(1).max(100),
    }),
    result: ranking,
  },
};
export function discourseHookSchemas() {
  return Object.fromEntries(
    Object.entries(discourseHookContracts).map(([name, contract]) => [
      name,
      Object.fromEntries(
        Object.entries(contract).map(([part, value]) => {
          const { $schema: _, ...result } = z.toJSONSchema(value);
          return [part, result];
        }),
      ),
    ]),
  );
}

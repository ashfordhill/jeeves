/** Independent help-desk acceptance contracts. No application, clock calculator or hook evaluator. */
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
const name = z.string().min(1).max(200);
const text = z.string().min(1).max(20000);
const time = z.iso.datetime();
const count = z.int().min(0).max(1000000);
const refs = z.array(id).max(100);
const empty = z.strictObject({});
const scoped = z.strictObject({ scopeId: id });
const expected = { expectedVersion: version };
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const channels = z.array(z.enum(["inbox", "email"])).max(2);
const state = z.enum(["new", "open", "pending", "resolved", "closed"]);
const ticket = z.strictObject({
  id,
  customerId: id,
  organizationId: id,
  groupId: id,
  assigneeId: id.nullable(),
  title: name,
  state,
  priority: z.enum(["normal", "high"]),
  version,
});
const article = z.strictObject({
  id,
  ticketId: id,
  authorId: id,
  authorKind: z.enum(["customer", "agent"]),
  visibility: z.enum(["public", "internal"]),
  text,
  at: time,
  attachmentIds: refs,
  version,
});
const membership = z.strictObject({
  principalId: id,
  groupId: id,
  state: z.enum(["active", "revoked"]),
  capability: z.enum(["read", "write", "supervise"]),
  version,
});
const organization = z.strictObject({ id, name, shareTickets: z.boolean(), version });
const group = z.strictObject({ id, name, version });
const calendar = z.strictObject({
  id,
  version,
  zone: z.literal("America/Chicago"),
  name,
  weekly: z
    .array(
      z.strictObject({
        weekday: z.int().min(1).max(7),
        start: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
        end: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
      }),
    )
    .min(1)
    .max(14),
  holidays: z.array(z.iso.date()).max(366),
  durationMeaning: z.literal("elapsed-in-local-working-interval"),
});
const sla = z.strictObject({
  id,
  version,
  calendarId: id,
  calendarVersion: version,
  firstResponseMinutes: z.int().min(1).max(10080),
});
const deadline = z.strictObject({
  id,
  ticketId: id,
  calendarId: id,
  calendarVersion: version,
  slaPolicyId: id,
  slaVersion: version,
  startedAt: time,
  dueAt: time,
  generation: version,
  version,
  state: z.enum(["running", "satisfied", "cancelled", "escalated"]),
  satisfiedAt: time.nullable(),
  cancelledAt: time.nullable(),
});
const attachment = z.strictObject({
  id,
  ownerId: id,
  articleId: id.nullable(),
  state: z.enum(["staged", "validated", "attached", "orphan", "quarantined", "deleted"]),
  mime: z.enum(["text/plain", "image/png"]),
  size: z.int().min(1).max(10485760),
  sha256: hash,
  version,
});
const bytes = z.strictObject({
  fixtureFile: name,
  mime: z.literal("text/plain"),
  size: z.int().min(1).max(10485760),
  sha256: hash,
});
const searchItem = z.strictObject({ ticketId: id, articleId: id, title: name, snippet: text });
const audit = z.strictObject({ id, ticketId: id, actorId: id, action: name, at: time });
const notification = z.strictObject({
  id,
  ticketId: id,
  articleId: id,
  recipientId: id,
  excerpt: text,
});
const preferences = z.strictObject({ principalId: id, channels, version });
const condition = z.strictObject({
  field: z.enum(["priority", "state"]),
  equals: z.enum(["normal", "high", "new", "open", "pending"]),
});
const action = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("set-priority"), value: z.enum(["normal", "high"]) }),
  z.strictObject({ kind: z.literal("assign"), principalId: id, groupId: id }),
]);
const rule = z.strictObject({
  id,
  version,
  priority: z.int().min(0).max(1000),
  conditions: z.array(condition).min(1).max(10),
  actions: z.array(action).min(1).max(5),
});
const routing = z.strictObject({
  ticketId: id,
  appliedRuleIds: refs.max(5),
  actionCount: z.int().min(0).max(5),
  ticketVersion: version,
});
const conversation = z.strictObject({
  decisionId: id,
  action: z.enum(["attach", "create", "merge", "split"]),
  sourceTicketId: id,
  targetTicketId: id,
  articleIds: refs,
  sourceVersion: version,
  targetVersion: version,
  provenanceIds: refs,
  subscriberIds: refs,
});
const clockDecision = z.strictObject({
  decisionId: id,
  clockKind: z.enum(["next-response", "resolution"]),
  action: z.enum(["create", "pause", "resume", "recalculate"]),
  calendarId: id,
  calendarVersion: version,
  policyVersion: version,
  dueAt: time,
  elapsedBusinessMinutes: count,
  deadlineGeneration: version,
});
const connector = z.strictObject({
  source: z.literal("crm-v1"),
  externalId: name,
  sourceRevision: version,
  state: z.enum(["applied", "stale", "reconciliation"]),
  customerId: id,
  reconciliationId: id.nullable(),
  version,
});
const knowledge = z.strictObject({
  id,
  revision: version,
  audience: z.enum(["draft", "public", "agents"]),
  title: name,
  text,
  projectionVersion: version,
});
const customValues = z.strictObject({
  severity: z.enum(["low", "critical"]),
  assetId: z.string().regex(/^ASSET-[0-9]{1,8}$/),
});
const workflow = z.strictObject({
  ticketId: id,
  schemaVersion: version,
  values: customValues,
  actions: z.array(action).max(5),
  ticketVersion: version,
});
const privacy = z.strictObject({
  id,
  subjectId: id,
  kind: z.enum(["export", "erase"]),
  status: z.enum(["ready", "complete"]),
  exportArticleIds: refs,
  eraseArticleIds: refs,
  retainedArticleIds: refs,
  retainedReason: z.enum(["legal-hold", "audit-only", "none"]),
  cancelledDeliveryIds: refs,
  version,
});
const report = z.strictObject({
  definition: z.literal("created-cohort-v1"),
  windowStart: time,
  windowEnd: time,
  ticketCount: count,
  reopenedCount: count,
  respondedCount: count,
  totalFirstResponseBusinessMinutes: count,
  asOf: time,
  timelineVersion: version,
});
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
  const authentication = options.auth ?? "session";
  const status = options.status ?? 200;
  operations.push({
    id: operationId,
    method,
    path,
    authentication,
    idempotency:
      method === "GET" || authentication === "public"
        ? "none"
        : authentication === "provider"
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
const jsonHeaders = z.object({ "content-type": z.literal("application/json") });
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
    headers: jsonHeaders.extend({ "set-cookie": name }),
  },
);
op("login", "POST", "/api/session", benchmarkCredentialsSchema, benchmarkSessionIdentitySchema, {
  params: empty,
  auth: "public",
  errors: [400, 401, 403, 503],
  headers: jsonHeaders.extend({ "set-cookie": name }),
});
op("getSession", "GET", "/api/session", z.null(), benchmarkSessionIdentitySchema, {
  params: empty,
  errors: [401],
});
op("logout", "DELETE", "/api/session", empty, z.null(), {
  params: empty,
  status: 204,
  errors: [401, 403, 409],
  headers: z.object({ "set-cookie": name }),
});
op(
  "putOrganization",
  "PUT",
  `${route}/admin/organizations/{organizationId}`,
  z.strictObject({ name, shareTickets: z.boolean(), ...expected }),
  organization,
  { params: params("organizationId") },
);
op("listGroups", "GET", `${route}/groups`, z.null(), benchmarkPageSchema(group), {
  query: benchmarkPageQuerySchema,
});
op(
  "putMembership",
  "PUT",
  `${route}/admin/memberships/{principalId}`,
  z.strictObject({
    groupId: id,
    state: membership.shape.state,
    capability: membership.shape.capability,
    ...expected,
  }),
  membership,
  { params: params("principalId") },
);
op(
  "createTicket",
  "POST",
  `${route}/tickets`,
  z.strictObject({ organizationId: id, groupId: id, title: name, text }),
  z.strictObject({ ticket, article, deadline }),
  { status: 201 },
);
op("getTicket", "GET", `${route}/tickets/{ticketId}`, z.null(), ticket, {
  params: params("ticketId"),
});
op("listTickets", "GET", `${route}/tickets`, z.null(), benchmarkPageSchema(ticket), {
  query: benchmarkPageQuerySchema,
});
op(
  "addArticle",
  "POST",
  `${route}/tickets/{ticketId}/articles`,
  z.strictObject({ text, visibility: article.shape.visibility, ...expected }),
  z.strictObject({ article, ticketVersion: version, deadline }),
  { params: params("ticketId"), status: 201 },
);
op("getArticle", "GET", `${route}/articles/{articleId}`, z.null(), article, {
  params: params("articleId"),
});
op(
  "listArticles",
  "GET",
  `${route}/tickets/{ticketId}/articles`,
  z.null(),
  benchmarkPageSchema(article),
  { params: params("ticketId"), query: benchmarkPageQuerySchema },
);
op(
  "exportConversation",
  "GET",
  `${route}/tickets/{ticketId}/conversation-export`,
  z.null(),
  z.strictObject({ ticketId: id, articles: z.array(article).max(100) }),
  { params: params("ticketId") },
);
op(
  "assignTicket",
  "POST",
  `${route}/tickets/{ticketId}/assignment`,
  z.strictObject({ groupId: id, assigneeId: id, ...expected }),
  ticket,
  { params: params("ticketId") },
);
op(
  "transitionTicket",
  "POST",
  `${route}/tickets/{ticketId}/transitions`,
  z.strictObject({ to: state, ...expected }),
  z.strictObject({ ticket, deadline }),
  { params: params("ticketId") },
);
op(
  "putCalendar",
  "PUT",
  `${route}/admin/calendars/{calendarId}/versions/{calendarVersion}`,
  calendar.omit({ id: true, version: true }),
  calendar,
  {
    params: z.strictObject({ scopeId: id, calendarId: id, calendarVersion: version }),
    status: 201,
  },
);
op(
  "putSlaPolicy",
  "PUT",
  `${route}/admin/sla-policies/{slaPolicyId}/versions/{slaVersion}`,
  sla.omit({ id: true, version: true }),
  sla,
  { params: z.strictObject({ scopeId: id, slaPolicyId: id, slaVersion: version }), status: 201 },
);
op(
  "previewDeadline",
  "POST",
  `${route}/admin/deadline-previews`,
  z.strictObject({
    calendarId: id,
    calendarVersion: version,
    slaPolicyId: id,
    slaVersion: version,
    startedAt: time,
  }),
  z.strictObject({
    dueAt: time,
    businessMinutes: z.int().min(1).max(10080),
    calendarVersion: version,
    slaVersion: version,
  }),
);
op("getDeadline", "GET", `${route}/tickets/{ticketId}/first-response`, z.null(), deadline, {
  params: params("ticketId"),
});
op(
  "escalationBacklog",
  "GET",
  `${route}/admin/escalation-backlog`,
  z.null(),
  z.strictObject({ due: count, oldestDueAt: time.nullable(), exhausted: count, asOf: time }),
);
op(
  "putRoutingRule",
  "PUT",
  `${route}/admin/routing-rules/{ruleId}`,
  rule.omit({ id: true, version: true }).extend(expected),
  rule,
  { params: params("ruleId") },
);
op(
  "routeTicket",
  "POST",
  `${route}/tickets/{ticketId}/routing`,
  z.strictObject({
    mode: z.enum(["first", "all"]),
    eventId: id,
    ruleVersion: version,
    ...expected,
  }),
  routing,
  { params: params("ticketId") },
);
op(
  "stageFile",
  "POST",
  `${route}/files`,
  z.strictObject({ mime: attachment.shape.mime, size: attachment.shape.size, sha256: hash }),
  attachment,
  { status: 201 },
);
op(
  "putFileBytes",
  "PUT",
  `${route}/files/{fileId}/bytes`,
  z.strictObject({ base64: z.string().min(1).max(14000000) }),
  attachment,
  { params: params("fileId") },
);
op(
  "attachFile",
  "POST",
  `${route}/articles/{articleId}/files`,
  z.strictObject({ fileId: id, ...expected }),
  attachment,
  { params: params("articleId") },
);
op("getFile", "GET", `${route}/files/{fileId}`, z.null(), attachment, { params: params("fileId") });
op("downloadFile", "GET", `${route}/files/{fileId}/bytes`, z.null(), bytes, {
  params: params("fileId"),
  headers: z.object({
    "content-type": z.literal("text/plain"),
    "content-length": z.string().regex(/^\d+$/),
    "content-disposition": name,
  }),
});
op("search", "GET", `${route}/search`, z.null(), benchmarkPageSchema(searchItem), {
  query: benchmarkPageQuerySchema.extend({ q: name }),
});
op("audit", "GET", `${route}/tickets/{ticketId}/audit`, z.null(), benchmarkPageSchema(audit), {
  params: params("ticketId"),
  query: benchmarkPageQuerySchema,
});
op(
  "putPreferences",
  "PUT",
  `${route}/principals/{principalId}/preferences`,
  z.strictObject({ channels, ...expected }),
  preferences,
  { params: params("principalId") },
);
op(
  "inbox",
  "GET",
  `${route}/principals/{principalId}/inbox`,
  z.null(),
  benchmarkPageSchema(notification),
  { params: params("principalId"), query: benchmarkPageQuerySchema },
);
op(
  "inboundEmail",
  "POST",
  `${route}/hooks/inbound-email`,
  z.strictObject({ messageId: name, rawBase64: z.string().min(1).max(16000) }),
  z.strictObject({ ticketId: id, articleId: id, sourceReceiptId: id }),
  { auth: "provider", status: 201 },
);
op(
  "conversation",
  "POST",
  `${route}/hooks/conversations`,
  z.strictObject({
    action: conversation.shape.action,
    messageReferences: z.array(name).max(20),
    sourceTicketId: id,
    targetTicketId: id,
    articleIds: refs.min(1),
    sourceVersion: version,
    targetVersion: version,
  }),
  conversation,
);
op(
  "additionalClock",
  "POST",
  `${route}/tickets/{ticketId}/hooks/clocks`,
  z.strictObject({
    clockKind: clockDecision.shape.clockKind,
    action: clockDecision.shape.action,
    calendarId: id,
    calendarVersion: version,
    policyVersion: version,
    ...expected,
  }),
  clockDecision,
  { params: params("ticketId") },
);
op(
  "syncCustomer",
  "POST",
  `${route}/hooks/customer-sync`,
  z.strictObject({
    source: z.literal("crm-v1"),
    externalId: name,
    sourceRevision: version,
    organizationId: id,
    displayName: name,
  }),
  connector,
  { auth: "provider" },
);
op(
  "publishKnowledge",
  "POST",
  `${route}/hooks/knowledge/{knowledgeId}/publication`,
  z.strictObject({ audience: knowledge.shape.audience, revision: version, ...expected }),
  knowledge,
  { params: params("knowledgeId") },
);
op("getKnowledge", "GET", `${route}/hooks/knowledge/{knowledgeId}`, z.null(), knowledge, {
  params: params("knowledgeId"),
  auth: "public",
});
op("searchKnowledge", "GET", `${route}/hooks/knowledge`, z.null(), benchmarkPageSchema(knowledge), {
  query: benchmarkPageQuerySchema.extend({ q: name }),
  auth: "public",
});
op(
  "customWorkflow",
  "POST",
  `${route}/tickets/{ticketId}/hooks/workflow`,
  z.strictObject({ schemaVersion: version, values: customValues, ...expected }),
  workflow,
  { params: params("ticketId") },
);
op(
  "privacy",
  "POST",
  `${route}/hooks/privacy`,
  z.strictObject({ subjectId: id, kind: privacy.shape.kind, progressId: id.nullable() }),
  privacy,
);
op(
  "report",
  "POST",
  `${route}/hooks/reports`,
  z.strictObject({
    definition: z.literal("created-cohort-v1"),
    groupIds: refs.min(1).max(10),
    windowStart: time,
    windowEnd: time,
    timelineVersion: version,
  }),
  report,
);

const hookIds = [
  "JH-inbound-email",
  "JH-conversation",
  "JH-sla-extension",
  "JH-customer-connector",
  "JH-knowledge",
  "JH-custom-workflow",
  "JH-customer-privacy",
  "JH-reporting",
] as const;
const snapshot = z
  .strictObject({
    tickets: count.optional(),
    articles: count.optional(),
    deadlines: count.optional(),
    receipts: count.optional(),
    intents: count.optional(),
    audits: count.optional(),
    inbox: count.optional(),
    inboxReceipts: count.optional(),
    deliveries: count.optional(),
    suppressed: count.optional(),
    unknownDeliveries: count.optional(),
    escalations: count.optional(),
    escalationReceipts: count.optional(),
    duplicateClaims: count.optional(),
    fencedClaims: count.optional(),
    due: count.optional(),
    links: count.optional(),
    objects: count.optional(),
    orphans: count.optional(),
    hookWrites: count.optional(),
    reconciliationItems: count.optional(),
    mutationWinners: count.optional(),
    versionConflicts: count.optional(),
    ruleApplications: count.optional(),
    ruleActions: count.optional(),
    versions: z.array(version).max(100).optional(),
    states: z.array(name).max(100).optional(),
    dueAts: z.array(time).max(100).optional(),
    articleIds: refs.optional(),
    ticketIds: refs.optional(),
    retainedArticleIds: refs.optional(),
    auditActorIds: refs.optional(),
    forbiddenTextOccurrences: count.optional(),
    cancelledDeliveries: count.optional(),
    sourceReceipts: count.optional(),
  })
  .refine((s) => Object.keys(s).length > 0);
export const zammadFixtureContract: BenchmarkFixtureContract = {
  operations,
  datasets: {
    principals: z.strictObject({
      id,
      scopeId: id,
      email: z.email(),
      role: z.enum(["customer", "agent", "supervisor", "administrator"]),
      version,
    }),
    organizations: organization.extend({ scopeId: id }),
    groups: group.extend({ scopeId: id }),
    agentMemberships: membership.extend({ scopeId: id }),
    customerMemberships: z.strictObject({
      scopeId: id,
      principalId: id,
      organizationId: id,
      state: z.enum(["active", "revoked"]),
      version,
    }),
    tickets: ticket.extend({ scopeId: id, createdAt: time }),
    articles: article.extend({ scopeId: id }),
    calendars: calendar.extend({ scopeId: id }),
    slaPolicies: sla.extend({ scopeId: id }),
    deadlines: deadline.extend({ scopeId: id }),
    additionalClocks: z.strictObject({
      id,
      scopeId: id,
      ticketId: id,
      clockKind: z.literal("resolution"),
      calendarId: id,
      calendarVersion: version,
      policyVersion: version,
      durationBusinessMinutes: count,
      elapsedBusinessMinutes: count,
      startedAt: time,
      dueAt: time,
      generation: version,
      state: z.enum(["running", "paused", "satisfied"]),
      version,
    }),
    attachments: attachment.extend({ scopeId: id }),
    rules: rule.extend({ scopeId: id }),
    preferences: preferences.extend({ scopeId: id }),
    knowledge: knowledge.extend({ scopeId: id }),
    messageMappings: z.strictObject({ scopeId: id, messageId: name, ticketIds: refs.max(5) }),
    holds: z.strictObject({ scopeId: id, articleId: id, reason: z.literal("legal-hold") }),
    notifications: z.strictObject({
      id,
      scopeId: id,
      ticketId: id,
      articleId: id,
      recipientId: id,
      state: z.enum(["pending", "delivered", "suppressed"]),
    }),
    projections: z.strictObject({ scopeId: id, version, asOf: time }),
    customerSources: z.strictObject({
      scopeId: id,
      source: z.literal("crm-v1"),
      externalId: name,
      sourceRevision: version,
      customerId: id,
      organizationId: id,
      displayName: name,
      version,
    }),
    reportTimeline: z.strictObject({
      groupId: id,
      scopeId: id,
      ticketId: id,
      eventId: id,
      kind: z.enum([
        "created",
        "public-response",
        "internal-note",
        "pending",
        "resolved",
        "reopened",
      ]),
      at: time,
      calendarId: id,
      calendarVersion: version,
      timelineVersion: version,
    }),
  },
  controls: {
    localCustomerEdit: {
      kind: "fault",
      input: z.strictObject({
        scopeId: id,
        customerId: id,
        expectedVersion: version,
        displayName: name,
      }),
      output: z.strictObject({ version }),
    },
    inspect: {
      kind: "inspection",
      input: z.strictObject({ scopeId: id, selector: z.string().min(1).max(128), ids: refs }),
      output: snapshot,
    },
    fault: {
      kind: "fault",
      input: z.strictObject({
        point: z.enum([
          "ticket-before-initial-article",
          "ingest-before-commit",
          "response-after-commit",
          "transition-before-commit",
          "worker-after-escalation-commit",
          "worker-before-escalation-commit",
          "worker-after-inbox-commit",
          "bytes-before-complete",
          "association-before-commit",
          "conversation-before-commit",
          "clock-before-commit",
          "connector-before-commit",
          "privacy-after-batch",
          "hook-timeout",
          "hook-invalid-output",
        ]),
        operationId: name,
        action: z.enum(["arm", "clear"]),
      }),
      output: z.strictObject({ armed: z.boolean() }),
    },
    barrier: {
      kind: "fault",
      input: z.strictObject({
        requestIds: z.array(name).min(1).max(25),
        winnerRequestId: name,
        phase: z.enum(["before-cas", "after-receipt-lock", "deadline-lock-before-recheck"]),
      }),
      output: z.strictObject({ ready: z.literal(true) }),
    },
    clock: {
      kind: "clock",
      input: z.strictObject({ now: time }),
      output: z.strictObject({ now: time }),
    },
    restart: {
      kind: "worker",
      input: z.strictObject({ process: z.enum(["api", "worker"]), now: time }),
      output: z.strictObject({ ready: z.literal(true) }),
    },
    worker: {
      kind: "worker",
      input: z.strictObject({ action: z.enum(["stop", "start"]), now: time }),
      output: z.strictObject({ running: z.boolean() }),
    },
    rebuild: {
      kind: "worker",
      input: z.strictObject({
        scopeId: id,
        projectionVersion: version,
        channel: z.enum(["tickets", "knowledge", "reports"]),
      }),
      output: z.strictObject({ queued: z.literal(true) }),
    },
    drain: {
      kind: "worker",
      input: z.strictObject({
        channel: z.enum([
          "deadlines",
          "notifications",
          "mail",
          "projection",
          "cleanup",
          "routing",
          "privacy",
          "connector",
        ]),
        maxJobs: z.int().min(1).max(100),
        now: time,
      }),
      output: z.strictObject({
        completed: count,
        suppressed: count,
        crashed: count,
        remaining: count,
      }),
    },
    claimDeadline: {
      kind: "worker",
      input: z.strictObject({
        deadlineId: id,
        generation: version,
        workerId: name,
        leaseToken: version,
        action: z.enum(["claim", "commit", "expire-lease"]),
        now: time,
      }),
      output: z.strictObject({
        state: z.enum(["claimed", "committed", "stale", "suppressed", "lease-expired"]),
      }),
    },
    hook: {
      kind: "provider",
      input: z.strictObject({
        hookId: z.enum(hookIds),
        mode: z.enum(["reference", "unavailable", "timeout", "invalid-result"]),
      }),
      output: z.strictObject({ configured: z.literal(true) }),
    },
    mail: {
      kind: "provider",
      input: z.strictObject({
        mode: z.enum(["accept", "accept-lose-ack", "reconcile-accepted"]),
        deliveryId: id,
      }),
      output: z.strictObject({ configured: z.literal(true) }),
    },
  },
};

/** Prose declarations are independently reviewed policy, not runtime predicates. */
export const zammadOperationPolicies: Record<string, string> = {
  register: "Exact Origin; credentials only. No role, scope or membership bootstrap.",
  login: "Exact Origin, verified credentials; configured application cookie.",
  getSession: "Current durable application session; no cross-application cookie authority.",
  logout: "Current session, exact Origin and CSRF; persistent invalidation.",
  putOrganization:
    "Same-scope administrator only; explicit organization sharing, default own tickets.",
  listGroups:
    "Current memberships before stable ID paging; customers see only their ingress group.",
  putMembership: "Same-scope administrator; current principal/group; no self promotion.",
  createTicket:
    "Current customer organization and authorized ingress group; server author/customer and fixed public initial article. Atomic ticket/article/deadline/audit/receipt/intent.",
  getTicket:
    "Current scope and own ticket, explicit shared organization, or current group read grant; inaccessible 404.",
  listTickets:
    "Same current ticket policy before keyset limit; createdAt then ID; no unscoped total.",
  addArticle:
    "Current group write grant for agent public/internal; customer own writable ticket public only, internal 403. Immutable author/time, ticket CAS; closed rejects.",
  getArticle: "Current ticket read AND article visibility; customer internal 404.",
  listArticles:
    "Current ticket policy and article visibility before at/ID keyset limit; no hidden IDs/counts.",
  exportConversation:
    "Current ticket read and per-article projection; bounded public customer export excludes internal text/IDs/files.",
  assignTicket:
    "Current write/supervise grant in source AND target group; same scope, current eligible assignee; lock ticket then recheck memberships/CAS. Replay reauthorizes.",
  transitionTicket:
    "Current group write grant, finite lifecycle and CAS; no closed-to-open; rollback includes deadline/audit. Pending/internal do not pause; close cancels unmet; reopen creates no clock.",
  putCalendar:
    "Same-scope administrator; append immutable version only; reject invalid/overlapping intervals; existing snapshots unchanged.",
  putSlaPolicy:
    "Same-scope administrator; immutable calendar reference and positive duration; append version; never rewrite current deadlines.",
  previewDeadline:
    "Same-scope supervisor/admin; exact immutable calendar/SLA versions agree; elapsed working time only; no domain writes.",
  getDeadline: "Current ticket read; immutable schedule generation and calendar/SLA references.",
  escalationBacklog:
    "Same-scope supervisor/admin; current group-scoped due aggregate; explicitly late while worker unavailable.",
  putRoutingRule:
    "Same-scope admin; allowlisted predicates/actions, eligible assignment, no role/access changes or scripts; CAS.",
  routeTicket:
    "Current group write; snapshot version; priority ascending then rule ID; first or all, at most five actions and once per rule/event; no recursive rerun.",
  stageFile:
    "Current scoped principal; server owner; inspected MIME/size/hash; no public object URL.",
  putFileBytes:
    "Current owner and scope; validate byte length/MIME/hash; incomplete/quarantine unavailable.",
  attachFile:
    "Current owner plus current article write/visibility; same-scope validated file; article CAS; association changes article version only.",
  getFile:
    "Current parent ticket AND article visibility, attached only; internal/foreign/partial 404.",
  downloadFile:
    "Authorize current parent ticket/article for every proxied byte request, including prior references; no long-lived URL bypass.",
  search:
    "Current scope/ticket/article policy before matching/snippets/keyset at/ID; stale index is not authority; no internal match count leak.",
  audit:
    "Current ticket access; customer excludes internal actions; safe metadata only, never article text; at/ID keyset.",
  putPreferences: "Self only; current scope, CAS; no changing another principal.",
  inbox: "Self only; current ticket/article/membership/preferences before each projection/page.",
  inboundEmail:
    "Original-byte HMAC, timestamp and source account; mapped verified sender/current posting policy; stable source/message receipt. Header From is not authority.",
  conversation:
    "Same-scope supervisor with both group grants; all article visibility/provenance preserved; lock UUID order and both versions; ambiguous references reject.",
  additionalClock:
    "Same-scope supervisor with ticket access; exact policy/calendar/timeline; explicit versioned pause/resume/recalculation only.",
  syncCustomer:
    "Original-byte CRM HMAC/timestamp; configured source mapping and organization authority; revisions/field authority enforced.",
  publishKnowledge:
    "Same-scope administrator; immutable revision/current audience CAS; hook readiness before any publish write.",
  getKnowledge: "Explicit public audience only, even if session present; draft/agents 404.",
  searchKnowledge:
    "Public audience and current publication before query/snippets/paging, including rebuild.",
  customWorkflow:
    "Current group write and exact typed schema version; host validates finite actions/eligible references; no script/role changes.",
  privacy:
    "Self or same-scope privacy administrator; holds authoritative; public owned articles only for customer export, no internal or foreign content.",
  report:
    "Same-scope supervisor/admin and current grant to every requested group; bounded 31-day half-open window, no SQL; metadata aggregates only.",
};
export const ZAMMAD_FIXTURE_ORIGIN = "http://127.0.0.1:4323";
export const ZAMMAD_FIXTURE_COOKIE = `jeeves_session_${createHash("sha256").update(ZAMMAD_FIXTURE_ORIGIN).digest("hex").slice(0, 32)}`;
/** JSON-compatible OpenAPI 3.1 document exported solely from acceptance-side schemas. */
export function zammadOpenApi() {
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
      for (const name of ["X-Source-Timestamp", "X-Source-Signature"])
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
      "x-access-policy": zammadOperationPolicies[operation.id],
      security:
        operation.authentication === "public"
          ? []
          : operation.authentication === "provider"
            ? [{ SourceSignature: [] }]
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
      title: "Independent Jeeves Zammad-core v1 acceptance contract",
      version: "v1",
      description:
        "P61d contract only. Application absent/not run. No upstream API compatibility claim. Scope/access/hook policy is in README.md and hooks.md.",
    },
    servers: [{ url: ZAMMAD_FIXTURE_ORIGIN }],
    paths,
    components: {
      ...benchmarkProtocolComponents(),
      securitySchemes: {
        Session: benchmarkSessionSecurityScheme(ZAMMAD_FIXTURE_COOKIE),
        SourceSignature: {
          type: "apiKey",
          in: "header",
          name: "X-Source-Signature",
          description:
            "HMAC-SHA256 over timestamp + dot + original body bytes; see hooks.md; fixture-only secret supplied by test support",
        },
      },
    },
  };
}

const context = { scopeId: id, actorId: id, policyVersion: version, now: time };
/** Host-built trusted snapshots. These types declare seams; they implement no decisions. */
export const zammadHookContracts = {
  "JH-inbound-email": {
    input: z.strictObject({
      scopeId: id,
      authenticatedSource: z.literal("mail-v1"),
      verifiedBodySha256: hash,
      messageId: name,
      rawBytes: bytes,
      senderCandidates: refs.max(5),
      ticketCandidates: refs.max(5),
      eligibleAttachmentIds: refs.max(5),
    }),
    result: z.strictObject({
      senderId: id,
      ticketId: id,
      text,
      attachmentIds: refs.max(5),
      visibility: z.literal("public"),
      sourceMessageId: name,
    }),
  },
  "JH-conversation": {
    input: z.strictObject({
      ...context,
      action: conversation.shape.action,
      sourceTicketId: id,
      targetTicketId: id,
      sourceVersion: version,
      targetVersion: version,
      articleIds: refs.min(1),
      internalArticleIds: refs,
      messageReferences: z.array(name).max(20),
      authorizedTicketIds: refs.max(10),
      subscriberIds: refs,
    }),
    result: conversation,
  },
  "JH-sla-extension": {
    input: z.strictObject({
      ...context,
      ticketId: id,
      ticketVersion: version,
      clockKind: clockDecision.shape.clockKind,
      action: clockDecision.shape.action,
      calendar: calendar,
      timeline: z
        .array(
          z.strictObject({
            kind: z.enum(["created", "response", "pending", "resume", "resolved", "reopened"]),
            at: time,
          }),
        )
        .min(1)
        .max(100),
      elapsedBusinessMinutes: count,
      durationBusinessMinutes: z.int().min(1).max(10080),
      oldGeneration: version,
    }),
    result: clockDecision,
  },
  "JH-customer-connector": {
    input: z.strictObject({
      ...context,
      authenticatedSource: z.literal("crm-v1"),
      externalId: name,
      sourceRevision: version,
      currentSourceRevision: version,
      organizationId: id,
      customerId: id,
      displayName: name,
      localVersion: version,
      locallyOwnedFields: z.array(z.enum(["role", "email", "organizationId"])).max(3),
    }),
    result: z.strictObject({
      command: z.enum(["set-display-name", "ignore-stale", "reconcile"]),
      externalId: name,
      sourceRevision: version,
      customerId: id,
      displayName: name,
      expectedLocalVersion: version,
      reconciliationReason: z.enum(["none", "local-edit", "foreign-organization"]),
    }),
  },
  "JH-knowledge": {
    input: z.strictObject({
      ...context,
      knowledgeId: id,
      revision: version,
      audience: knowledge.shape.audience,
      title: name,
      text,
      currentVersion: version,
      authorizedAudience: z.array(z.enum(["draft", "public", "agents"])).max(3),
    }),
    result: knowledge,
  },
  "JH-custom-workflow": {
    input: z.strictObject({
      ...context,
      ticketId: id,
      ticketVersion: version,
      schemaVersion: version,
      values: customValues,
      state,
      eligibleAgentIds: refs,
      groupId: id,
      alreadyAppliedRuleIds: refs.max(5),
    }),
    result: workflow,
  },
  "JH-customer-privacy": {
    input: z.strictObject({
      ...context,
      subjectId: id,
      kind: privacy.shape.kind,
      progressId: id.nullable(),
      publicOwnedArticleIds: refs,
      internalArticleIds: refs,
      heldArticleIds: refs,
      pendingDeliveryIds: refs,
      auditRetentionDays: z.literal(365),
    }),
    result: privacy,
  },
  "JH-reporting": {
    input: z.strictObject({
      ...context,
      groupIds: refs.min(1).max(10),
      windowStart: time,
      windowEnd: time,
      timelineVersion: version,
      asOf: time,
      cohort: z
        .array(
          z.strictObject({
            ticketId: id,
            createdAt: time,
            firstResponseBusinessMinutes: count.nullable(),
            reopenEvents: count,
          }),
        )
        .max(100),
    }),
    result: report,
  },
};
export function zammadHookSchemas() {
  return Object.fromEntries(
    Object.entries(zammadHookContracts).map(([name, contract]) => [
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

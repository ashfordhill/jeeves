/** P71b completes the editable design. Nothing here runs an application or awards points. */
import type { Architecture } from "./architecture.ts";
import type {
  ArchitectureContract,
  ContractField,
  OperationOutcome,
} from "./architecture-contracts.ts";
import type { BackendOperation } from "./backend-behavior-model.ts";
import type { BackendEffect, BackendHook } from "./backend-effects-model.ts";
import type { BackendProtocolPlan } from "./backend-protocol-model.ts";
import type { DesignDocument } from "./design.ts";
import { dcRef } from "./discourse-core-data.ts";
import { discourseCoreHookContracts } from "./discourse-core-hooks-contracts.ts";
import { discourseCoreJourneys } from "./discourse-core-journeys.ts";
import { discourseCoreMechanisms } from "./discourse-core-mechanisms.ts";
import { discourseCoreReadRefinements } from "./discourse-core-refinements.ts";
import { discourseCoreTrace } from "./discourse-core-trace.ts";
import type { LayoutDocument } from "./layout.ts";

const entity = (id: string) => dcRef(`dc-${id}-entity`);
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
type Recipe = {
  procedure: BackendProtocolPlan["procedure"];
  root: string;
  records: string[];
  writes?: Record<string, string[]>;
  query?: string;
  hook?: string;
  pre: string[];
  post: string[];
};
/** Finite procedure catalog: records and algorithms are fixed, never a user expression language. */
const recipes: Record<string, Recipe> = {
  "put-membership": {
    procedure: "membership-upsert",
    root: "membership",
    records: ["group", "workspace-member"],
    writes: { membership: ["principal-id", "group-id", "state", "role", "version"] },
    pre: [
      "Current administrator; selected group and subject belong to the validated workspace. No public/self privilege bootstrap.",
    ],
    post: [
      "One scoped principal/group relation; create starts at expected version 1 then returns v2; replay preserves one relation.",
    ],
  },
  "put-grant": {
    procedure: "grant-upsert",
    root: "grant",
    records: ["category", "group"],
    writes: { grant: ["category-id", "group-id", "access", "version"] },
    pre: ["Current administrator; category and group must be in the selected scope."],
    post: [
      "Unique category/group grant; read/write includes read; expectedVersion fences upsert, no extra relationship on replay.",
    ],
  },
  "create-topic": {
    procedure: "discussion-create",
    root: "topic",
    records: ["post", "revision", "category"],
    writes: {
      topic: ["id", "scope-id", "created-at", "version", "category-id", "title", "state"],
      post: ["id", "scope-id", "created-at", "version", "topic-id", "author-id", "text", "state"],
    },
    pre: [
      "Current category write grant; strict title/text; immutable ID/author/scope/server time.",
    ],
    post: [
      "One topic and initial visible v1 post, terminal receipt and one post-created intent commit on the same SQL connection. No initial revision: history records previous accepted versions.",
      "Precommit failure leaves zero topic/post/receipt/intent; lost response is unknown until same-key authorized replay.",
    ],
  },
  "get-topic": {
    procedure: "bounded-read",
    root: "topic",
    records: ["category"],
    query: "topics",
    pre: [
      "Current workspace and category access, inaccessible/foreign/absent identity all use safe 404.",
    ],
    post: ["Exactly the requested readable topic; cursor/result IDs never establish authority."],
  },
  "list-topics": {
    procedure: "bounded-read",
    root: "topic",
    records: ["category"],
    query: "topics",
    pre: ["Current policy before ordering and page limit."],
    post: [
      "createdAt/id ascending, default25/max100, authenticated query/scope/order-bound cursor; no implicit count or inaccessible IDs.",
    ],
  },
  reply: {
    procedure: "discussion-reply",
    root: "topic",
    records: ["post", "revision"],
    writes: {
      topic: ["version"],
      post: ["id", "scope-id", "created-at", "version", "topic-id", "author-id", "text", "state"],
    },
    pre: ["Current write access; topic expectedVersion matches and state is open."],
    post: [
      "Topic version increases once, one visible v1 reply and exactly one post-created intent/receipt commit together; closed/archived rejects422 unchanged.",
    ],
  },
  "list-posts": {
    procedure: "bounded-read",
    root: "post",
    records: ["topic"],
    query: "posts",
    pre: ["Named topic is currently readable before paging."],
    post: [
      "Row-preserving hidden/removed text redaction; removed rows have text:null; stable createdAt/id cursor.",
    ],
  },
  "edit-post": {
    procedure: "post-revise",
    root: "post",
    records: ["topic", "revision"],
    writes: {
      post: ["text", "version"],
      revision: [
        "id",
        "scope-id",
        "created-at",
        "version",
        "post-id",
        "post-version",
        "text",
        "author-id",
        "at",
      ],
    },
    pre: [
      "Current author or moderator and category write; post expectedVersion matches; removed is terminal.",
    ],
    post: [
      "Append previous text, previous post version/author/time exactly once before replacing text; increment only post version. Two v3 edits yield one v4 and one409; rejected commands have no receipt/intent/history.",
    ],
  },
  "post-history": {
    procedure: "bounded-read",
    root: "revision",
    records: ["post", "topic"],
    query: "current-history",
    pre: [
      "Current parent post visibility/category policy; hidden history moderator-only, removed text excluded.",
    ],
    post: [
      "Immutable prior versions ordered by version/postId. Protected retention is not ordinary export authority.",
    ],
  },
  "transition-topic": {
    procedure: "lifecycle-dispatch",
    root: "topic",
    records: [],
    writes: { topic: ["state", "version"] },
    pre: ["Current moderator/category write and topic version."],
    post: [
      "close open→closed; reopen closed→open; archive open/closed→archived. Archived terminal. Invalid/stale leaves all state/effects unchanged.",
    ],
  },
  "transition-post": {
    procedure: "lifecycle-dispatch",
    root: "post",
    records: ["topic", "revision"],
    writes: { post: ["state", "text", "version"] },
    pre: ["Current moderator/category write and post version; replay checked before version."],
    post: [
      "hide visible→hidden; restore hidden→visible; remove visible/hidden→removed and text:null. Fresh-key current-version remove of removed is unchanged same-version tombstone without another removal audit.",
    ],
  },
  "put-subscription": {
    procedure: "subscription-upsert",
    root: "subscription",
    records: ["topic"],
    writes: {
      subscription: [
        "principal-id",
        "topic-id",
        "mode",
        "inbox-enabled",
        "email-enabled",
        "version",
      ],
    },
    pre: [
      "Subject equals current principal and currently readable topic; default/missing preferences deny send.",
    ],
    post: [
      "Unique scope/principal/topic; channels array maps independently to inbox/email booleans. Initial expected1 produces v2; watch/mute never grants access.",
    ],
  },
  inbox: {
    procedure: "bounded-read",
    root: "notification",
    records: ["subscription", "post", "topic"],
    query: "current-inbox",
    pre: [
      "Current recipient ownership/category/subscription watch and inbox preference on every read.",
    ],
    post: [
      "Current policy before page/snippets; no private title/ID/count for revoked recipients; event/recipient identity separate from command receipt.",
    ],
  },
  "stage-file": {
    procedure: "file-stage",
    root: "attachment",
    records: [],
    writes: {
      attachment: [
        "id",
        "scope-id",
        "created-at",
        "version",
        "owner-id",
        "state",
        "filename",
        "mime",
        "size",
        "sha256",
        "object-key",
      ],
    },
    pre: [
      "Owner from principal; MIME text/plain or image/png; bytes1..10485760; declared filename bounded120; SHA256 strict.",
    ],
    post: [
      "Private metadata staged v1, no downloadable object. A private generated object key never acts as public authority.",
    ],
  },
  "put-file-bytes": {
    procedure: "file-inspect",
    root: "attachment",
    records: [],
    writes: { attachment: ["state", "version"] },
    pre: [
      "Current owner and staged file at expectedVersion; base64 bounded and actual MIME/length/hash verified outside SQL after committed staging.",
    ],
    post: [
      "Valid bytes advance v1→validated v2. Partial/mismatched bytes stay unavailable with durable cleanup intent; no SQL/object atomicity promise.",
    ],
  },
  "attach-file": {
    procedure: "file-associate",
    root: "attachment",
    records: ["attachment-link", "post", "topic"],
    writes: {
      attachment: ["state", "version"],
      "attachment-link": ["id", "scope-id", "created-at", "version", "attachment-id", "post-id"],
    },
    pre: [
      "Current file owner AND current parent posting access, same scope, validated expectedVersion.",
    ],
    post: [
      "One link and attached v3 plus receipt commit together. SQL failure preserves validated v2 as recoverable orphan, no link/receipt/download; same-key retry links once.",
    ],
  },
  "download-file": {
    procedure: "private-download",
    root: "attachment-link",
    records: ["attachment", "post", "topic"],
    pre: [
      "Attached association and current parent category read on every byte request; no durable public URL.",
    ],
    post: [
      "Proxy bounded original bytes only after read policy; no redirect. Interrupted/unlinked/private/foreign bytes unavailable.",
    ],
  },
  "flag-post": {
    procedure: "flag-submit",
    root: "flag",
    records: ["post", "topic"],
    writes: {
      flag: [
        "id",
        "scope-id",
        "created-at",
        "version",
        "post-id",
        "reporter-id",
        "state",
        "active-review",
      ],
    },
    pre: ["Current readable post, reporter from principal."],
    post: [
      "Unique active reporter/post flag across distinct command keys; repeated active flag returns same identity/version.",
    ],
  },
  "review-queue": {
    procedure: "bounded-read",
    root: "flag",
    records: ["post", "topic"],
    query: "reviews",
    pre: ["Current moderator and category access before page."],
    post: ["Pending flags only, stable createdAt/id cursor, no inaccessible category entries."],
  },
  "review-flag": {
    procedure: "flag-review",
    root: "flag",
    records: ["post", "topic"],
    writes: { flag: ["state", "version", "active-review"], post: ["state", "version"] },
    pre: [
      "Current moderator/category grant; pending flag and selected post version fenced under stable row locks.",
    ],
    post: [
      "dismiss→dismissed; hide→upheld plus post hidden and safe audit in one transaction; two moderator claims have one winner, one409, one audit.",
    ],
  },
  search: {
    procedure: "bounded-read",
    root: "post",
    records: ["topic", "search-projection"],
    query: "current-search",
    pre: [
      "Current source/category visibility before matching, counts, snippets and limit. Plain-text PostgreSQL full text, max query2000.",
    ],
    post: [
      "Stable topic.createdAt/topicId/postId cursor; query/scope/tampered cursor400. Rebuild bounded100 with atomic projection version; removed/hidden text cannot reappear.",
    ],
  },
  audit: {
    procedure: "bounded-read",
    root: "audit",
    records: ["category"],
    query: "audit",
    pre: ["Current moderator/category read only."],
    post: [
      "Metadata actor/action/target/time only, never text/credentials/staff retention export.",
    ],
  },
  "evaluate-trust": {
    procedure: "trust-evaluate",
    root: "trust",
    records: ["activity"],
    writes: { trust: ["level", "reasons", "policy-version", "version"] },
    hook: "trust",
    pre: [
      "Admin-only; immutable activity records from last30 UTC days, not client counters; override0..2 requires current admin.",
    ],
    post: [
      "trust-v1: level1 at10 reads/2 replies/1 approval; level2 at50/10/5; highest wins, else0. Expiry demotes; reasons qualified/inactive/override; no role/membership mutation.",
    ],
  },
  adjudicate: {
    procedure: "abuse-adjudicate",
    root: "adjudication",
    records: ["post", "topic", "adjudication-history"],
    writes: { adjudication: ["decision", "reason", "rule-version", "version"] },
    hook: "abuse",
    pre: [
      "Owner appeal from persisted adjudication or moderator override; current category access; bounded20 previous decisions.",
    ],
    post: [
      "abuse-v1 fixture needle→review, blocked-spam→reject, otherwise allow. Appeal→appeal-accepted; moderator override→moderator-override. No implicit hide/grant; timeout/invalid leaves version/audit/receipt unchanged.",
    ],
  },
  "schedule-digest": {
    procedure: "digest-schedule",
    root: "digest",
    records: ["subscription", "topic", "post"],
    writes: {
      digest: [
        "id",
        "scope-id",
        "created-at",
        "version",
        "principal-id",
        "window-start",
        "window-end",
        "timezone",
        "topic-ids",
        "state",
        "delivery-id",
      ],
    },
    hook: "digest",
    pre: [
      "Owner only; America/Chicago preceding local-midnight half-open window; exact UTC bounds including25h fallback; mismatch422.",
    ],
    post: [
      "digest-v1 selects public readable visible non-muted topics created in window, ascending createdAt/topicId, max20. Unique scope/principal/start/end/policy across keys; one stable delivery intent.",
      "Mail acceptance with lost ack→uncertain v2, one provider attempt. Redrain sends zero; explicit provider reconciliation accepted→sent v3. No blind new identity/exactly-once SMTP claim.",
    ],
  },
  "get-digest": {
    procedure: "bounded-read",
    root: "digest",
    records: ["subscription", "topic"],
    pre: [
      "Owner and current policy on each selected topic; recipients have no borrowed initiator authority.",
    ],
    post: [
      "Persisted pending→queued, sent→delivered, uncertain→uncertain, suppressed→suppressed mapping; no new send by reading.",
    ],
  },
  render: {
    procedure: "safe-render",
    root: "topic",
    records: ["post"],
    hook: "render",
    pre: [
      "Current topic write/read; supplied source≤4096 Unicode chars; eligible mentions derived from current access.",
    ],
    post: [
      "safe-v1 escapes HTML, strong/single-line paragraphs, http/https links only; max100 tokens/20 levels/40000 output. Unsafe schemes retain escaped label, no fetch; over budget422. Standalone render is read-only: no receipt, posts or notifications. Validate sanitized HTML and mention subset; invalid503.",
    ],
  },
  restructure: {
    procedure: "topic-restructure",
    root: "topic",
    records: ["post", "revision", "subscription", "attachment-link"],
    writes: {
      topic: ["version", "state"],
      post: ["topic-id"],
      subscription: ["topic-id", "mode", "inbox-enabled", "email-enabled", "version"],
    },
    hook: "restructure",
    pre: [
      "Moderator; two distinct existing open topics in same scope/category; lock topic IDs ascending; check source AND target versions/current policies; split nonempty subset≤100, merge all≤100 selected IDs.",
    ],
    post: [
      "Preserve post IDs/authors/versions/history/attachments. Copy subscriptions if absent; existing target mute wins; union distinct channels; split retains source, merge removes source subscriptions and archives empty source. Both topic versions increment once.",
      "Precommit failure leaves both topics/posts/subscriptions unchanged, no receipt/audit. Cancel rolls back; lost committed response uses same-key authorized replay.",
    ],
  },
  privacy: {
    procedure: "privacy-plan",
    root: "privacy-request",
    records: ["post", "revision", "hold", "notification", "subscription"],
    writes: {
      "privacy-request": [
        "principal-id",
        "kind",
        "state",
        "retention-days",
        "legal-hold",
        "progress-id",
        "version",
      ],
      post: ["text", "state"],
      notification: ["text"],
    },
    hook: "privacy",
    pre: [
      "Self or current admin only, selected scope; holds/owned posts/pending deliveries from authority; privacy-v1 exact subject version/progress identity.",
    ],
    post: [
      "Export only currently readable owned posts. Erase plan is durable, batches≤100, pseudonymizes through existing session owner, tombstones subject content, suppresses history/search and cancels only pending subject deliveries; never recall delivered information.",
      "Held post Q retains protected bytes/association legal-hold; safe audit retained with no credentials/source text. Crash resumes same fenced progress and key; four erased IDs, held Q, one cancellation, no second plan. New exports reveal no erased text.",
    ],
  },
  "inbound-email": {
    procedure: "inbound-reply",
    root: "topic",
    records: ["post", "revision", "mail-receipt"],
    writes: {
      topic: ["version"],
      post: ["id", "scope-id", "created-at", "version", "topic-id", "author-id", "text", "state"],
      "mail-receipt": [
        "id",
        "scope-id",
        "created-at",
        "version",
        "message-id",
        "post-id",
        "source-identity",
      ],
    },
    hook: "email",
    pre: [
      "Authenticate configured source before parsing: HMAC-SHA256 over ASCII timestamp+'.'+original body bytes, skew≤300s, no fixture signature acceptance. Scope from source/token mapping; exact confirmed sender; one topic token; MIME plain text≤1MiB/100parts/5attachments.",
    ],
    post: [
      "Normalize≤20000 chars; current sender posting policy/topic open rechecked. Reply/topic version, unique scope/source/message receipt, normalized hash and intent atomic. Same message replay201 after current access; changed normalized content409; invalid signature401; inaccessible404; malformed/ambiguous422; unavailable503 no partial reply.",
    ],
  },
  rank: {
    procedure: "discovery-rank",
    root: "topic",
    records: ["post", "search-projection"],
    query: "topics",
    hook: "ranking",
    pre: [
      "Current readable topics/visible posts before features/counts/limits; server reply count last7 UTC days; no client feature authority.",
    ],
    post: [
      "rank-v1: reply count descending, lastActivity descending, topicId ascending. Duplicate-free authorized subset only, visibility reapplied before serialize. Projection fresh≤600seconds inclusive; stale or invalid/foreign hook ID503, no empty success; rebuild increments projectionVersion but stable same-clock asOf/order.",
    ],
  },
};

export function completeDiscourseCore(result: {
  name: string;
  design: DesignDocument;
  layout: LayoutDocument;
}) {
  const { design } = result,
    a = design.architecture!,
    m = a.backend!;
  result.name = "Discourse core · complete backend design";
  for (const d of a.decisions ?? [])
    if (["dc-partial-boundary", "dc-provenance"].includes(d.id)) d.status = "Superseded";
  a.system.name = result.name;
  a.system.description =
    "Complete P71 design of the frozen D01–D20 adaptation. TypeScript API and separate worker proposed; runtime implementations unsupported, application absent/not run and zero observed points.";
  for (const e of design.elements)
    e.notes =
      "Complete design intent only; no runtime implementation or observed benchmark acceptance. docs/examples/discourse-core.md";
  a.components!.find((c) => c.id === "dc-content")!.responsibility =
    "Own topic/initial-post atomicity, replies, post-only CAS revisions, finite topic/post transitions and bounded restructure coordination. Private access follows the current category.";
  a.components!.find((c) => c.id === "dc-privacy")!.responsibility =
    "Own durable privacy-v1 plans, protected holds, fenced batches and pending subject-delivery cancellation; principal pseudonymization delegates the existing session owner.";
  a.components!.find((c) => c.id === "dc-access")!.responsibility =
    "Own live workspace/group grants, trust authority and verified source identity resolution. The API ingress authenticates original inbound bytes and calls the bounded pure mail hook before ordinary current posting authorization.";
  a.components!.find((c) => c.id === "dc-mail")!.responsibility =
    "Own durable source-message receipt identity and provenance as a reusable worker responsibility. Synchronous HTTP source authentication/normalization is exposed by the API access adapter; no mail broker or second user authority is implied.";
  a.components!.find((c) => c.id === "dc-subscriptions")!.responsibility =
    "Own current watch/mute and independent inbox/email preferences plus bounded digest window scheduling. Current category authority remains separate; the worker performs materialization/delivery.";
  // Preserve every P71a v1 contract. Successors clarify logical state without altering frozen HTTP payloads.
  const old = a.contracts!.filter((c) => c.kind === "api");
  for (const original of old) {
    const c = structuredClone(original);
    c.version = "v2";
    c.coverage = "Complete";
    c.description =
      "Exact frozen REST/JSON wire, complete design state bindings; unsupported runtime. v1 is retained unchanged.";
    for (const w of c.shape!.operations) {
      const pure = ["render", "rank"].includes(w.id) || w.transport!.method === "GET";
      for (const out of w.outcomes ?? []) {
        out.state = "Unchanged";
        out.retry = out.status === 409 ? "After correction" : "Safe";
      }
      const ok = w.transport!.responses.find((r) => r.status < 300)!;
      const success: OperationOutcome = {
        id: "success",
        name: "Declared success",
        kind: "Success",
        status: ok.status,
        condition: "Validated exact protocol result",
        state: pure ? "Unchanged" : "Committed",
        retry: "Safe",
        payload: structuredClone(w.output),
      };
      w.outcomes!.push(success);
      ok.outcome = "success";
      if (w.id === "privacy")
        w.outcomes!.push({
          id: "progress-persisted",
          name: "Durable privacy progress checkpoint",
          kind: "Success",
          state: "Committed",
          retry: "Safe",
          condition:
            "Required plan validated; durable plan/first bounded batch and continuation intent committed. Internal checkpoint only; no premature HTTP success.",
          internal: true,
        });
      if (["transition-post", "flag-post", "schedule-digest"].includes(w.id)) {
        w.outcomes!.push({
          ...structuredClone(success),
          id: "unchanged",
          name: "Terminal unchanged result",
          state: "Unchanged",
          condition:
            "Current-version removed tombstone, existing active flag, or existing exact digest window; same identities, no repeated domain effect.",
        });
        ok.outcomeAliases = ["unchanged"];
      }
      if (!pure && w.id !== "get-session")
        w.outcomes!.push({
          id: "uncertain",
          name: "Connection/acknowledgement lost",
          kind: "Failure",
          condition:
            "No observed response establishes rollback or commit; reconcile same identity.",
          state: "Unknown",
          retry: "Reconcile first",
          noResponse: true,
        });
      if (recipes[w.id]?.hook) {
        const base = w.outcomes!.find((o) => o.status === 503)!;
        w.transport!.responses.find((r) => r.status === 503)!.outcomeAliases = [
          "hook-failed",
          "hook-cancelled",
        ];
        for (const id of ["hook-failed", "hook-cancelled"])
          w.outcomes!.push({
            ...structuredClone(base),
            id,
            name: id,
            condition:
              "Required pure hook failed/invalid/timed out or cooperatively cancelled before mutation.",
            state: "Unchanged",
          });
      }
      const recipe = recipes[w.id];
      w.behavior = {
        ...(!recipe
          ? {
              session: {
                operation: (
                  {
                    register: "registerAccount",
                    login: "login",
                    logout: "logout",
                    "get-session": "readSession",
                  } as const
                )[w.id as "register" | "login" | "logout" | "get-session"],
                authority: "existing-session-owner",
                publicGrants: "none",
                mutationProtection: "origin-csrf",
                durability: "opaque-stored-hash",
                applicationIsolation: "cookie-origin-and-project",
              },
            }
          : {}),
        kind: pure ? "Query" : "Command",
        authorization: w.description,
        preconditions:
          recipe?.pre.join(" ").slice(0, 1200) ??
          "Existing durable session protocol, Origin/CSRF, application-specific opaque sessions; no duplicate identity schema.",
        stateChanges:
          recipe?.post.join(" ").slice(0, 1200) ??
          "Session implementation owns credential hashing, durable establishment and revocation; public account creation grants no workspace role.",
        transaction: recipe
          ? "Exact backend operation protocol; local SQL and receipt/intent; external bytes stay outside SQL."
          : "Existing session owner only",
        idempotency: pure ? "Read only" : recipe ? "Deduplication key" : "Not guaranteed",
        implementation: recipe?.hook ? "Application hook" : "Composition",
        acceptance: discourseCoreTrace
          .flatMap((r) =>
            r.observations
              .filter((o) => o.operations.some((id) => kebab(id) === w.id))
              .map((o) => o.id),
          )
          .join(", ")
          .slice(0, 1200),
      };
    }
    a.contracts!.push(c);
    for (const i of [...(a.interfaces ?? [])])
      if (i.contract.id === c.id && i.contract.version === "v1")
        a.interfaces!.push({
          ...structuredClone(i),
          id: `${i.id}-v2`,
          contract: { id: c.id, version: "v2" },
        });
    for (const b of [...(a.bindings ?? [])])
      if (b.contract.id === c.id && b.contract.version === "v1")
        a.bindings!.push({
          ...structuredClone(b),
          id: `${b.id}-v2`,
          provided: `${b.provided}-v2`,
          required: `${b.required}-v2`,
          contract: { id: c.id, version: "v2" },
        });
  }
  a.contracts!.push(...structuredClone(discourseCoreHookContracts));
  // Each existing aggregate gets an explicit successor. v1 and all physical identities are preserved.
  for (const g of [...m.aggregates]) {
    const n = structuredClone(g);
    n.version = "v2";
    n.invariants = [
      { id: "version-fence", strategy: "nonnegative", value: { entity: n.root, field: "version" } },
    ];
    n.concurrency = {
      kind: "row-lock",
      entities: [n.root, ...n.children].sort((x, y) =>
        contractKey(x).localeCompare(contractKey(y)),
      ),
      order: "entity-id-primary-key",
    };
    m.aggregates.push(n);
  }
  m.operations = [];
  m.lifecycles = [];
  m.effects = [];
  m.hooks = [];
  addLifecycles(a);
  addParticipantPolicies(design);
  discourseCoreReadRefinements(a);
  for (const c of a.contracts!.filter((c) => c.kind === "api" && c.version === "v2"))
    for (const wire of c.shape!.operations) {
      const rawRecipe = recipes[wire.id];
      if (!rawRecipe) continue;
      const recipe = structuredClone(rawRecipe);
      if (wire.id === "adjudicate") {
        recipe.records.push("adjudication-history");
        recipe.writes!["adjudication-history"] = [
          "id",
          "scope-id",
          "created-at",
          "version",
          "post-id",
          "adjudication-id",
          "decision-version",
          "decision",
          "reason",
          "rule-version",
          "actor-id",
        ];
      }
      buildOperation(design, c, wire, recipe);
    }
  addAdministrativeAudit(design);
  addHooks(design);
  addEffects(design);
  discourseCoreMechanisms(design);
  discourseCoreJourneys(result);
  return result;
}

import { contractKey } from "./architecture-contracts.ts";

function addLifecycles(a: Architecture) {
  const m = a.backend!;
  const add = (id: string, states: string[], initial: string, ts: [string, string, string][]) => {
    const g =
      m.aggregates.find((g) => g.version === "v2" && g.root.id === entity(id).id) ??
      m.aggregates.find((g) => g.id === "dc-discussion-aggregate" && g.version === "v2")!;
    m.lifecycles!.push({
      id: `dc-${id}-lifecycle`,
      version: "v1",
      name: `${id} finite states`,
      aggregate: dcRef(g.id, "v2"),
      state: { entity: entity(id), field: "state" },
      states,
      initial,
      guards: [],
      transitions: ts.map(([id, from, to]) => ({ id, from, to, guards: [] })),
    });
  };
  add("topic", ["open", "closed", "archived"], "open", [
    ["close", "open", "closed"],
    ["reopen", "closed", "open"],
    ["archive-open", "open", "archived"],
    ["archive-closed", "closed", "archived"],
  ]);
  add("post", ["visible", "hidden", "removed"], "visible", [
    ["hide", "visible", "hidden"],
    ["restore", "hidden", "visible"],
    ["remove-visible", "visible", "removed"],
    ["remove-hidden", "hidden", "removed"],
  ]);
  add("flag", ["pending", "dismissed", "upheld"], "pending", [
    ["dismiss", "pending", "dismissed"],
    ["uphold", "pending", "upheld"],
  ]);
  add("membership", ["active", "revoked"], "active", [
    ["revoke", "active", "revoked"],
    ["restore", "revoked", "active"],
  ]);
  add("attachment", ["staged", "validated", "attached", "orphan", "deleted"], "staged", [
    ["validate", "staged", "validated"],
    ["interrupt", "staged", "orphan"],
    ["claim-validated", "validated", "orphan"],
    ["associate", "validated", "attached"],
    ["cleanup-staged", "staged", "deleted"],
    ["cleanup-orphan", "orphan", "deleted"],
    ["cleanup-validated", "validated", "deleted"],
  ]);
  add("digest", ["pending", "sent", "uncertain", "suppressed"], "pending", [
    ["sent", "pending", "sent"],
    ["uncertain", "pending", "uncertain"],
    ["suppress", "pending", "suppressed"],
    ["reconcile", "uncertain", "sent"],
    ["suppress-uncertain", "uncertain", "suppressed"],
  ]);
  add("privacy-request", ["planned", "processing", "cancelled", "complete"], "planned", [
    ["begin", "planned", "processing"],
    ["cancel", "planned", "cancelled"],
    ["complete", "processing", "complete"],
    ["cancel-processing", "processing", "cancelled"],
  ]);
}
const current = (id: string, field: string) => ({
  kind: "current" as const,
  entity: entity(id),
  field,
});
const input = (id: string) => ({ kind: "input" as const, path: [id] });
const lit = (value: string | number | boolean | null) => ({ kind: "literal" as const, value });
function buildOperation(
  design: DesignDocument,
  c: ArchitectureContract,
  wire: NonNullable<ArchitectureContract["shape"]>["operations"][number],
  recipe: Recipe,
) {
  const a = design.architecture!,
    m = a.backend!,
    id = wire.id;
  const pure = wire.transport!.method === "GET" || ["render", "rank"].includes(id);
  const root = m.entities.find((e) => e.id === entity(recipe.root).id)!;
  const g =
    m.aggregates.find((g) => g.version === "v2" && g.root.id === root.id) ??
    m.aggregates.find((g) => g.id === "dc-discussion-aggregate" && g.version === "v2")!;
  const owner = a.interfaces!.find(
    (i) => i.direction === "provided" && contractKey(i.contract) === contractKey(c),
  )!.owner;
  if (owner.kind === "external-system") throw new Error("Protocol cannot own an external system");
  const ids = [...new Set([recipe.root, ...recipe.records])];
  const isNew = (e: string) =>
    (id === "create-topic" && ["topic", "post"].includes(e)) ||
    (id === "reply" && e === "post") ||
    (id === "edit-post" && e === "revision") ||
    (id === "stage-file" && e === "attachment") ||
    (id === "attach-file" && e === "attachment-link") ||
    (id === "flag-post" && e === "flag") ||
    (id === "schedule-digest" && e === "digest") ||
    (id === "inbound-email" && ["post", "mail-receipt"].includes(e)) ||
    (id === "adjudicate" && e === "adjudication-history");
  const field = (
    e: string,
    f: string,
  ): BackendProtocolPlan["records"][number]["writes"][number]["source"] => {
    const inputField = wire.input.find((v) => v.id === f);
    if (f === "id") return { kind: "server", factory: "uuid" };
    if (f === "scope-id") return { kind: "context", value: "scope" };
    if (f === "created-at") return { kind: "server", factory: "clock" };
    if (e === "adjudication-history") {
      if (f === "actor-id") return { kind: "context", value: "principal" };
      if (["adjudication-id", "decision-version"].includes(f))
        return { kind: "derived", rule: "accepted-adjudication-revision" };
      if (["decision", "reason"].includes(f)) return { kind: "hook", path: [f] };
    }
    if (f === "version")
      return {
        kind: "server",
        factory:
          ["membership", "grant", "subscription"].includes(e) &&
          ["put-membership", "put-grant", "put-subscription"].includes(id)
            ? "upsert-from-one-version"
            : ["adjudication", "privacy-request"].includes(e) &&
                ["adjudicate", "privacy"].includes(id)
              ? "insert-or-next-version"
              : isNew(e)
                ? "initial-version"
                : "next-version",
      };
    if (["author-id", "owner-id", "reporter-id"].includes(f) && isNew(e) && e !== "revision")
      return { kind: "context", value: "principal" };
    if (e === "revision") {
      if (f === "post-id") return input("post-id");
      if (f === "post-version") return current("post", "version");
      if (f === "text") return { kind: "derived", rule: "previous-revision" };
      if (f === "author-id") return current("post", f);
      if (f === "at") return { kind: "server", factory: "clock" };
    }
    if (f === "state") {
      if (isNew(e))
        return lit(
          {
            topic: "open",
            post: "visible",
            attachment: "staged",
            flag: "pending",
            digest: "pending",
          }[e]!,
        );
      return { kind: "derived", rule: "selected-lifecycle-transition" };
    }
    if (id === "restructure" && ["inbox-enabled", "email-enabled"].includes(f))
      return { kind: "derived", rule: "merged-subscription-preferences" };
    if (f === "inbox-enabled" || f === "email-enabled")
      return {
        kind: "derived",
        rule: f === "inbox-enabled" ? "inbox-channel-membership" : "email-channel-membership",
      };
    if (id === "restructure" && ["topic-id", "mode"].includes(f))
      return {
        kind: "derived",
        rule: f === "topic-id" ? "validated-move-plan" : "merged-subscription-preferences",
      };
    if (id === "privacy") {
      if (f === "principal-id") return input("principal-id");
      if (f === "retention-days") return lit(0);
      if (f === "legal-hold") return { kind: "derived", rule: "privacy-progress-plan" };
      if (f === "progress-id") return { kind: "derived", rule: "privacy-progress-plan" };
      if (f === "text")
        return e === "post" ? lit(null) : { kind: "derived", rule: "privacy-tombstone-plan" };
    }
    if (e === "trust" && ["level", "reasons"].includes(f)) return { kind: "hook", path: [f] };
    if (e === "adjudication" && ["decision", "reason"].includes(f))
      return { kind: "hook", path: [f] };
    if (f === "policy-version") return lit("trust-v1");
    if (f === "rule-version") return lit("abuse-v1");
    if (e === "digest" && f === "topic-ids") return { kind: "hook", path: ["topic-ids"] };
    if (e === "digest" && f === "delivery-id")
      return { kind: "derived", rule: "window-delivery-identity" };
    if (f === "active-review") return { kind: "derived", rule: "active-review-discriminator" };
    if (f === "object-key") return { kind: "derived", rule: "new-object-key" };
    if (e === "mail-receipt" && f === "source-identity")
      return { kind: "derived", rule: "verified-message-identity" };
    if (id === "inbound-email" && f === "text") return { kind: "hook", path: ["text"] };
    if (inputField) return input(f);
    if (f === "post-id") return current("post", "id");
    if (f === "topic-id") return current("topic", "id");
    if (f === "attachment-id") return current("attachment", "id");
    if (f === "principal-id") return { kind: "context", value: "principal" };
    if (f === "text" && id === "transition-post")
      return { kind: "derived", rule: "privacy-tombstone-plan" };
    return { kind: "derived", rule: "validated-move-plan" };
  };
  const records: BackendProtocolPlan["records"] = ids.map((e) => {
    const writes: BackendProtocolPlan["records"][number]["writes"] = (recipe.writes?.[e] ?? []).map(
      (f) => ({ field: f, source: field(e, f) }),
    );
    const onMissing: BackendProtocolPlan["records"][number]["onMissing"] =
      e === recipe.root && ["put-membership", "put-grant", "put-subscription"].includes(id)
        ? "insert-before-cas-from-one"
        : e === recipe.root && ["adjudicate", "privacy"].includes(id)
          ? "insert-at-one"
          : undefined;
    if (onMissing) {
      for (const f of ["id", "scope-id", "created-at"]) {
        if (!writes.some((w) => w.field === f))
          writes.push({ field: f, source: field(e, f), when: "create-only" });
      }
      if (e === "adjudication")
        writes.push({ field: "post-id", source: input("post-id"), when: "create-only" });
    }
    const identifier = wire.input.find(
      (f) => f.id === `${e}-id` || (e === "privacy-request" && f.id === "subject-id"),
    );
    const selectors: Record<string, string[]> = {
      membership: ["principal-id", "group-id"],
      grant: ["category-id", "group-id"],
      subscription: ["principal-id", "topic-id"],
      trust: ["principal-id"],
      "attachment-link": ["attachment-id"],
    };
    let selection: BackendProtocolPlan["records"][number]["selection"] = isNew(e)
      ? "server-created"
      : identifier
        ? "input-key"
        : e === "notification"
          ? "current-recipient"
          : "authorized-parent";
    let keys = identifier ? [{ field: "id", input: [identifier.id] }] : [];
    if (e === recipe.root && selectors[e]) {
      selection = "scoped-unique-key";
      keys = selectors[e]!.map((field) => ({ field, input: [field] }));
    }
    if (id === "adjudicate" && e === "adjudication") {
      selection = "bounded-plan";
      keys = [{ field: "post-id", input: ["post-id"] }];
    }
    if (id === "restructure" && e === "topic") {
      selection = "bounded-plan";
      keys = [
        { field: "id", input: ["source-topic-id"] },
        { field: "id", input: ["target-topic-id"] },
      ];
    }
    if (["privacy", "rank", "schedule-digest"].includes(id) && !isNew(e) && !identifier)
      selection = "bounded-plan";
    if (e === "trust" && keys[0]) keys[0].input = ["principal-id"];
    if (e === "subscription" && e !== recipe.root) {
      selection = "bounded-plan";
      keys = [];
    }
    const special =
      id === "download-file" && e === "attachment"
        ? "dc-attached-file-read-policy"
        : id === "restructure" && e === "subscription"
          ? "dc-restructure-subscription-policy"
          : id === "privacy" && ["hold", "revision", "subscription", "notification"].includes(e)
            ? `dc-privacy-${e}-policy`
            : undefined;
    const policy = dcRef(special ?? `dc-${e}-entity-policy`);
    const action =
      ["transition-topic", "transition-post", "review-flag", "restructure"].includes(id) &&
      ["topic", "post", "flag"].includes(e)
        ? "moderate"
        : writes.length
          ? "write"
          : "read";
    return {
      entity: entity(e),
      ...(onMissing ? { onMissing } : {}),
      policy,
      action,
      readProjection: "read",
      ...(writes.length ? { writeProjection: "write" } : {}),
      selection,
      keys,
      writes,
    };
  });
  const query = recipe.query ? dcRef(`dc-${recipe.query}-query`) : undefined;
  const versionChecks: BackendProtocolPlan["versionChecks"] = wire.input
    .filter((f) =>
      ["expected-version", "source-expected-version", "target-expected-version"].includes(f.id),
    )
    .map((f) => ({
      entity: entity(recipe.root),
      field: "version",
      input: [f.id],
      ...(id === "restructure"
        ? { selector: [f.id.startsWith("source") ? "source-topic-id" : "target-topic-id"] }
        : {}),
    }));
  // In a topic consistency boundary, edit/transition fences the actual selected post, not topic.
  if (id === "privacy")
    versionChecks.splice(0, versionChecks.length, {
      kind: "session-subject",
      subject: ["principal-id"],
      input: ["expected-version"],
      boundary: "existing-session-owner",
    });
  const transitions: BackendProtocolPlan["transitions"] = [];
  for (const record of records) {
    if (!record.writes.some((w) => w.field === "state" && w.source.kind === "derived")) continue;
    const l = m.lifecycles!.find((l) => l.state.entity.id === record.entity.id);
    if (l)
      for (const t of l.transitions) {
        const allowed =
          id === "put-file-bytes"
            ? ["validate"]
            : id === "attach-file"
              ? ["associate"]
              : id === "restructure"
                ? ["archive-open"]
                : id === "review-flag"
                  ? record.entity.id === entity("post").id
                    ? ["hide"]
                    : ["dismiss", "uphold"]
                  : id === "privacy" && record.entity.id === entity("post").id
                    ? ["remove-visible", "remove-hidden"]
                    : l.transitions.map((t) => t.id);
        if (!allowed.includes(t.id)) continue;
        transitions.push({
          lifecycle: dcRef(l.id),
          transition: t.id,
          action:
            id === "restructure"
              ? "merge"
              : id === "review-flag" && t.id === "uphold"
                ? "hide"
                : t.id.startsWith("archive")
                  ? "archive"
                  : t.id.startsWith("remove")
                    ? "remove"
                    : t.id,
          ...(id === "restructure" ? { selector: ["source-topic-id"] } : {}),
        });
      }
  }
  const observations = discourseCoreTrace.flatMap((r) =>
    r.observations.filter((ob) => ob.operations.some((op) => kebab(op) === id)).map((ob) => ob.id),
  );
  const inputs: BackendProtocolPlan["inputs"] = wire.input.map((f) => ({
    path: [f.id],
    use:
      f.id === "scope-id"
        ? "scope"
        : f.id === "header-idempotency-key"
          ? pure
            ? "accepted-value"
            : "command-key"
          : f.id.includes("version")
            ? "expected-version"
            : f.id === "raw-base64"
              ? "provider-original-bytes"
              : f.id.endsWith("-id")
                ? "selector"
                : ["limit", "cursor", "q"].includes(f.id)
                  ? "bounded-query"
                  : f.id === "action"
                    ? "authorized-choice"
                    : "accepted-value",
  }));
  const protocol: BackendProtocolPlan = {
    schemaVersion: 1,
    procedure: recipe.procedure,
    locking: "all-selected-existing-rows-stable-order-then-recheck",
    inputs,
    records,
    queries: query ? [query] : [],
    hookInputs: [],
    transitions,
    versionChecks,
    outputs: wire.output.map((f): BackendProtocolPlan["outputs"][number] => {
      if (f.id.startsWith("header-"))
        return {
          path: [f.id],
          source:
            id === "download-file" && f.id === "header-content-disposition"
              ? "private-stream"
              : "owner-result",
          derivation: "safe-response-headers",
          fields: [],
        };
      if (f.id === "next-cursor")
        return {
          path: [f.id],
          source: "owner-result",
          ...(query ? { query } : {}),
          derivation: "query-cursor",
          fields: [],
        };
      if (query && f.id === "items")
        return {
          path: [f.id],
          source: "query-page",
          query,
          fields: (f.items?.fields ?? []).map((v) => v.id),
        };
      if (id === "put-subscription" && f.id === "channels")
        return {
          path: [f.id],
          source: "owner-result",
          entity: entity("subscription"),
          fields: ["inbox-enabled", "email-enabled"],
          derivation: "subscription-channels",
        };
      if (id === "get-digest" && f.id === "delivery")
        return {
          path: [f.id],
          source: "owner-result",
          entity: entity("digest"),
          fields: ["state"],
          derivation: "digest-delivery-state",
        };
      if (id === "restructure" && ["source-version", "target-version"].includes(f.id))
        return {
          path: [f.id],
          source: "record",
          entity: entity("topic"),
          fields: ["version"],
          selector: [f.id === "source-version" ? "source-topic-id" : "target-topic-id"],
        };
      if (id === "privacy" && f.id === "subject-id")
        return {
          path: [f.id],
          source: "record",
          entity: entity("privacy-request"),
          fields: ["principal-id"],
        };
      if (id === "privacy" && f.id === "status")
        return {
          path: [f.id],
          source: "owner-result",
          entity: entity("privacy-request"),
          fields: ["state"],
          derivation: "privacy-result-status",
        };
      if (id === "privacy" && f.id === "cancelled-deliveries")
        return {
          path: [f.id],
          source: "owner-result",
          fields: [],
          derivation: "cancelled-delivery-count",
        };
      const wrapped = ids.find((name) => name === f.id),
        record = wrapped ?? (root.fields.some((v) => v.field === f.id) ? recipe.root : undefined);
      if (record)
        return {
          path: [f.id],
          source: "record",
          entity: entity(record),
          fields: f.type === "object" ? (f.fields ?? []).map((v) => v.id) : [f.id],
        };
      const hookResult = recipe.hook
        ? discourseCoreHookContracts.find((c) => c.id === `dc-jh-${recipe.hook}-output`)
        : undefined;
      const alias =
        id === "privacy"
          ? (
              {
                "exported-post-ids": "export-post-ids",
                "erased-post-ids": "erase-post-ids",
              } as Record<string, string>
            )[f.id]
          : undefined;
      const resultField = alias ?? f.id;
      if (hookResult?.shape?.payload.some((v) => v.id === resultField))
        return { path: [f.id], source: "validated-hook", fields: [resultField] };
      return { path: [f.id], source: "owner-result", fields: [] };
    }),
    limits: { batch: 100, deadlineSeconds: 30 },
    replay: pure
      ? "read-current-policy"
      : id === "inbound-email"
        ? "source-message-current-policy"
        : "current-policy-before-receipt-before-version",
    ...(id === "privacy"
      ? {
          progress: {
            kind: "privacy-erasure" as const,
            store: "dc-db",
            state: entity("privacy-request"),
            key: "progress-id",
            input: dcRef("dc-jh-privacy-input"),
            result: dcRef("dc-jh-privacy-output"),
            continuation: dcRef("dc-resume-privacy-operation"),
            checkpoint: "progress-persisted",
            terminal: "success",
            batchSize: 100,
            maximumItems: 100 as const,
            overflow: "reject-before-mutation" as const,
            snapshot: "validated-plan-persisted-before-batches" as const,
            holds: "current-hold-overrides-plan-before-each-batch" as const,
          },
        }
      : {}),
    failure: "no-partial-domain-writes",
    externalIO:
      id === "put-file-bytes"
        ? "stage-verify-before-sql"
        : id === "download-file"
          ? "authorized-proxy-after-read"
          : id === "inbound-email"
            ? "verified-source-before-sql"
            : "none",
    receipt: pure
      ? "none"
      : id === "inbound-email"
        ? "atomic-source-message-and-command"
        : "atomic-terminal-command",
    preconditions: [...recipe.pre],
    postconditions: [...recipe.post],
    acceptance: observations,
  };
  const key = wire.input.find(
    (f) => f.id === (id === "inbound-email" ? "message-id" : "header-idempotency-key"),
  );
  const op: BackendOperation = {
    id: `dc-${id}-operation`,
    version: "v1",
    name: wire.name,
    target: { contract: { id: c.id, version: c.version }, operation: id, owner },
    kind: pure ? "query" : "command",
    aggregate: dcRef(g.id, "v2"),
    access: {
      policy: {
        kind: "policy",
        reference:
          records.find((r) => r.entity.id === g.root.id)?.policy ??
          dcRef(`dc-${recipe.root}-entity-policy`),
      },
      action: records[0]!.action,
      readProjection: "read",
      ...(!pure ? { writeProjection: "write" } : {}),
      participants: records
        .filter((r) => r.entity.id !== g.root.id)
        .map((r) => ({
          entity: r.entity,
          policy: { kind: "policy", reference: r.policy },
          action: r.action,
          readProjection: r.readProjection,
          ...(r.writeProjection ? { writeProjection: r.writeProjection } : {}),
        })),
    },
    ...(query
      ? {
          query,
          queryInputs: (m.queries!.find((q) => q.id === query.id)?.filters ?? []).flatMap(
            (filter): NonNullable<BackendOperation["queryInputs"]> => {
              const path =
                filter.id === "topic-id" && id === "get-topic"
                  ? "topic-id"
                  : filter.id === "filter-topic-id"
                    ? "topic-id"
                    : filter.id === "filter-post-id"
                      ? "post-id"
                      : undefined;
              if (path && wire.input.some((f) => f.id === path))
                return [{ filter: filter.id, operator: "eq" as const, value: input(path) }];
              if (id === "review-queue" && filter.id === "filter-state")
                return [{ filter: filter.id, operator: "eq" as const, value: lit("pending") }];
              return [];
            },
          ),
        }
      : {}),
    guards: [],
    actions: [],
    writes: records.flatMap((r) => r.writes.map((w) => ({ entity: r.entity, field: w.field }))),
    expectedVersion: { kind: "none" },
    transaction: {
      kind: pure ? "read-only" : "local",
      store: "dc-db",
      participants: records.map((r) => r.entity),
      connection: "single",
      externalIO: "forbidden",
      access: "current-state-in-transaction",
      concurrency: "aggregate-policy",
      failure: "rollback",
      commit: "disconnect-is-unknown",
    },
    idempotency: pure
      ? { kind: "read-only" }
      : id === "inbound-email"
        ? {
            kind: "source-message",
            message: ["message-id"],
            identity: "source-scope-message",
            hash: "canonical-normalized-source-content-sha256",
            replay: "current-policy-before-result",
          }
        : {
            kind: "command-key",
            key: [key?.id ?? "header-idempotency-key"],
            identity: "operation-version-scope-principal-key",
            hash: "canonical-normalized-input-sha256",
            hashInputs: wire.input.filter((f) => f.id !== key?.id).map((f) => [f.id]),
            retentionSeconds: 604800,
            publishedWindow: true,
            expired: "new-command",
            receipt: "terminal-result-in-same-transaction",
            concurrent: "one-writer-bounded-wait-or-retry",
            replay: "current-policy-before-result",
            cleanup: "separate-controlled-policy",
          },
    cancellation: {
      kind: "cooperative",
      startsWork: !pure,
      deadlineSeconds: 30,
      beforeCommit: "rollback",
      afterCommit: "committed-or-unknown",
    },
    outcomes: wire.outcomes!.map((w) => ({
      outcome: w.id,
      trigger: ["success", "progress-persisted"].includes(w.id)
        ? "success"
        : w.id === "unchanged"
          ? "unchanged"
          : w.id === "uncertain"
            ? "uncertain"
            : w.id === "hook-failed"
              ? "failed"
              : w.id === "hook-cancelled"
                ? "cancelled"
                : w.status === 503
                  ? "unavailable"
                  : w.status === 409
                    ? "conflict"
                    : "rejected",
      values: [],
    })),
    protocol,
  };
  if (id === "reply")
    op.guards.push({
      id: "topic-open",
      kind: "compare",
      left: current("topic", "state"),
      operator: "eq",
      right: lit("open"),
    });
  m.operations!.push(op);
}
function addHooks(design: DesignDocument) {
  const a = design.architecture!,
    m = a.backend!;
  const scopeInput = new Set(["scope-id", "principal-id", "correlation"]);
  for (const [name, operation] of [
    ["trust", "evaluate-trust"],
    ["abuse", "adjudicate"],
    ["digest", "schedule-digest"],
    ["render", "render"],
    ["restructure", "restructure"],
    ["privacy", "privacy"],
    ["email", "inbound-email"],
    ["ranking", "rank"],
  ]) {
    const o = m.operations!.find((o) => o.target.operation === operation)!,
      p = o.protocol!;
    const api = a.contracts!.find((c) => contractKey(c) === contractKey(o.target.contract))!,
      wire = api.shape!.operations.find((w) => w.id === operation)!;
    const id = `dc-jh-${name}`,
      signature = discourseCoreHookContracts.find((c) => c.id === `${id}-input`)!;
    const errorId = `${id}-error`;
    const error = structuredClone(wire.outcomes!.find((v) => v.status === 503)!.payload!).filter(
      (f) => !f.id.startsWith("header-"),
    );
    a.contracts!.push({
      id: errorId,
      version: "v1",
      name: `JH-${name} safe error`,
      kind: "data",
      coverage: "Complete",
      description:
        "Strict safe failure; no private snapshot, parser source, credential or partial success.",
      shape: { payload: error, operations: [], types: structuredClone(api.shape!.types ?? []) },
    });
    const ref = dcRef(id);
    p.hook = ref;
    const recordInputs: Record<string, [string, string]> = {
      "current-level": ["trust", "level"],
      text: ["post", "text"],
      "post-id": ["post", "id"],
      "subject-id": ["privacy-request", "principal-id"],
      "progress-id": ["privacy-request", "progress-id"],
    };
    const aliases: Record<string, string> = {
      ...(name === "trust" || name === "digest" ? { "principal-id": "principal-id" } : {}),
      ...(name === "privacy" ? { "subject-id": "principal-id" } : {}),
      ...(name === "restructure"
        ? {
            "source-version": "source-expected-version",
            "target-version": "target-expected-version",
          }
        : {}),
      ...(name === "abuse" ? { "policy-version": "rule-version" } : {}),

      ...(name === "ranking" ? { "policy-version": "algorithm-version" } : {}),
    };
    const derivations: Record<
      string,
      NonNullable<BackendProtocolPlan["hookInputs"][number]["derivation"]>
    > = {
      reads: "recorded-activity-count",
      replies: "recorded-activity-count",
      approvals: "recorded-activity-count",
      "window-start": "trust-window-start",
      "window-end": "server-clock",
      "history-decisions": "adjudication-history",
      "moderator-authorized": "current-moderator-authority",
      "eligible-topic-ids": "public-digest-candidates",
      "eligible-mention-ids": "eligible-mention-principals",
      "subscription-principal-ids": "restructure-subscriptions",
      "subject-post-ids": "subject-owned-posts",
      "legal-hold-post-ids": "authoritative-retention-holds",
      "pending-delivery-ids": "pending-subject-deliveries",
      "progress-id": "durable-privacy-progress",
      "authenticated-source-id": "verified-source-identity",
      "verified-body-sha256": "original-body-sha256",
      "sender-candidates": "confirmed-sender-candidates",
      "topic-candidates": "configured-topic-candidates",
      candidates: "authorized-ranking-features",
      "as-of": "projection-as-of",
      "projection-version": "projection-version",
      "policy-version": "selected-policy-version",
    };
    if (name === "trust") p.queries.push(dcRef("dc-recorded-activity-query"));
    if (name === "abuse") p.queries.push(dcRef("dc-adjudication-history-query"));
    p.hookInputs = signature.shape!.payload.map((f) => {
      const alias = aliases[f.id],
        direct =
          alias ??
          (wire.input.some((v) => v.id === f.id) && !["scope-id", "principal-id"].includes(f.id)
            ? f.id
            : undefined);
      const query =
        name === "trust" && ["reads", "replies", "approvals"].includes(f.id)
          ? dcRef("dc-recorded-activity-query")
          : name === "abuse" && f.id === "history-decisions"
            ? dcRef("dc-adjudication-history-query")
            : undefined;
      const selected = recordInputs[f.id],
        record =
          selected &&
          f.id !== "subject-id" &&
          f.id !== "progress-id" &&
          p.records.find((r) => r.entity.id === entity(selected[0]).id);
      return {
        field: f.id,
        source: query
          ? "query"
          : direct
            ? "input"
            : scopeInput.has(f.id)
              ? "trusted-context"
              : record
                ? "record"
                : "owner-derived",
        ...(query ? { query } : {}),
        ...(direct ? { input: [direct] } : {}),
        ...(record ? { entity: record.entity, fields: [selected![1]] } : { fields: [] }),
        ...(!direct && !scopeInput.has(f.id) && !record
          ? {
              derivation: derivations[f.id],
              ...(f.id === "policy-version"
                ? { literal: name === "render" ? "render-v1" : "restructure-v1" }
                : {}),
            }
          : {}),
      };
    });
    const writes = o.writes.filter((w) => {
      const e = m.entities.find((e) => contractKey(e) === contractKey(w.entity));
      return (
        !e?.fields.find((f) => f.field === w.field)?.serverOwned &&
        !m.lifecycles!.some(
          (l) => contractKey(l.state.entity) === contractKey(w.entity) && l.state.field === w.field,
        )
      );
    });
    const caseId = discourseCoreTrace.find(
      (row) =>
        row.id ===
        `D${13 + ["trust", "abuse", "digest", "render", "restructure", "privacy", "email", "ranking"].indexOf(name!)}`,
    )!;
    const first =
      caseId.observations.find((ob) => ob.category === "failure") ?? caseId.observations[0]!;
    const scenario = first.scenarios[0]!;
    const hook: BackendHook = {
      id,
      version: "v1",
      name: `JH-${name} · ${caseId.id}`,
      operation: dcRef(o.id),
      owner: o.target.owner,
      kind: "pure",
      boundary: "before-commit",
      contracts: {
        input: dcRef(`${id}-input`),
        output: dcRef(`${id}-output`),
        error: dcRef(errorId),
      },
      context: [
        "principal-provenance",
        "authorized-scope",
        "correlation",
        "cancellation",
        "deadline",
      ],
      authority: "current-policy-at-observation",
      dependencies: [],
      repositories: [],
      services: [],
      allowedWrites: writes,
      writeMode: "validated-proposals-only",
      allowedEffects: [],
      result: "validate-exact-contract-before-use",
      privateData: "authorized-input-only",
      required: true,
      readiness: "before-mutation",
      timeoutSeconds: 2,
      cancellation: "cooperative-no-forced-termination",
      unavailable: { outcome: "status-503", status: 503, writes: "none" },
      failure: {
        operation: dcRef(o.id),
        scope: "source-transaction",
        error: "hook-failed",
        invalidResult: "hook-failed",
        timeout: "hook-failed",
        cancelled: "hook-cancelled",
      },
      acceptance: caseId.observations.map((o) => o.id),
      seam: { file: `src/hooks/${name}.ts`, ownership: "scaffold-once-project-owned" },
      recovery: [
        {
          trigger: "hook-failure",
          strategy: "confirmed-rollback",
          operation: dcRef(o.id),
          outcome: "hook-failed",
          scenario: { id: scenario.id.toLowerCase(), outcome: first.id.toLowerCase() },
          invariants: [{ aggregate: o.aggregate, invariant: "version-fence" }],
        },
      ],
    };
    m.hooks!.push(hook);
  }
}
function addEffects(design: DesignDocument) {
  const a = design.architecture!,
    m = a.backend!;
  const eventFields: ContractField[] = [
    {
      id: "event-id",
      name: "eventId",
      type: "uuid",
      required: true,
      description: "Stable post-created identity; one per accepted source command.",
    },
    {
      id: "scope-id",
      name: "scopeId",
      type: "uuid",
      required: true,
      description: "Validated source scope.",
    },
    {
      id: "post-id",
      name: "postId",
      type: "uuid",
      required: true,
      description: "Committed source post.",
    },
    {
      id: "actor-id",
      name: "actorId",
      type: "uuid",
      required: true,
      description: "Provenance only; recipient current policy remains mandatory.",
    },
    {
      id: "at",
      name: "at",
      type: "timestamp",
      required: true,
      description: "Server event cutoff; subscriptions created later are ineligible.",
    },
  ];
  a.contracts!.push({
    id: "dc-post-created-event",
    version: "v1",
    name: "Post created intent",
    kind: "event",
    coverage: "Complete",
    description:
      "Atomic source intent; bounded fan-out from persisted recipients, no copied private text or initiating actor authority.",
    shape: { payload: eventFields, operations: [] },
  });
  const safeFields: ContractField[] = [
    {
      id: "actor-id",
      name: "actorId",
      type: "uuid",
      required: true,
      description: "Server principal.",
    },
    {
      id: "target-id",
      name: "targetId",
      type: "uuid",
      required: true,
      description: "Selected current target.",
    },
    { id: "at", name: "at", type: "timestamp", required: true, description: "Server clock." },
    {
      id: "action",
      name: "action",
      type: "text",
      minLength: 1,
      maxLength: 80,
      required: true,
      description: "Safe action metadata only.",
    },
  ];
  a.contracts!.push({
    id: "dc-audit-intent",
    version: "v1",
    name: "Protected mutation audit intent",
    kind: "data",
    coverage: "Complete",
    description:
      "Metadata-only audit from the authorized command, same SQL connection; no source text or credentials.",
    shape: { payload: safeFields, operations: [] },
  });
  const effect = (
    o: BackendOperation,
    target: BackendEffect["target"],
    payload: string,
    values: BackendEffect["values"],
    local = false,
  ) => {
    const ob =
        discourseCoreTrace
          .flatMap((r) => r.observations)
          .find(
            (ob) =>
              ob.operations.some((op) => kebab(op) === o.target.operation) &&
              ob.category === "failure",
          ) ??
        discourseCoreTrace
          .flatMap((r) => r.observations)
          .find((ob) => ob.operations.some((op) => kebab(op) === o.target.operation))!,
      sc = ob.scenarios[0]!;
    const e: BackendEffect = {
      id: `${o.id}-${local ? "audit" : "post-created"}`,
      version: "v1",
      name: `${o.name} ${local ? "safe audit" : "post-created intent"}`,
      source: dcRef(o.id),
      target,
      boundary: local ? "before-commit" : "atomic-intent",
      execution: local ? "local" : "durable-intent",
      payload: dcRef(payload),
      values,
      when: ["success"],
      required: true,
      loss: { kind: "forbidden" },
      after: [],
      delivery: {
        identity: "operation-version-scope-command-effect-recipient",
        context: local ? "source-transaction-context" : "verified-service-actor-provenance-only",
        recheck: "current-policy-before-effect",
        recipient: "single-target",
        guarantee: local ? "local-atomic" : "at-least-once",
        acknowledgement: local ? "same-commit" : "durable-terminal-result",
        attempts: local ? 1 : 3,
        backoffSeconds: local ? 0 : 1,
        timeoutSeconds: 2,
        exhausted: "operator-visible",
        duplicates: "deduplicated-local-effect",
      },
      recovery: [
        ...(["uncertain-commit", ...(!local ? ["lost-acknowledgement"] : [])] as const).map(
          (trigger) => ({
            trigger: trigger as "uncertain-commit" | "lost-acknowledgement",
            strategy: "same-command-key" as const,
            operation: dcRef(o.id),
            outcome: "uncertain",
            scenario: { id: sc.id.toLowerCase(), outcome: ob.id.toLowerCase() },
            invariants: [{ aggregate: o.aggregate, invariant: "version-fence" }],
          }),
        ),
      ],
    };
    m.effects!.push(e);
    if (local && "dataset" in target) {
      const entity = m.entities.find((v) => v.dataset === target.dataset)!;
      o.transaction.participants.push(dcRef(entity.id));
      o.protocol!.records.push({
        entity: dcRef(entity.id),
        policy: dcRef(`${entity.id}-policy`),
        action: "read",
        readProjection: "read",
        selection: "local-effect",
        keys: [],
        writes: [],
      });
    }
  };
  for (const o of m.operations!) {
    if (["create-topic", "reply", "inbound-email"].includes(o.target.operation))
      effect(
        o,
        { kind: "event", contract: dcRef("dc-post-created-event") },
        "dc-post-created-event",
        [
          { field: "event-id", value: { kind: "server", factory: "uuid" } },
          { field: "scope-id", value: { kind: "context", value: "scope" } },
          { field: "post-id", value: current("post", "id") },
          { field: "actor-id", value: { kind: "context", value: "principal" } },
          { field: "at", value: { kind: "server", factory: "clock" } },
        ],
      );
    if (
      [
        "transition-topic",
        "transition-post",
        "review-flag",
        "evaluate-trust",
        "adjudicate",
        "restructure",
        "privacy",
      ].includes(o.target.operation)
    )
      effect(
        o,
        {
          kind: "audit",
          dataset: ["evaluate-trust", "privacy"].includes(o.target.operation)
            ? "dc-administrative-audit-dataset"
            : "dc-audit-dataset",
          contract: dcRef(
            ["evaluate-trust", "privacy"].includes(o.target.operation)
              ? "dc-administrative-audit-data"
              : "dc-audit-data",
          ),
        },
        ["evaluate-trust", "privacy"].includes(o.target.operation)
          ? "dc-administrative-audit-data"
          : "dc-audit-data",
        [
          { field: "id", value: { kind: "server", factory: "uuid" } },
          { field: "scope-id", value: { kind: "context", value: "scope" } },
          { field: "version", value: { kind: "server", factory: "initial-version" } },
          { field: "created-at", value: { kind: "server", factory: "clock" } },
          ...(["evaluate-trust", "privacy"].includes(o.target.operation)
            ? []
            : [{ field: "category-id", value: current("topic", "category-id") }]),
          { field: "actor-id", value: { kind: "context", value: "principal" } },
          { field: "target-id", value: current(recipes[o.target.operation]!.root, "id") },
          { field: "at", value: { kind: "server", factory: "clock" } },
          { field: "action", value: lit(o.target.operation) },
        ],
        true,
      );
  }
}
function addAdministrativeAudit(design: DesignDocument) {
  const a = design.architecture!,
    m = a.backend!,
    old = m.entities.find((e) => e.id === "dc-audit-entity")!;
  const c = structuredClone(a.contracts!.find((c) => c.id === "dc-audit-data")!);
  c.id = "dc-administrative-audit-data";
  c.name = "Protected workspace administrative audit";
  c.description =
    "Scope-bound trust/privacy metadata has no invented category. Kept separate from category-scoped moderation observations; no ordinary text/export authority.";
  c.shape!.payload = c.shape!.payload.filter((f) => f.id !== "category-id");
  a.contracts!.push(c);
  const d = structuredClone(a.datasets!.find((d) => d.id === "dc-audit-dataset")!);
  d.id = "dc-administrative-audit-dataset";
  d.name = c.name;
  d.contract = dcRef(c.id);
  a.datasets!.push(d);
  const e = structuredClone(old);
  e.id = "dc-administrative-audit-entity";
  e.name = c.name;
  e.contract = dcRef(c.id);
  e.dataset = d.id;
  e.storageId = "dc-administrative-audit-table";
  e.fields = e.fields.filter((f) => f.field !== "category-id");
  e.relations = [];
  m.entities.push(e);
  const policy = structuredClone(m.accessPolicies!.find((p) => p.id === "dc-audit-entity-policy")!);
  policy.id = `${e.id}-policy`;
  policy.name = c.name;
  policy.resource = dcRef(e.id);
  policy.clauses = policy.clauses.filter((c) =>
    ["authenticated", "moderator", "admin"].includes(c.id),
  );
  policy.rules = policy.rules.map((r) => ({
    ...r,
    when: { operator: "all", clauses: ["authenticated", "moderator"] },
  }));
  for (const p of policy.projections) {
    p.fields = p.fields.filter((f) => f !== "category-id");
    p.when = { operator: "all", clauses: ["authenticated", "moderator"] };
  }
  m.accessPolicies!.push(policy);
}

/** Privileged composition reads are explicit and narrower than changing ordinary owner policies. */
function addParticipantPolicies(design: DesignDocument) {
  const m = design.architecture!.backend!;
  const add = (resource: string, id: string, parentOwner = false, moderator = false) => {
    const p = structuredClone(
      m.accessPolicies!.find((p) => p.id === `dc-${resource}-entity-policy`)!,
    );
    p.id = id;
    p.name = id.replaceAll("-", " ");
    if (parentOwner && !p.clauses.some((c) => c.id === "privacy-owner"))
      p.clauses.push({ id: "privacy-owner", kind: "owner", via: "post", field: "author-id" });
    const who = parentOwner ? "privacy-owner" : moderator ? "moderator" : "owner";
    const groups = moderator ? [["category-read", "moderator"]] : [[who], ["admin"]];
    p.rules = groups.map((clauses, i) => ({
      id: `composition-${i + 1}`,
      effect: "allow",
      actions: [
        "read",
        "list",
        "idempotent-replay",
        "export",
        ...(moderator || resource === "notification" ? ["write"] : []),
      ],
      when: { operator: "all", clauses },
    }));
    for (const projection of p.projections)
      projection.when = { operator: "any", clauses: [who, ...(moderator ? [] : ["admin"])] };
    if (resource === "revision")
      for (const projection of p.projections)
        projection.fields = projection.fields.filter((f) => f !== "text");
    m.accessPolicies!.push(p);
  };
  add("subscription", "dc-restructure-subscription-policy", false, true);
  add("hold", "dc-privacy-hold-policy", true);
  add("revision", "dc-privacy-revision-policy", true);
  add("subscription", "dc-privacy-subscription-policy");
  add("notification", "dc-privacy-notification-policy");
}

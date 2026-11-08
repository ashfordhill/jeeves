/**
 * Reviewed design guidance, loaded locally by chat. These records are not capability contracts,
 * runtime templates or evidence that a generated application works. Version changes are explicit;
 * defaults and permitted links still come from studio-definitions and studio-links.
 */
import { z } from "zod";
import type { StudioKind } from "./studio-model.ts";
import type { StudioCommand } from "./studio-operations.ts";

export const studioPatternCatalogVersion = "1.0.0";
export const studioPatternIds = [
  "cache-aside-lookup",
  "durable-background-job",
  "publication-to-search",
  "pending-order-payment",
] as const;
export const studioPatternIdSchema = z.enum(studioPatternIds);
export type StudioPatternId = (typeof studioPatternIds)[number];

export type StudioPattern = {
  id: StudioPatternId;
  version: string;
  name: string;
  applicability: string;
  roles: readonly { id: string; responsibility: string }[];
  /** Requirements describe the architecture, including relationships the canvas cannot express. */
  relationships: readonly {
    from: string;
    to: string;
    interaction: "request" | "async";
    requirement: string;
  }[];
  variants: readonly { name: string; applicability: string; tradeoff: string }[];
  checklist: readonly { id: string; invariant: string; failure: string }[];
  sources: readonly { title: string; url: string }[];
  support: {
    topology: "representable" | "partial";
    represented: readonly string[];
    obligations: readonly { id: string; limitation: string; implementation: string }[];
    templateAvailability: "none";
    runtimeVerification: "none";
  };
  example:
    | { kind: "commands"; scope: string; commands: readonly StudioCommand[] }
    | { kind: "obligation"; scope: string; sequence: readonly string[] };
};

const outbox = {
  title: "AWS: Transactional outbox",
  url: "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html",
};
const outboxObligation = {
  id: "transaction-and-delivery",
  limitation:
    "Publisher outbox settings express intent; no transaction or delivery contract is enforced.",
  implementation:
    "Commit the authoritative database change and publication intent in the same database transaction. Relay committed intents with retries; consumers deduplicate stable event IDs. This does not atomically include object storage, a remote payment or another database.",
};
const lifecycleObligation = {
  id: "same-owner-result",
  limitation:
    "The no-cycle lane graph cannot express an asynchronous result returning to the same initiating service. Packages partially express shared ownership, but chat cannot create packages and access is inferred from owner, not per operation.",
  implementation:
    "Keep one logical owner for the initiating API and result consumer. Persist entity ID, operation/attempt ID and transitions; accept a result only for the current attempt, handle duplicates and reject stale or cancelled results. Report the missing lifecycle contract explicitly; never invent another independently owned service to satisfy lane rules.",
};

// Examples start from emptyDesign(), use ordinary canvas commands and leave all kind/link
// defaults to the existing catalogs. Tests execute every batch through the real command builder.
function first(id: string, name: string, lane: "upload" | "download"): StudioCommand {
  return {
    type: "addTile",
    from: { lane },
    side: "after",
    tile: { id, name, kind: "service" },
    linkId: `${lane}-${id}`,
    system: { name: `${name} example` },
  };
}
function after(from: string, id: string, name: string, kind: StudioKind): StudioCommand {
  return {
    type: "addTile",
    from: { tile: from },
    side: "after",
    tile: { id, name, kind },
    linkId: `${from}-${id}`,
  };
}

export const studioPatterns: Readonly<Record<StudioPatternId, StudioPattern>> = {
  "cache-aside-lookup": {
    id: "cache-aside-lookup",
    version: "1.0.0",
    name: "Cache-aside lookup",
    applicability:
      "Repeated reads where a declared freshness policy permits a disposable cache. Useful for short-link lookup and public metadata; choose consistency before adding replicas or caching redirect responses.",
    roles: [
      {
        id: "lookup",
        responsibility:
          "Read the cache, load the authority on a miss and fill the reader-owned cache.",
      },
      {
        id: "cache",
        responsibility: "Disposable derived entries, with bounded positive and negative lifetimes.",
      },
      {
        id: "authority",
        responsibility:
          "Own durable records and decide expired, disabled, deleted or unauthorized results.",
      },
    ],
    relationships: [
      {
        from: "lookup",
        to: "cache",
        interaction: "request",
        requirement:
          "Read and fill on misses; an owner read is currently inferred as write in the blueprint.",
      },
      {
        from: "lookup",
        to: "authority",
        interaction: "request",
        requirement:
          "Load authoritative data on misses. If independently owned, use its API/contract rather than assuming access to another service's tables.",
      },
    ],
    variants: [
      {
        name: "One service owns data and cache",
        applicability: "Small systems with one business boundary.",
        tradeoff: "Simpler ownership; scaling reads still needs a freshness policy.",
      },
      {
        name: "Reader-owned derived cache",
        applicability:
          "Separate read path with an explicit owner API or deliberate read projection.",
        tradeoff:
          "TTL and invalidation bound staleness; direct cross-service table reads create schema coupling.",
      },
      {
        name: "Redirect response caching",
        applicability: "Only if edge/browser hits may bypass the lookup publisher.",
        tradeoff:
          "For per-redirect analytics count those hits at the edge too, or disable response caching. Approximate analytics must declare loss and duplication; adding a queue cannot recover bypassed hits.",
      },
    ],
    checklist: [
      {
        id: "cache-loss",
        invariant: "Cache eviction/loss falls back to the authority.",
        failure:
          "Define cache outage fallback and stampede/single-flight behavior; protect the authority under load.",
      },
      {
        id: "lookup-visibility",
        invariant:
          "Expiry and visibility affect lookup immediately according to the declared policy, independently of cleanup.",
        failure:
          "Handle stale positive and negative entries, invalidation races, unknown/disabled links and authorization changes.",
      },
      {
        id: "read-after-create",
        invariant: "Read-after-create/publish has an explicit consistency policy.",
        failure:
          "A replica or negative cache can still miss a committed record; choose primary reads, routing or bounded retry/invalidation.",
      },
      {
        id: "analytics-scope",
        invariant: "Analytics has an explicit reader or is an external reporting sink.",
        failure:
          "CDN/browser response-cache hits may bypass click publication; define loss, duplicate handling and reporting access.",
      },
    ],
    sources: [
      {
        title: "Microsoft: Cache-aside pattern",
        url: "https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside",
      },
    ],
    support: {
      topology: "representable",
      represented: [
        "Service requests to database and cache; cache-reader TTL, negative-cache and stampede settings express intent.",
      ],
      obligations: [
        {
          id: "freshness-and-access",
          limitation:
            "No typed invalidation, authorization or consistency contract; owner access conflates reads and writes.",
          implementation:
            "Specify allowed staleness, negative caching, expiry/visibility checks, owner API or projection, read-after-write behavior and cache failure recovery.",
        },
        {
          id: "redirect-analytics",
          limitation:
            "A CDN setting and analytics links do not prove every redirect publishes an event.",
          implementation:
            "Choose response-cache and analytics scope together; instrument edge hits or disable response caching when every redirect must reach the publisher. Define analytics loss/duplication and who reads the sink.",
        },
      ],
      templateAvailability: "none",
      runtimeVerification: "none",
    },
    example: {
      kind: "commands",
      scope:
        "Topology only: a single service owns the database and cache. Its database lookup is still inferred as write; these tiles implement no lookup behavior.",
      commands: [
        first("lookup", "Lookup", "download"),
        after("lookup", "records", "Records", "database"),
        after("lookup", "lookup-cache", "Lookup cache", "cache"),
        {
          type: "editConnection",
          connection: "lookup-records",
          planned: { label: "Loads on a miss" },
        },
        {
          type: "editConnection",
          connection: "lookup-lookup-cache",
          planned: { label: "Reads and fills" },
        },
      ],
    },
  },
  "durable-background-job": {
    id: "durable-background-job",
    version: "1.0.0",
    name: "Durable background job",
    applicability:
      "Slow or retryable work separated from an interactive request, such as media processing. Queues distribute work; they do not guarantee that a job executes only once.",
    roles: [
      {
        id: "owner",
        responsibility:
          "Own durable entity/lifecycle state, authorize work and correlate attempts/results.",
      },
      {
        id: "source",
        responsibility: "Keep durable versioned input bytes for retry or reprocessing.",
      },
      {
        id: "jobs",
        responsibility:
          "Deliver references and job metadata, with an explicit delivery/retry policy.",
      },
      {
        id: "worker",
        responsibility:
          "Read source, produce versioned output and report success/failure; processing success does not grant publication.",
      },
      {
        id: "outputs",
        responsibility: "Keep generated assets with stable operation/version identity.",
      },
    ],
    relationships: [
      {
        from: "owner",
        to: "source",
        interaction: "request",
        requirement:
          "Authorize/finalize durable input; signed upload control is separate from direct client byte transfer.",
      },
      {
        from: "owner",
        to: "jobs",
        interaction: "async",
        requirement:
          "Reliably schedule entity ID, source object/version and attempt ID after confirmed upload.",
      },
      {
        from: "jobs",
        to: "worker",
        interaction: "async",
        requirement:
          "Consume with bounded retries, acknowledgement/lease policy and poison-job recovery.",
      },
      {
        from: "worker",
        to: "source",
        interaction: "request",
        requirement: "Read the durable original, never put video bytes in the job message.",
      },
      {
        from: "worker",
        to: "outputs",
        interaction: "request",
        requirement: "Write safely repeatable/versioned outputs before reporting success.",
      },
      {
        from: "worker",
        to: "owner",
        interaction: "async",
        requirement:
          "Return correlated success/failure to the same logical owner; this return is not representable by the current acyclic canvas.",
      },
    ],
    variants: [
      {
        name: "Competing workers",
        applicability: "One logical work subscription with multiple worker instances.",
        tradeoff:
          "Redelivery or lease expiry can overlap executions; use stable IDs, deduplication and safe side effects.",
      },
      {
        name: "Independent subscribers",
        applicability: "Multiple responsibilities each need an event.",
        tradeoff:
          "Use explicit subscriptions/consumer groups; a topic name alone does not specify delivery to each consumer.",
      },
    ],
    checklist: [
      {
        id: "durable-before-processing",
        invariant: "Durable application state precedes processing.",
        failure:
          "Multipart part lists are transport state, not pending/failed/cancelled video state or creator permissions.",
      },
      {
        id: "duplicate-delivery",
        invariant: "Retries and duplicate deliveries are safe.",
        failure:
          "Crash after output commit but before acknowledgement must not duplicate effects; bound retries and define dead-letter inspection/replay.",
      },
      {
        id: "current-attempt",
        invariant: "Only a current attempt may advance the owner's state.",
        failure:
          "Reject delayed success after cancellation or a newer attempt, and reconcile missing notifications/results.",
      },
      {
        id: "storage-reconciliation",
        invariant:
          "Database state plus publish intent share a local transaction when an outbox is chosen.",
        failure:
          "Storage finalization and database updates are not atomic; use resumable reconciliation/provider notifications, stable operation IDs and safe retries.",
      },
    ],
    sources: [
      {
        title: "AWS SQS: At-least-once delivery",
        url: "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html",
      },
      {
        title: "AWS: Video on demand architecture",
        url: "https://docs.aws.amazon.com/solutions/latest/video-on-demand-on-aws-foundation/architecture-overview.html",
      },
      outbox,
    ],
    support: {
      topology: "partial",
      represented: [
        "Service → queue → worker; ordinary worker reads/writes to durable source/output stores. Retry settings remain design intent.",
      ],
      obligations: [
        lifecycleObligation,
        outboxObligation,
        {
          id: "durable-attempt",
          limitation:
            "No entity, job payload, transition, acknowledgement or reconciliation contract exists.",
          implementation:
            "Persist pending/processing/failed/cancelled state and permissions, correlate source version and attempts, define duplicate-safe outputs, timeouts, retries, dead-letter recovery and storage/database reconciliation. Processing success is distinct from committed publication.",
        },
      ],
      templateAvailability: "none",
      runtimeVerification: "none",
    },
    example: {
      kind: "commands",
      scope:
        "Partial topology only: durable source and worker output dependencies. The result returning to Video and lifecycle/recovery remain explicit obligations; no extra completion-owner service is introduced.",
      commands: [
        first("video", "Video", "upload"),
        after("video", "video-state", "Video state", "database"),
        after("video", "originals", "Originals", "object-store"),
        after("video", "jobs", "Processing jobs", "queue"),
        after("jobs", "processor", "Processor", "worker"),
        after("processor", "outputs", "Outputs", "object-store"),
        {
          type: "linkTiles",
          from: { tile: "processor" },
          to: "originals",
          linkId: "processor-originals",
        },
        {
          type: "editConnection",
          connection: "processor-originals",
          planned: { label: "Reads originals" },
        },
      ],
    },
  },
  "publication-to-search": {
    id: "publication-to-search",
    version: "1.0.0",
    name: "Committed publication to search",
    applicability:
      "Search is a derived, eventually consistent projection of authoritative published records, including later updates, unpublication and deletion. Retrieve durable-background-job as well for an upload/processing lifecycle.",
    roles: [
      {
        id: "owner",
        responsibility:
          "Own authoritative state and commit the decision to publish, update or unpublish.",
      },
      {
        id: "events",
        responsibility:
          "Carry committed publication changes with stable event ID, entity ID and version.",
      },
      {
        id: "indexer",
        responsibility:
          "Apply version-aware, duplicate-safe updates/removals and rebuild from authority.",
      },
      {
        id: "index",
        responsibility: "Derived search data; never the authority for visibility or checkout.",
      },
    ],
    relationships: [
      {
        from: "owner",
        to: "events",
        interaction: "async",
        requirement:
          "Emit publication intent coupled to the authoritative database commit, not a raw processing-success event.",
      },
      {
        from: "events",
        to: "indexer",
        interaction: "async",
        requirement: "Consume committed changes with independent subscription and replay policy.",
      },
      {
        from: "indexer",
        to: "index",
        interaction: "request",
        requirement:
          "Apply only current versions; handle deletion/unpublication and duplicate/out-of-order events.",
      },
    ],
    variants: [
      {
        name: "Publication outbox",
        applicability: "Owner state and event intent can share one database transaction.",
        tradeoff:
          "Reliable relay still duplicates messages and requires consumer deduplication/version checks.",
      },
      {
        name: "Media processing before publication",
        applicability: "Uploads that must finish processing before their owner may publish them.",
        tradeoff:
          "The same owner accepts only the current processing attempt, commits Ready/Failed/Cancelled and a visibility decision, then publishes VideoPublished/Updated/Unpublished. A Shop listing publisher does not need transcode states. The processing callback remains outside the current no-cycle model.",
      },
      {
        name: "Authoritative change stream",
        applicability:
          "A deliberately supported CDC mechanism observes committed publication state.",
        tradeoff:
          "Store-to-channel links are currently refused; record this unsupported requirement rather than disguising it as an implemented publisher.",
      },
    ],
    checklist: [
      {
        id: "publication-decision",
        invariant:
          "A publication event follows the owner's committed visibility decision. In media, TranscodeSucceeded describes outputs; VideoPublished describes that decision.",
        failure:
          "Sibling metadata/search consumers of processing success can expose search results before an authoritative record exists.",
      },
      {
        id: "projection-ordering",
        invariant: "Indexing follows committed publication and removal.",
        failure:
          "Handle stale/duplicate events, index outages, lag, replay and complete rebuild; define a version/tombstone rule.",
      },
      {
        id: "read-after-publish",
        invariant: "Serving checks authoritative visibility and a declared freshness policy.",
        failure:
          "Even post-commit publication can race replicas/negative caches; define read-after-publish and prevent deleted/private results being served.",
      },
    ],
    sources: [
      outbox,
      {
        title: "Microsoft: Materialized view pattern",
        url: "https://learn.microsoft.com/en-us/azure/architecture/patterns/materialized-view",
      },
    ],
    support: {
      topology: "partial",
      represented: [
        "Owner → event channel → indexer → search index and owner's database; event-publisher outbox settings express intent.",
      ],
      obligations: [
        outboxObligation,
        {
          id: "publication-contract",
          limitation:
            "No typed publication events, version ordering, visibility or projection freshness contract; processing callbacks to the same owner remain unrepresentable.",
          implementation:
            "Commit the authoritative publish/update/unpublish decision before emitting its event. Define event IDs, entity versions, visibility policy, index removals/rebuild, read-after-publish, replica/negative-cache behavior and serving authorization. For media processing, use the media variant and durable-background-job obligations; sibling metadata/search consumers of processing success do not establish publication ordering.",
        },
      ],
      templateAvailability: "none",
      runtimeVerification: "none",
    },
    example: {
      kind: "commands",
      scope:
        "Publication projection topology only, starting at the owner after its publication decision. No processing lifecycle, outbox transaction or event schema is implemented by these commands.",
      commands: [
        first("publisher", "Publication owner", "upload"),
        after("publisher", "records", "Published records", "database"),
        after("publisher", "published", "Publication events", "queue"),
        after("published", "indexer", "Search indexer", "worker"),
        after("indexer", "search-index", "Search index", "search"),
        {
          type: "editConnection",
          connection: "publisher-published",
          planned: { label: "Committed publication" },
        },
      ],
    },
  },
  "pending-order-payment": {
    id: "pending-order-payment",
    version: "1.0.0",
    name: "Pending order and payment coordination",
    applicability:
      "A narrow fixed-price checkout profile. Declare finite stock versus unlimited inventory and choose payment/fulfilment scope. Taxes, shipping, refunds, seller settlement, auctions and regional policy are separate scope decisions, not promises of a Billing tile.",
    roles: [
      {
        id: "orders",
        responsibility:
          "Own durable Pending orders/checkout attempts, item/price snapshot and order transitions before requesting payment.",
      },
      {
        id: "catalog",
        responsibility:
          "Provide authoritative prices/availability; for finite stock, reserve with concurrency rules and expiry, then commit/release.",
      },
      {
        id: "payments",
        responsibility:
          "Own provider interaction/payment records, stable idempotency/correlation and authenticated notifications.",
      },
      {
        id: "provider",
        responsibility:
          "Report payment outcomes, including delayed or unknown outcomes requiring reconciliation.",
      },
    ],
    relationships: [
      {
        from: "orders",
        to: "catalog",
        interaction: "request",
        requirement:
          "Recheck authoritative price/availability through the owner's contract, not search or another service's private tables; reserve finite stock before the chosen payment step.",
      },
      {
        from: "orders",
        to: "payments",
        interaction: "request",
        requirement:
          "Persist Pending first; request payment with stable order/attempt ID, price snapshot and idempotency key.",
      },
      {
        from: "provider",
        to: "payments",
        interaction: "async",
        requirement:
          "Verify signature; deduplicate and handle unordered notifications with provider-state reconciliation.",
      },
      {
        from: "payments",
        to: "orders",
        interaction: "async",
        requirement:
          "Correlated outcome advances the same order owner under valid transitions; a timeout is unknown, not proof of failure.",
      },
    ],
    variants: [
      {
        name: "One owned boundary",
        applicability:
          "Orders, inventory and payment handlers are roles within one business service.",
        tradeoff:
          "Local data transactions simplify coordination; the remote payment still needs idempotency and reconciliation.",
      },
      {
        name: "Persisted cross-service workflow",
        applicability: "Inventory, Orders and Payments are independently owned services.",
        tradeoff:
          "Persist progress and compensations such as stock release/refund requests; compensation can fail and is not distributed database rollback.",
      },
      {
        name: "Unlimited inventory",
        applicability: "Explicitly scoped non-scarce goods.",
        tradeoff:
          "Reservation may be excluded, but Pending state, authoritative pricing and payment reconciliation remain required.",
      },
    ],
    checklist: [
      {
        id: "pending-before-payment",
        invariant: "A durable Pending attempt exists before external payment side effects.",
        failure:
          "Correlate retries/provider sessions; avoid duplicate charges/orders, and reconcile an ambiguous timeout before retrying with a new identity.",
      },
      {
        id: "finite-stock",
        invariant: "Finite stock has an atomic reservation/concurrency rule and expiry.",
        failure:
          "Prevent overselling, release on failure/cancellation/expiry, and resolve payment success arriving after expiry.",
      },
      {
        id: "notification-transitions",
        invariant: "Payment and order state have explicit owners and legal transitions.",
        failure:
          "Authenticate duplicate/delayed/unordered webhooks; a late notification cannot resurrect cancelled state without a declared recovery decision.",
      },
      {
        id: "persisted-recovery",
        invariant: "Recovery survives process restarts.",
        failure:
          "Persist workflow progress and retryable compensations; reconcile missing outcomes, and expose failed stock-release/refund actions for recovery.",
      },
    ],
    sources: [
      { title: "Stripe: Webhook delivery and signatures", url: "https://docs.stripe.com/webhooks" },
      {
        title: "Microsoft: Saga pattern",
        url: "https://learn.microsoft.com/en-us/azure/architecture/patterns/saga",
      },
      {
        title: "Microsoft: Microservice data ownership",
        url: "https://learn.microsoft.com/en-us/azure/architecture/microservices/design/data-considerations",
      },
    ],
    support: {
      topology: "partial",
      represented: [
        "Service/Billing kinds, owned stores and request/event links express participants and integration intent only. Billing's provider is its integration; do not add an External tile for Stripe.",
      ],
      obligations: [
        lifecycleObligation,
        outboxObligation,
        {
          id: "checkout-contract",
          limitation:
            "No order/payment/reservation schemas, transitions, idempotency or compensation contract exists. Free-text modules do not implement them.",
          implementation:
            "Before payment persist Pending plus immutable item/price snapshot and attempt IDs; use authoritative owner pricing/availability. For finite stock specify atomic reservation, expiry, commit/release and late-payment recovery. Persist payment correlation, signature verification, duplicate/unordered notification handling, unknown-outcome reconciliation and compensations. State exclusions explicitly.",
        },
      ],
      templateAvailability: "none",
      runtimeVerification: "none",
    },
    example: {
      kind: "obligation",
      scope:
        "Conceptual lifecycle only. The payment outcome returns to the same Orders owner; no executable tile workaround is offered for the current no-cycle/ownership limits.",
      sequence: [
        "Orders commits Pending(orderId, attemptId, item/price snapshot).",
        "Orders checks Catalog/Inventory authority and reserves finite stock with concurrency and expiry rules when in scope.",
        "Orders requests Payments using stable correlation/idempotency; Payments persists provider interaction and treats timeout as unknown.",
        "Payments authenticates/deduplicates notifications and reconciles provider state; the same Orders owner accepts only valid correlated transitions.",
        "Commit stock/order success or persist release/refund compensation and reconciliation; local outbox intent shares only its owner's database transaction.",
      ],
    },
  },
};

/** Bounded index for discovery. A describe call supplies the full obligations before edits. */
export function listStudioPatterns() {
  return {
    catalogVersion: studioPatternCatalogVersion,
    patterns: studioPatternIds.map((id) => {
      const { version, name, applicability, support } = studioPatterns[id];
      return { id, version, name, applicability, topology: support.topology };
    }),
    availability: "Reviewed design guidance only; no runtime templates or runtime verification.",
  };
}

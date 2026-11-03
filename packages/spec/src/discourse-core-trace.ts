/** Design trace to the frozen D ledger. References are acceptance identities, never pass records. */
export const discourseCoreTrace = [
  {
    id: "D01",
    weight: 5,
    target: "G",
    source: "dc-session",
    supportingSources: ["dc-principal"],
    decisions: ["JD-protocol", "JD-scope"],
    adaptation:
      "Reuse Jeeves server-established durable sessions and mutation protections; do not port the upstream SHA-1 token derivation or infer restart/cross-application isolation from this model alone.",
    observations: [
      {
        id: "D01-session-cycle",
        caseId: "D01",
        category: "success",
        expected:
          "Register, log in, mutate with the protected session, and log out; credentials never appear in responses or logs.",
        critical: false,
        operations: ["register", "login", "logout", "getSession"],
        scenarios: [
          {
            id: "D-create",
            steps: [
              "register",
              "login",
              "logout",
              "session-logged-out",
              "login-admin-after-expiry",
              "login-alice-after-expiry",
            ],
          },
        ],
      },
      {
        id: "D01-session-boundary",
        caseId: "D01",
        category: "rejection",
        expected:
          "Unauthenticated, forged or cross-application sessions and missing mutation protections are rejected.",
        critical: false,
        operations: ["register", "getSession", "createTopic"],
        scenarios: [
          {
            id: "D-create",
            steps: ["register-role", "cross-app-cookie", "csrf-denied", "origin-denied"],
          },
        ],
      },
      {
        id: "D01-restart-session",
        caseId: "D01",
        category: "failure",
        expected:
          "A valid durable session survives API restart; a logged-out session remains invalid after restart.",
        critical: false,
        operations: ["getSession"],
        scenarios: [
          {
            id: "D-create",
            steps: ["session-restart"],
          },
        ],
      },
    ],
  },
  {
    id: "D02",
    weight: 5,
    target: "G",
    source: "dc-category",
    supportingSources: ["dc-principal", "dc-topic-access"],
    decisions: ["JD-scope", "JD-command"],
    adaptation:
      "Finite current group/category grants; only an authorized privileged command changes membership or moderator authority. Same-scope references and replay uniqueness are Jeeves requirements.",
    observations: [
      {
        id: "D02-category-grants",
        caseId: "D02",
        category: "success",
        expected:
          "Public categories are readable and current group grants permit the intended private-category actions.",
        critical: false,
        operations: ["putGrant", "putMembership"],
        scenarios: [
          {
            id: "D-create",
            steps: ["grant"],
          },
          {
            id: "D-revoke",
            steps: ["grant-bob"],
          },
        ],
      },
      {
        id: "D02-privilege-escalation",
        caseId: "D02",
        category: "rejection",
        expected:
          "An ordinary member cannot self-grant moderator access or use cross-scope group/category references.",
        critical: false,
        operations: ["putMembership", "putGrant"],
        scenarios: [
          {
            id: "D-create",
            steps: ["self-promote", "foreign-grant"],
          },
        ],
      },
      {
        id: "D02-grant-replay",
        caseId: "D02",
        category: "failure",
        expected:
          "Repeated membership/grant commands preserve one effective relationship and recheck current authority.",
        critical: false,
        operations: ["putGrant", "putSubscription"],
        scenarios: [
          {
            id: "D-create",
            steps: ["grant-replay", "inspect-16"],
          },
          {
            id: "D-revoke",
            steps: ["revoked-replay"],
          },
        ],
      },
    ],
  },
  {
    id: "D03",
    weight: 6,
    target: "G",
    source: "dc-create",
    supportingSources: [],
    decisions: ["JD-command"],
    adaptation:
      "Preserve topic/first-post atomicity; add SQL command receipts, canonical body conflict and atomic event intent for lost-response retry. Upstream unique-post-key storage after the transaction is not this guarantee.",
    observations: [
      {
        id: "D03-topic-first-post",
        caseId: "D03",
        category: "success",
        expected: "An authorized create persists one topic and its initial post together.",
        critical: false,
        operations: ["createTopic"],
        scenarios: [
          {
            id: "D-create",
            steps: ["create-retry", "inspect-27"],
          },
        ],
      },
      {
        id: "D03-denied-create",
        caseId: "D03",
        category: "rejection",
        expected:
          "An unauthorized category reference is rejected without a topic, post or event intent.",
        critical: false,
        operations: ["createTopic"],
        scenarios: [
          {
            id: "D-create",
            steps: ["denied-create"],
          },
        ],
      },
      {
        id: "D03-atomicity",
        caseId: "D03",
        category: "failure",
        expected:
          "Failure before the initial post insert leaves neither topic nor post nor committed event intent.",
        critical: true,
        operations: ["createTopic"],
        scenarios: [
          {
            id: "D-create",
            steps: ["invalid-first-post", "create-rollback", "inspect-21"],
          },
        ],
      },
      {
        id: "D03-lost-response-retry",
        caseId: "D03",
        category: "failure",
        expected:
          "After a committed response is lost, same-key/body retry returns the original topic and post; changed body conflicts.",
        critical: true,
        operations: ["createTopic"],
        scenarios: [
          {
            id: "D-create",
            steps: [
              "create-lost",
              "create-retry",
              "inspect-27",
              "changed-replay",
              "parallel-identical-owner",
              "identical-retry",
              "inspect-34",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "D04",
    weight: 7,
    target: "G",
    source: "dc-revise",
    supportingSources: ["dc-post-access", "dc-revision-access"],
    decisions: ["JD-history", "JD-command"],
    adaptation:
      "Append immutable prior text/author/time on each accepted edit; compare expectedVersion atomically. Upstream may update/delete the existing revision during its edit grace period; no upstream stale-write guarantee was established.",
    observations: [
      {
        id: "D04-reply-edit-history",
        caseId: "D04",
        category: "success",
        expected:
          "Authorized replies and edits preserve immutable previous text, author and timestamp in revision history.",
        critical: false,
        operations: ["reply", "postHistory"],
        scenarios: [
          {
            id: "D-edit",
            steps: ["reply", "history"],
          },
        ],
      },
      {
        id: "D04-foreign-author",
        caseId: "D04",
        category: "rejection",
        expected:
          "An unauthorized author cannot edit another principal's post or read a protected revision.",
        critical: false,
        operations: ["editPost"],
        scenarios: [
          {
            id: "D-edit",
            steps: ["foreign-edit", "foreign-public-edit"],
          },
        ],
      },
      {
        id: "D04-stale-write",
        caseId: "D04",
        category: "failure",
        expected:
          "Two edits at one expectedVersion produce exactly one next version and one new revision; the loser conflicts.",
        critical: true,
        operations: ["editPost"],
        scenarios: [
          {
            id: "D-edit",
            steps: ["parallel-edit-winner", "inspect-4"],
          },
        ],
      },
    ],
  },
  {
    id: "D05",
    weight: 6,
    target: "G",
    source: "dc-topic-access",
    supportingSources: ["dc-post-access", "dc-remove"],
    decisions: ["JD-moderation", "JD-command"],
    adaptation:
      "Use the benchmark open/closed/archived and visible/hidden/removed transition tables; a rejected or stale action changes no state or effect. Source permissions/deletion paths are inspiration, not proof of these exact transitions.",
    observations: [
      {
        id: "D05-allowed-transitions",
        caseId: "D05",
        category: "success",
        expected:
          "Authorized close/reopen/archive and hide/restore/remove commands follow their declared transitions.",
        critical: false,
        operations: ["transitionTopic", "transitionPost"],
        scenarios: [
          {
            id: "D-edit",
            steps: ["parallel-close-winner", "reopen", "archive", "hide", "restore"],
          },
          {
            id: "D-moderate",
            steps: ["remove"],
          },
        ],
      },
      {
        id: "D05-invalid-transition",
        caseId: "D05",
        category: "rejection",
        expected:
          "An invalid or unauthorized transition, including an ordinary reply to a closed topic, leaves state unchanged.",
        critical: false,
        operations: ["reply", "transitionTopic", "transitionPost"],
        scenarios: [
          {
            id: "D-edit",
            steps: ["closed-reply", "reopen-archive-denied", "inspect-16"],
          },
          {
            id: "D-moderate",
            steps: ["restore-removed-denied"],
          },
        ],
      },
      {
        id: "D05-transition-race",
        caseId: "D05",
        category: "failure",
        expected:
          "Stale/repeated lifecycle commands cannot apply a transition or audit/effect twice.",
        critical: false,
        operations: ["transitionTopic"],
        scenarios: [
          {
            id: "D-edit",
            steps: ["parallel-close-winner", "inspect-16"],
          },
        ],
      },
    ],
  },
  {
    id: "D06",
    weight: 6,
    target: "G",
    source: "dc-category",
    supportingSources: [
      "dc-topic-access",
      "dc-post-access",
      "dc-search",
      "dc-upload-route",
      "dc-mail",
      "dc-notification-cleanup",
    ],
    decisions: ["JD-scope", "JD-history", "JD-effects", "JD-files", "JD-query"],
    adaptation:
      "Revoke across all six frozen observations, including lists, counts and pending effects. Upstream cached category IDs, asynchronous notification cleanup and expiring byte URLs do not establish immediate cross-path revocation.",
    observations: [
      {
        id: "D06-granted-access",
        caseId: "D06",
        category: "success",
        expected:
          "Current category members can observe content through every authorized surface before revocation.",
        critical: false,
        operations: ["getTopic", "listTopics", "downloadFile"],
        scenarios: [
          {
            id: "D-revoke",
            steps: ["bob-read", "bob-page-before", "bob-bytes-before"],
          },
        ],
      },
      {
        id: "D06-denied-detail",
        caseId: "D06",
        category: "rejection",
        expected: "Revoked members cannot read topic/post detail or protected revision text.",
        critical: true,
        operations: ["getTopic", "listPosts", "postHistory"],
        scenarios: [
          {
            id: "D-create",
            steps: ["bob-private"],
          },
          {
            id: "D-revoke",
            steps: ["revoked-detail", "revoked-posts", "revoked-history"],
          },
        ],
      },
      {
        id: "D06-denied-list",
        caseId: "D06",
        category: "rejection",
        expected:
          "Revoked members cannot see private titles, counts or records in lists and pages.",
        critical: true,
        operations: ["listTopics"],
        scenarios: [
          {
            id: "D-revoke",
            steps: ["revoked-cursor", "revoked-list"],
          },
        ],
      },
      {
        id: "D06-denied-search",
        caseId: "D06",
        category: "rejection",
        expected:
          "Revoked members cannot see private titles, snippets or counts in search, including stale projections.",
        critical: true,
        operations: ["search"],
        scenarios: [
          {
            id: "D-create",
            steps: ["bob-search-create"],
          },
          {
            id: "D-revoke",
            steps: ["revoked-search"],
          },
        ],
      },
      {
        id: "D06-denied-bytes",
        caseId: "D06",
        category: "rejection",
        expected:
          "Revoked members cannot download private attachment bytes, including through a previously issued byte URL.",
        critical: true,
        operations: ["downloadFile"],
        scenarios: [
          {
            id: "D-revoke",
            steps: ["revoked-byte-url"],
          },
        ],
      },
      {
        id: "D06-pending-notification",
        caseId: "D06",
        category: "failure",
        expected:
          "Revocation before queued notification materialization/delivery prevents private content from being disclosed.",
        critical: true,
        operations: ["inbox"],
        scenarios: [
          {
            id: "D-revoke",
            steps: ["revoked-inbox", "inspect-23"],
          },
        ],
      },
    ],
  },
  {
    id: "D07",
    weight: 5,
    target: "G",
    source: "dc-subscription",
    supportingSources: ["dc-alert"],
    decisions: ["JD-scope", "JD-command"],
    adaptation:
      "Store one scoped principal/topic subscription and bounded channel preferences. Authenticate the preference owner at the API boundary; this internal upstream model accepts user_id and does not itself supply route authorization.",
    observations: [
      {
        id: "D07-watch-mute-preferences",
        caseId: "D07",
        category: "success",
        expected:
          "Watch/mute and channel preferences change the authorized principal's effective subscription.",
        critical: false,
        operations: ["putSubscription"],
        scenarios: [
          {
            id: "D-revoke",
            steps: ["watch", "mute", "rewatch"],
          },
        ],
      },
      {
        id: "D07-foreign-preferences",
        caseId: "D07",
        category: "rejection",
        expected:
          "Another principal cannot change or enumerate a private subscription by direct identity.",
        critical: false,
        operations: ["putSubscription"],
        scenarios: [
          {
            id: "D-revoke",
            steps: ["foreign-preference"],
          },
        ],
      },
      {
        id: "D07-duplicate-subscription",
        caseId: "D07",
        category: "failure",
        expected:
          "Duplicate/retried commands preserve one subscription under its scoped principal/topic key.",
        critical: false,
        operations: ["putSubscription"],
        scenarios: [
          {
            id: "D-revoke",
            steps: ["watch-replay", "inspect-11", "revoked-replay"],
          },
        ],
      },
    ],
  },
  {
    id: "D08",
    weight: 6,
    target: "G",
    source: "dc-alert",
    supportingSources: ["dc-job", "dc-mail", "dc-notification-cleanup"],
    decisions: ["JD-effects", "JD-command"],
    adaptation:
      "Use durable database inbox receipts and rechecked eligibility. Upstream checks recent existing notifications and publishes jobs after commit; that is not a proved concurrent crash/retry deduplication guarantee.",
    observations: [
      {
        id: "D08-eligible-inbox",
        caseId: "D08",
        category: "success",
        expected:
          "A currently eligible recipient receives the declared durable inbox item and delivery intent.",
        critical: false,
        operations: ["inbox"],
        scenarios: [
          {
            id: "D-failure",
            steps: ["inbox-after-restart"],
          },
        ],
      },
      {
        id: "D08-ineligible-recipient",
        caseId: "D08",
        category: "rejection",
        expected:
          "Muted, unauthorized or revoked recipients receive no private notification projection.",
        critical: false,
        operations: ["inbox"],
        scenarios: [
          {
            id: "D-failure",
            steps: ["author-inbox", "revoked-inbox-failure"],
          },
        ],
      },
      {
        id: "D08-crash-deduplication",
        caseId: "D08",
        category: "failure",
        expected:
          "Crash after inbox commit before acknowledgement, then restart/retry, leaves one logical inbox item per recipient/event.",
        critical: true,
        operations: ["inbox"],
        scenarios: [
          {
            id: "D-failure",
            steps: ["inspect-5", "inbox-after-restart", "inspect-12"],
          },
        ],
      },
    ],
  },
  {
    id: "D09",
    weight: 5,
    target: "G",
    source: "dc-upload-route",
    supportingSources: ["dc-upload-policy", "dc-create"],
    decisions: ["JD-files", "JD-scope"],
    adaptation:
      "Authorize metadata, association and bytes from the current controlling content policy, including foreign file rejection and recoverable partial association. Upload creator/cleanup internals are not audited by this pack.",
    observations: [
      {
        id: "D09-file-lifecycle",
        caseId: "D09",
        category: "success",
        expected:
          "Allowed bounded bytes can be staged, inspected, attached and downloaded by an authorized principal.",
        critical: false,
        operations: ["stageFile", "putFileBytes", "attachFile", "downloadFile"],
        scenarios: [
          {
            id: "D-failure",
            steps: ["stage", "upload", "associate-retry", "download"],
          },
        ],
      },
      {
        id: "D09-foreign-byte-access",
        caseId: "D09",
        category: "rejection",
        expected:
          "Foreign/private files cannot be associated or fetched; incomplete/quarantined bytes are never downloadable.",
        critical: true,
        operations: ["downloadFile", "attachFile"],
        scenarios: [
          {
            id: "D-failure",
            steps: ["foreign-download", "private-download", "foreign-attach"],
          },
        ],
      },
      {
        id: "D09-invalid-upload",
        caseId: "D09",
        category: "rejection",
        expected:
          "Oversized or disallowed MIME uploads are rejected without an available attachment.",
        critical: false,
        operations: ["stageFile", "putFileBytes", "downloadFile"],
        scenarios: [
          {
            id: "D-failure",
            steps: ["oversize", "unsafe-mime", "hash-mismatch", "incomplete-download"],
          },
        ],
      },
      {
        id: "D09-association-orphan",
        caseId: "D09",
        category: "failure",
        expected:
          "Failed SQL association or interrupted object persistence leaves no available partial file and a recoverable orphan for bounded cleanup.",
        critical: false,
        operations: ["attachFile", "downloadFile", "putFileBytes"],
        scenarios: [
          {
            id: "D-failure",
            steps: [
              "associate-fault",
              "inspect-17",
              "orphan-bytes",
              "associate-retry",
              "bytes-fault",
              "inspect-35",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "D10",
    weight: 5,
    target: "G",
    source: "dc-review",
    supportingSources: ["dc-post-access", "dc-remove"],
    decisions: ["JD-moderation", "JD-command"],
    adaptation:
      "One active reporter/post review identity, version-fenced moderator review, atomic post action and safe audit. This excerpt shows available actions and actor attribution; base review locking/queue concurrency is outside inspected evidence.",
    observations: [
      {
        id: "D10-flag-review-audit",
        caseId: "D10",
        category: "success",
        expected:
          "A member submits a flag; an authorized moderator reviews it and applies the declared action with immutable actor audit.",
        critical: false,
        operations: ["flagPost", "reviewQueue", "audit"],
        scenarios: [
          {
            id: "D-moderate",
            steps: ["flag", "review-queue", "inspect-8", "review-audit"],
          },
        ],
      },
      {
        id: "D10-unauthorized-review",
        caseId: "D10",
        category: "rejection",
        expected: "Ordinary members cannot invoke moderator review or claim another scope's flag.",
        critical: false,
        operations: ["reviewQueue", "reviewFlag"],
        scenarios: [
          {
            id: "D-moderate",
            steps: ["ordinary-review", "ordinary-review-write"],
          },
        ],
      },
      {
        id: "D10-duplicate-stale-review",
        caseId: "D10",
        category: "failure",
        expected:
          "Duplicate flags preserve one active review; competing/stale review claims cause one action and one logical effect.",
        critical: false,
        operations: ["flagPost", "reviewFlag"],
        scenarios: [
          {
            id: "D-moderate",
            steps: ["duplicate-flag", "parallel-review-winner", "inspect-8"],
          },
        ],
      },
    ],
  },
  {
    id: "D11",
    weight: 5,
    target: "G",
    source: "dc-search",
    supportingSources: ["dc-topic-access"],
    decisions: ["JD-query", "JD-history"],
    adaptation:
      "Replace upstream offset/relevance paging with bounded scoped keyset contracts, current-policy candidate filtering and rebuildable projections. No full upstream listing/reindex audit or measured search guarantee is claimed.",
    observations: [
      {
        id: "D11-bounded-search-pages",
        caseId: "D11",
        category: "success",
        expected:
          "Topic/post lists and search use bounded stable cursor pages with authoritative access filtering before counts and snippets.",
        critical: false,
        operations: ["listTopics", "search"],
        scenarios: [
          {
            id: "D-moderate",
            steps: ["topic-page-one", "topic-page-two", "search-page-one", "search-page-two"],
          },
        ],
      },
      {
        id: "D11-invalid-cursor-scope",
        caseId: "D11",
        category: "rejection",
        expected:
          "Invalid, foreign or oversized paging input is rejected; interleaved inaccessible hits are absent.",
        critical: false,
        operations: ["listTopics", "search"],
        scenarios: [
          {
            id: "D-moderate",
            steps: [
              "cursor-foreign-scope",
              "cursor-query-mismatch",
              "cursor-tamper",
              "too-large-page",
            ],
          },
        ],
      },
      {
        id: "D11-projection-rebuild",
        caseId: "D11",
        category: "failure",
        expected:
          "Rebuild and retry restore the projection without resurrecting removed content or bypassing current category access.",
        critical: false,
        operations: ["search"],
        scenarios: [
          {
            id: "D-moderate",
            steps: ["rebuilt-search", "rebuilt-deleted"],
          },
        ],
      },
    ],
  },
  {
    id: "D12",
    weight: 5,
    target: "G",
    source: "dc-remove",
    supportingSources: ["dc-revision-access", "dc-post-access", "dc-search"],
    decisions: ["JD-history", "JD-moderation", "JD-command"],
    adaptation:
      "Retain explicit tombstones and bounded protected audit, remove ordinary text from every history/search projection, and make repeated removal safe. Upstream permanent deletion can destroy revision records; retention policy is deliberately distinct.",
    observations: [
      {
        id: "D12-tombstone-audit",
        caseId: "D12",
        category: "success",
        expected:
          "Authorized removal produces the declared tombstone and preserved safe audit history.",
        critical: false,
        operations: ["transitionPost", "listPosts", "audit"],
        scenarios: [
          {
            id: "D-moderate",
            steps: ["remove", "removed-posts", "removed-audit"],
          },
        ],
      },
      {
        id: "D12-removed-history-visibility",
        caseId: "D12",
        category: "rejection",
        expected: "Removed text is absent from ordinary detail and revision-history outputs.",
        critical: true,
        operations: ["postHistory"],
        scenarios: [
          {
            id: "D-moderate",
            steps: ["hidden-history", "removed-history"],
          },
        ],
      },
      {
        id: "D12-removed-search-visibility",
        caseId: "D12",
        category: "rejection",
        expected:
          "Removed text, snippets and disclosing counts remain absent from ordinary search, including stale projections.",
        critical: true,
        operations: ["search"],
        scenarios: [
          {
            id: "D-moderate",
            steps: ["hidden-search", "removed-search"],
          },
        ],
      },
      {
        id: "D12-repeated-removal",
        caseId: "D12",
        category: "failure",
        expected:
          "Repeated removal/recovery is safe and cannot restore removed text or duplicate logical audit/effects.",
        critical: false,
        operations: ["transitionPost"],
        scenarios: [
          {
            id: "D-moderate",
            steps: ["remove-replay", "remove-again", "inspect-20"],
          },
        ],
      },
    ],
  },
  {
    id: "D13",
    weight: 4,
    target: "H",
    source: "JH-trust",
    supportingSources: [],
    decisions: ["JD-scope", "JD-command"],
    adaptation:
      "Activity and overrides remain project policy; trust-level threshold algorithms were not inspected. Do not treat their omission as unavailable open-source functionality.",
    observations: [
      {
        id: "D13-trust-progression",
        caseId: "D13",
        category: "success",
        expected:
          "Recorded activity and the frozen threshold policy propose promote/demote levels with reasons and privileged overrides.",
        critical: false,
        operations: ["evaluateTrust"],
        scenarios: [
          {
            id: "D-create",
            steps: ["trust-promote", "trust-demote", "trust-override"],
          },
        ],
      },
      {
        id: "D13-untrusted-counters",
        caseId: "D13",
        category: "rejection",
        expected:
          "Client activity counters or unauthorized override requests cannot grant trust or privileges.",
        critical: false,
        operations: ["evaluateTrust"],
        scenarios: [
          {
            id: "D-create",
            steps: ["trust-counter", "trust-self"],
          },
        ],
      },
      {
        id: "D13-activity-replay",
        caseId: "D13",
        category: "failure",
        expected:
          "Repeated/reordered activity evaluation does not count activity twice or bypass the authorized level-change command.",
        critical: false,
        operations: ["evaluateTrust"],
        scenarios: [
          {
            id: "D-create",
            steps: ["trust-replay", "inspect-45", "trust-unavailable"],
          },
        ],
      },
    ],
  },
  {
    id: "D14",
    weight: 5,
    target: "H",
    source: "JH-abuse",
    supportingSources: ["dc-review"],
    decisions: ["JD-moderation"],
    adaptation:
      "Flag review informs an extension seam, not an abuse classifier. Preserve explicit false-positive appeal and moderator override without conflating request limiting with adjudication.",
    observations: [
      {
        id: "D14-adjudication-appeal",
        caseId: "D14",
        category: "success",
        expected:
          "The selected abuse policy returns allow/review/reject and supports explicit appeal and moderator override.",
        critical: false,
        operations: ["adjudicate"],
        scenarios: [
          {
            id: "D-moderate",
            steps: ["abuse-evaluate", "abuse-appeal", "abuse-moderator-override"],
          },
        ],
      },
      {
        id: "D14-policy-authority",
        caseId: "D14",
        category: "rejection",
        expected:
          "Untrusted content cannot execute policy, disclose private history or grant itself a moderator override.",
        critical: false,
        operations: ["adjudicate"],
        scenarios: [
          {
            id: "D-moderate",
            steps: ["abuse-unprivileged-override"],
          },
        ],
      },
      {
        id: "D14-adjudication-unavailable",
        caseId: "D14",
        category: "failure",
        expected:
          "Timeout/unavailable policy remains explicit and fail-closed before a required mutation; replay does not apply an action twice.",
        critical: false,
        operations: ["adjudicate"],
        scenarios: [
          {
            id: "D-moderate",
            steps: ["abuse-unavailable", "inspect-42"],
          },
        ],
      },
    ],
  },
  {
    id: "D15",
    weight: 5,
    target: "H",
    source: "JH-digest",
    supportingSources: ["dc-mail", "dc-alert"],
    decisions: ["JD-effects", "JD-query"],
    adaptation:
      "Source mail code rechecks digest preferences; selection, timezone windows and scheduling policy are a Jeeves hook, not established by that excerpt.",
    observations: [
      {
        id: "D15-digest-window",
        caseId: "D15",
        category: "success",
        expected:
          "Digest selection uses the declared timezone/window and bounded eligible references.",
        critical: false,
        operations: ["scheduleDigest"],
        scenarios: [
          {
            id: "D-revoke",
            steps: ["digest-schedule"],
          },
        ],
      },
      {
        id: "D15-digest-exclusions",
        caseId: "D15",
        category: "rejection",
        expected:
          "Muted or inaccessible content and private recipient information are absent from digest output.",
        critical: false,
        operations: ["scheduleDigest"],
        scenarios: [
          {
            id: "D-revoke",
            steps: ["digest-schedule", "digest-foreign"],
          },
        ],
      },
      {
        id: "D15-digest-delivery-retry",
        caseId: "D15",
        category: "failure",
        expected:
          "Duplicate schedules/retries follow the declared delivery identity and recheck access before materialization.",
        critical: false,
        operations: ["scheduleDigest", "getDigest"],
        scenarios: [
          {
            id: "D-revoke",
            steps: [
              "digest-replay",
              "digest-uncertain",
              "inspect-32",
              "digest-delivered",
              "digest-unavailable",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "D16",
    weight: 4,
    target: "H",
    source: "JH-render",
    supportingSources: ["dc-alert"],
    decisions: ["JD-history", "JD-effects"],
    adaptation:
      "Plain text is the core. Upstream raw mention extraction is context only; no renderer/sanitizer was audited. Rich-text parsing and sanitization require the separately tested hook.",
    observations: [
      {
        id: "D16-safe-render-mentions",
        caseId: "D16",
        category: "success",
        expected:
          "The selected bounded renderer produces sanitized text/markup and typed mention identities.",
        critical: false,
        operations: ["render"],
        scenarios: [
          {
            id: "D-create",
            steps: ["render-safe", "render-public-mention"],
          },
        ],
      },
      {
        id: "D16-unsafe-render-recipient",
        caseId: "D16",
        category: "rejection",
        expected:
          "Executable markup and excessive parse input are rejected/sanitized; inaccessible recipients receive no mention notification.",
        critical: false,
        operations: ["render"],
        scenarios: [
          {
            id: "D-create",
            steps: ["render-xss", "render-over-budget"],
          },
        ],
      },
      {
        id: "D16-renderer-unavailable",
        caseId: "D16",
        category: "failure",
        expected:
          "Cancelled, timed-out or unavailable required rendering never becomes a successful mutation or unvalidated output.",
        critical: false,
        operations: ["render"],
        scenarios: [
          {
            id: "D-create",
            steps: ["render-unavailable", "inspect-56"],
          },
        ],
      },
    ],
  },
  {
    id: "D17",
    weight: 4,
    target: "H",
    source: "JH-restructure",
    supportingSources: ["dc-topic-access"],
    decisions: ["JD-scope", "JD-history", "JD-command"],
    adaptation:
      "Upstream exposes split/merge permission checks; its move implementation was not inspected. Preserve post IDs/history and re-evaluate access/subscriptions through a bounded command plan with declared recovery.",
    observations: [
      {
        id: "D17-split-merge-history",
        caseId: "D17",
        category: "success",
        expected:
          "Authorized split/merge preserves post identities/history and applies explicit access/subscription decisions.",
        critical: false,
        operations: ["restructure"],
        scenarios: [
          {
            id: "D-edit",
            steps: ["split", "merge", "inspect-26"],
          },
        ],
      },
      {
        id: "D17-merge-authority",
        caseId: "D17",
        category: "rejection",
        expected:
          "Foreign topics, unauthorized post selections and stale expected versions are rejected.",
        critical: false,
        operations: ["restructure"],
        scenarios: [
          {
            id: "D-edit",
            steps: ["split-foreign", "cross-category-merge"],
          },
        ],
      },
      {
        id: "D17-split-merge-recovery",
        caseId: "D17",
        category: "failure",
        expected:
          "Interrupted split/merge is atomic or follows the declared recovery plan without lost/duplicated posts or widened visibility.",
        critical: false,
        operations: ["restructure"],
        scenarios: [
          {
            id: "D-edit",
            steps: ["merge-rollback", "inspect-23", "merge", "restructure-unavailable"],
          },
        ],
      },
    ],
  },
  {
    id: "D18",
    weight: 4,
    target: "H",
    source: "JH-privacy",
    supportingSources: [],
    decisions: ["JD-scope", "JD-history", "JD-effects"],
    adaptation:
      "No upstream export/erasure implementation was inspected. Retention, legal hold, identity/content treatment and queued delivery cancellation remain explicit Jeeves policy decisions.",
    observations: [
      {
        id: "D18-privacy-plan",
        caseId: "D18",
        category: "success",
        expected:
          "Authorized export/erasure produces the declared bounded plan, retained audit reasons and legal-hold decisions.",
        critical: false,
        operations: ["privacy"],
        scenarios: [
          {
            id: "D-revoke",
            steps: ["privacy-export", "privacy-resume"],
          },
        ],
      },
      {
        id: "D18-privacy-boundary",
        caseId: "D18",
        category: "rejection",
        expected:
          "Another subject cannot export/erase private data or bypass retention/hold authority.",
        critical: false,
        operations: ["privacy"],
        scenarios: [
          {
            id: "D-revoke",
            steps: ["privacy-foreign"],
          },
        ],
      },
      {
        id: "D18-privacy-resume",
        caseId: "D18",
        category: "failure",
        expected:
          "Interrupted/repeated execution resumes safely and cancels affected queued deliveries without disclosing erased content.",
        critical: false,
        operations: ["privacy"],
        scenarios: [
          {
            id: "D-revoke",
            steps: [
              "privacy-erase-interrupted",
              "privacy-resume",
              "inspect-50",
              "privacy-unavailable",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "D19",
    weight: 4,
    target: "H",
    source: "JH-email",
    supportingSources: [],
    decisions: ["JD-scope", "JD-command", "JD-files"],
    adaptation:
      "No inbound-email parser/authentication implementation was inspected. The hook authenticates a source envelope and deduplicates message IDs before a normalized reply invokes ordinary posting authorization.",
    observations: [
      {
        id: "D19-email-reply",
        caseId: "D19",
        category: "success",
        expected:
          "Authenticated inbound source and sender mapping produce an authorized topic reply with message provenance.",
        critical: false,
        operations: ["inboundEmail"],
        scenarios: [
          {
            id: "D-edit",
            steps: ["mail-reply"],
          },
        ],
      },
      {
        id: "D19-email-source-authority",
        caseId: "D19",
        category: "rejection",
        expected:
          "Unauthenticated sources, ambiguous topic/sender mappings and unauthorized posting are rejected.",
        critical: false,
        operations: ["inboundEmail"],
        scenarios: [
          {
            id: "D-edit",
            steps: ["mail-unverified", "mail-foreign"],
          },
        ],
      },
      {
        id: "D19-email-deduplication",
        caseId: "D19",
        category: "failure",
        expected:
          "Repeated message IDs and delivery retries create one logical reply; unavailable mapping remains explicit.",
        critical: false,
        operations: ["inboundEmail"],
        scenarios: [
          {
            id: "D-edit",
            steps: [
              "mail-replay",
              "mail-conflicting-replay",
              "mail-ambiguous",
              "inspect-37",
              "mail-unavailable",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "D20",
    weight: 4,
    target: "H",
    source: "JH-ranking",
    supportingSources: ["dc-search"],
    decisions: ["JD-query"],
    adaptation:
      "Upstream relevance ordering is context, not the benchmark discovery policy. Only authorized candidates enter a versioned deterministic ranking hook; freshness/rebuild rules remain explicit.",
    observations: [
      {
        id: "D20-deterministic-ranking",
        caseId: "D20",
        category: "success",
        expected:
          "Ranking orders authorized candidates with deterministic tie-breaks and declared freshness.",
        critical: false,
        operations: ["rank"],
        scenarios: [
          {
            id: "D-moderate",
            steps: ["rank"],
          },
        ],
      },
      {
        id: "D20-ranking-visibility",
        caseId: "D20",
        category: "rejection",
        expected:
          "A strategy cannot add inaccessible candidates or disclose hidden features through ranking/counts.",
        critical: false,
        operations: ["rank"],
        scenarios: [
          {
            id: "D-moderate",
            steps: ["rank", "rank-foreign-candidate"],
          },
        ],
      },
      {
        id: "D20-ranking-rebuild",
        caseId: "D20",
        category: "failure",
        expected:
          "Rebuild/repeated evaluation preserves the defined ordering/freshness and current visibility; unavailable strategy is explicit.",
        critical: false,
        operations: ["rank"],
        scenarios: [
          {
            id: "D-moderate",
            steps: ["rank-rebuilt", "rank-repeated", "rank-stale", "rank-unavailable"],
          },
        ],
      },
    ],
  },
];

import { contractKey } from "./architecture-contracts.ts";
import type { DesignDocument } from "./design.ts";
/** Derived linkage report, never a second editable model or an acceptance/scoring result. */
export function discourseCoreDesignTrace(design: DesignDocument) {
  const a = design.architecture,
    m = a?.backend;
  const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return discourseCoreTrace.map((row) => {
    const names = new Set(row.observations.flatMap((o) => o.operations.map(kebab)));
    const wire =
      a?.contracts
        ?.filter((c) => c.kind === "api" && c.version === "v2")
        .flatMap(
          (c) =>
            c.shape?.operations
              .filter((o) => names.has(o.id))
              .map((o) => ({
                contract: { id: c.id, version: c.version },
                operation: o.id,
                ...(o.behavior?.session ? { session: o.behavior.session } : {}),
              })) ?? [],
        ) ?? [];
    const operations = m?.operations?.filter((o) => names.has(o.target.operation)) ?? [];
    const effects =
      m?.effects?.filter((e) => operations.some((o) => contractKey(o) === contractKey(e.source))) ??
      [];
    return {
      id: row.id,
      target: row.target,
      weight: row.weight,
      source: row.source,
      supportingSources: row.supportingSources,
      adaptation: row.adaptation,
      wire,
      operations: operations.map((o) => ({ id: o.id, version: o.version })),
      data: [
        ...new Map(
          operations.flatMap((o) => o.transaction.participants).map((r) => [contractKey(r), r]),
        ).values(),
      ],
      policies: [
        ...new Map(
          operations
            .flatMap((o) => o.protocol?.records.map((r) => r.policy) ?? [])
            .map((r) => [contractKey(r), r]),
        ).values(),
      ],
      queries: [
        ...new Map(
          operations.flatMap((o) => o.protocol?.queries ?? []).map((r) => [contractKey(r), r]),
        ).values(),
      ],
      hooks:
        m?.hooks
          ?.filter((h) => operations.some((o) => contractKey(o) === contractKey(h.operation)))
          .map((h) => ({ id: h.id, version: h.version })) ?? [],
      effects: effects.map((e) => ({ id: e.id, version: e.version })),
      observations: row.observations.map((o) => ({ ...o, observed: "not-run" as const })),
      scenarios: [
        ...new Set(row.observations.flatMap((o) => o.scenarios.map((s) => s.id.toLowerCase()))),
      ],
      runtime: "unsupported" as const,
      observedPoints: 0 as const,
    };
  });
}

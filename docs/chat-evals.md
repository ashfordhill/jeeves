# Chat design evaluations

RF06 eval **1.0.0** is a small versioned, synthetic architecture suite. It evaluates design intent
and honest unresolved requirements. It supplies no generated runtime, template or verification.
It is separate from scripted browser E2E tests.

From the repository root (Node 24 first in PATH):

```sh
pnpm eval:chat
pnpm eval:chat --report=/absolute/path/to/recorded-report.json
```

The first command replays hand-authored canonical fixtures twice through the real ChatService
and a separate RF00 ablation loop in disposable, in-process PGlite projects. It checks identical
design semantics, emitted obligations and tool results. The second replays a recorded live
report with request-context hashes. Both replace `fetch` with a throwing function. Neither
constructs an external provider nor needs a key, Docker, Postgres or network. Unit tests also
exercise negative outcomes and the strict codec's replay seam, including synthesized review
calls. A changed prompt, fixture or tool result fails recorded replay rather than quietly
supplying another model answer.

Explicit live opt-in sends only these synthetic prompts/designs:

```sh
pnpm eval:chat --live --allow-paid-api --report=/absolute/path/to/new-mini-report.json
env -u OPENAI_API_KEY -u CODEX_API_KEY pnpm eval:chat --live --allow-paid-api --provider=codex --report=/absolute/path/to/new-codex-report.json
```

The OpenAI path requires `OPENAI_API_KEY`, requests the application's default economical profile
pinned to `gpt-5.4-mini-2026-03-17`, and uses the production strict Responses adapter without
changing owner settings. Reasoning effort is omitted; the documented default is none. Limits
are 16 model responses, 4,096 output tokens per response, 180 seconds per case and SDK retries
zero. Access/schema rejection stops further calls. Failed usage/cost stays unknown. List-price
estimates, when token usage exists, are labeled estimates, not billing.

The separately authorized fallback uses the existing Codex SDK adapter, CLI login, requested
`gpt-6.1-sol` alias and its existing **medium** effort. It requires API-key variables unset in
that subprocess. Round/time limits apply equally to both arms. The adapter does not forward
`maxOutputTokens`; the 4,096 request value is **not an enforced output limit** for Codex. CLI/SDK
retry behavior is not controlled by this runner. Cost is unknown; Mini API prices are not applied
to a ChatGPT login. Codex constrains the outer answer, with JSON-string tool arguments validated
by the server. It provides no strict Responses API acceptance or Mini quality evidence.

Six paired cases cover video build and publication repair, finite-stock checkout build and a
held-out late/duplicate notification edit, TinyURL response-cache analytics repair and a held-out
unsupported capability edit. Both arms get the same task, seed, response/time budget and provider.
Held-out means a fixed variation outside the three pattern examples, not an unseen training set
or a statistical generalization claim. No prompt tuning or result-based case selection occurs.

`jeeves/apps/server/src/eval/cases.ts` versions prompts, seeds, protected identities and reasonable
alternatives; `fixtures/synthetic.json` contains hand-authored canonical replies/commands.
`fixtures/rf00.json` preserves the RF00 instructions and six canonical tools from `4e2cd15`,
captured at `30f1c9b` (that source file was unchanged). The RF00 arm is deliberately a
**guidance/tools/no-review ablation**, sharing current context, command engine and atomic save;
it is not faithful execution of the complete old application. Its undeclared tools refuse and
continue without executing current pattern/scope/review tools. Current evaluation uses the
unmodified production ChatService, including the review continuation and repair gate. No current
`reviewDesign` call is replayed under the baseline's six-tool map.

The external rubric checks represented dependencies, ownership, resource distinctions, settings,
protected element/settings/owner/modules and exact preservation for unsupported edits. It does
not prescribe one exact graph or tile count. Publication repair accepts a separate authoritative
owner feed to the existing indexer while keeping same-owner lifecycle contracts unresolved.
Names and modules never establish pending status, publication commits, idempotency, reservation
or notification transitions. Those requirements must be explicit unresolved obligations.

Obligation text is accepted from status-bearing review output or ordinary plain-language replies
in either arm. Synonym/phrase matches and the narrow false-claim scan are **needs-review evidence
signals**. A marker elsewhere in prose cannot certify a requirement, and missing a term cannot
by itself establish a semantic violation. An independent agent reviews all public replies,
canonical commands/results and final graphs against the same requirement, records ambiguities,
reasonable alternatives and critical defects. That is AGENT review, not owner/human review.
Readability also requires mouse inspection at both supported viewports. Owner review remains
pending until the owner actually supplies it. The proposing model never grades itself.

Reports retain exact model request configuration, prompt/tools/pattern/eval/source hashes,
canonical responses, public text, tool results, saved design, refusal count, questions, latency
and provider token/cached-token usage. `repairBatches` means **attempted response batches containing
commands or scope mutation after a review result was received**, including refused/no-op attempts;
it is not production repair passes consumed. Every project is deleted and the PGlite instance
closed. Only credentials stay in process memory. Credentials, HTTP headers and provider opaque
or encrypted reasoning items are never saved; required opaque continuation items remain in memory
during live runs and are omitted for offline canonical replay.

Critical destructive changes, falsely implemented unsupported capabilities or critical domain
invariant violations block release claims. Successful graph checks cannot waive them. A small
one-sample-per-case suite has substantial uncertainty and establishes neither population-level
improvement nor runtime correctness. See [RF06 reports](evals/rf06/README.md) for actual results,
access failures, independent review and remaining limitations.

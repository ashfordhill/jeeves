# Chat design evaluations

RF06 eval **1.1.0** (1.0.0 until V3-09) is a small versioned, synthetic architecture suite. It evaluates design intent
and honest unresolved requirements. It supplies no generated runtime, template or verification.
It is separate from scripted browser E2E tests.

From the repository root (Node 24 first in PATH):

```sh
pnpm eval:chat
pnpm eval:chat --report=/absolute/path/to/recorded-report.json
```

The first command also runs the [design evals](#design-evals-v3-10)' scripted runs (V3-10); add
`--suite=rf06` for RF06 alone. It replays hand-authored canonical fixtures twice through the real
ChatService and a separate RF00 ablation loop in disposable, in-process PGlite projects. It checks identical
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

## Eval 1.1.0: no new Billing tile (V3-09)

Since V3-09 chat adds new tiles only of the link fan's kinds (D6), so a new Billing tile is
refused. Two checkout inputs used one, and changed:

- the `checkout-late-notification-edit` seed (`cases.ts`): Payments is a **Service** that owns
  Payment state and calls one **External API**, Payment provider;
- `checkout-build`'s canonical commands (`fixtures/synthetic.json`, version 1.1.0): the same
  Payments and Payment provider, and one more phrase in its reply.

The checkout rubric follows: `durable-checkout-participants` asks for owned data and a service's
call to an External API (it asked for a Billing tile), and `no-duplicate-provider` allows at most
one External API tile (it refused a Stripe-named one beside Billing's built-in provider). The
prompts, obligations and other cases are unchanged. `pnpm eval:chat` replays all six cases in both
arms deterministically, offline.

Since V3-19 the current arm sends the canonical fixture's commands in chat's own form
([studio guide](studio.md#chat): no `side`, `editConnection` with `label`), converted at send
time; the fixture file and the RF00 ablation arm, whose six tools take the studio's shapes, are
unchanged. Recorded reports keep their 1.0.0 seeds and are not rewritten. Their replay
(`pnpm eval:chat --report=…`) still stops at its first request, as it has since NC01: the shared
caller context changed (here also the short prompt, the tools and the compact design), so the
recorded request hash no longer matches and no recorded response runs; the CLI then reports
`Replay mismatch video-build/rf00-ablation: design`. That is the drift, not a re-adjudication of
the old model result. A new recorded report needs a live run, which needs the owner's explicit
go-ahead at the time (V3-10).


## Design evals (V3-10, V3-19)

Design evals **2.0.0** (V3-19; 1.0.0 in V3-10) score what chat saves, not what it says: three
**build** cases and ten **review** cases. What changed in 2.0.0 is [below](#design-evals-200-v3-19). They run through the production `ChatService` (the
same tools, the pre-save review and the one-Undo commit) in disposable in-process PGlite
projects, which are deleted afterwards. Code: `jeeves/apps/server/src/eval/design-*.ts`.

- **Follow a spec** (`v3-build`): a blank project gets the [v3 brief](../jeeves/apps/server/src/eval/fixtures/v3-brief.md),
  the [v3 contract](plans/youtube-v3/contract.md)'s §5 in an owner's prose with no IDs or command
  syntax. The saved design is compared by name with the v3 reference,
  `jeeves/packages/spec/src/fixtures/v3-modules.ts` (contract §5 as commands: 21 tiles, 33 Simple
  lines with 8 dashed, 26 modules with 24 Template and 2 Stub, 30 module connections, 8 values,
  11 template selections and 2 stubs, Runnable processes on), through the generic design diff
  (`fixtures/design-diff.ts`, which `v2-diff.ts` now wraps). The brief names every tile, link and
  module, so this case measures following a spec, not designing.
- **Product briefs** (`video-build`, `podcast-build`, V3-19): a [YouTube-like site](../jeeves/apps/server/src/eval/fixtures/video-brief.md)
  and a [podcast app](../jeeves/apps/server/src/eval/fixtures/podcast-brief.md), about 120 words
  each, saying what the product does and naming nothing. They are scored by the **capability
  rubric** ([below](#the-capability-rubric)), not by name.
- **Review** (one seed per review finding class): `module-status` (Favorites behind an Optional
  guard), `unconnected-slot`, `generation` (a Sign-in selection pinned to an uninstalled version),
  `store-without-writer`, `unrelated-store`, `user-reaches-store`, `long-line` (advice),
  `line-style`, `warning` (Uploads with no storage) and, since 2.0.0, `review-out-of-range`
  (Orders API's Request timeout saved as 99999999 ms; V3-18 made it fixable). Each prompt is
  "Review this design and fix what is wrong. Tell me what you found and what you changed." Three
  seeds break a rule the studio now refuses to save, so they are stored as a revision directly,
  as a design saved before that rule would be.

### Run them offline

From the repository root (Node 24 first in PATH):

```sh
pnpm eval:chat                       # RF06's synthetic replay, then the design evals' scripted runs
pnpm eval:chat --suite=design        # the design evals only
pnpm eval:chat --suite=design --record=/absolute/path/scripted.json   # also write the report and its .md
pnpm eval:chat --report=/absolute/path/report.json                    # replay a recorded report
```

The scripted runs are three canned models, all writing chat's own commands: **good** (the six
curated patterns, given the spec's names on the spec build and left with their placeholders on a
product brief, then one batch fixing what they leave: on the spec, the brief's names, kinds,
values and Runnable processes; on a product brief, Runnable processes; each review calls
`reviewDesign`, fixes the defect and names it), **patterns** (the builds only, the patterns and
nothing else) and **bad** (a small generic site with no modules; "looks fine" to each review).
Each runs twice and must repeat itself exactly, requests included, and the command fails unless
good scores at least 95 on every build and 90 on review, patterns between 50 and 95 on the spec
build and at least 80 on the product briefs, and bad at most 30 on every build and 20 on review.
Today: good 100 on all three builds and 100 on review; patterns 86.3 (spec), 98.2 and 98.2; bad
1.7, 18.5, 18.5 and 5. `pnpm check` runs the same in
`design-eval.test.ts`, the rules in `design-score.test.ts`, and the leak check in
`design-leak.test.ts`. Replay sends each recorded
response to the request it answered, refuses a request whose model-visible content
(`requestContent`) differs ("context drift"), and then requires the same saved design, text and
scores. Any change to the prompt, a tool, the brief or a seed drifts old reports: record new ones,
don't edit them. Offline, `fetch` throws and no provider is built.

### Run the live comparison (owner's go-ahead only)

Paid calls need the owner's explicit approval at the time. One command compares models of one
provider on all thirteen cases, with the key from the environment only:

```sh
pnpm eval:chat --suite=design --live --allow-paid-api \
  --models=openai:gpt-5.4-mini-2026-03-17,openai:gpt-5.5 \
  --report=/absolute/path/design-live.json
```

`--models` takes `provider:model` pairs from the provider catalog: `openai` (the OpenAI
Responses API with `OPENAI_API_KEY`; suggested `gpt-5.4-mini`, `gpt-5.4`, `gpt-5.5`, `gpt-6-astra`,
`gpt-6.1-sol`, any name accepted), `codex` (the Codex CLI's own login; suggested `gpt-6-astra`,
`gpt-6.1-sol`, `gpt-5.5`, `gpt-5.3-codex`, an empty name for its default) and, since V3-19,
`anthropic` (the Messages API with `ANTHROPIC_API_KEY` from the environment only; suggested
`claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5`). The catalog's `custom` endpoint is
refused before any request: its key is only in the config file, which the runner never reads. One
provider per command, since the API needs the key set and Codex needs it unset:

```sh
env -u OPENAI_API_KEY -u CODEX_API_KEY pnpm eval:chat --suite=design --live --allow-paid-api \
  --models=codex:gpt-5.3-codex,codex:gpt-6.1-sol --report=/absolute/path/design-codex.json
ANTHROPIC_API_KEY=… pnpm eval:chat --suite=design --live --allow-paid-api --repeat=3 \
  --models=anthropic:claude-haiku-5-5 --report=/absolute/path/design-haiku.json
```

- `--repeat=N` (1–10) runs every case N times per model: a model's run varies, so V3-19 reports
  each score's mean and its lowest and highest sample.
- `--cases=v3-build,review-warning` runs only those cases.
- `--resume` continues a report that stopped (an access failure, a closed laptop): the cases and
  samples it has are kept, provided its eval version, prompt, tools and cases are today's.
- `--merge=a.json,b.json --report=all.json` (offline) joins reports run side by side, one per
  model, into one report and its summary.
- `--report=` also reads a gzipped report (`.json.gz`): V3-19's live reports are kept that way
  (a few MB each as JSON).

Every provider is built, and its credentials checked, before the first request; a missing key
stops with "no requests sent". Limits per case (2.0.0): 16 responses, 16,000 output tokens per
response (thinking counts toward it on Anthropic models; the Codex adapter enforces none), 600
seconds (a Codex request is a whole agent session), OpenAI retries 0, Anthropic the SDK's 2. The report and its `.md` are
written after every case, and an access or quota failure stops the run before another request.
Reports keep each round's response, request hash and size, the provider's token usage, the model's
text and the saved designs, never keys, headers or opaque reasoning items. Replay a live report
offline with `--report=` as above, and run `pnpm format` before committing one (Biome formats
JSON).

### Read the scores

**Follow a spec.** Each build area is 0 to 100: **100 × credit ÷ the larger of the reference's count and the
candidate's**, so an extra tile, line, module, link or selection costs as much as a missing one.
The **total** is the mean of the five areas. Candidate tiles are matched first by name, then
modules within matched tiles; everything is then compared under the reference's names.

| Area | Counted | Credit |
| --- | --- | --- |
| Tiles | 21 | 1 for the name and kind; ½ for the name with another kind, or for the only tile of that kind left on both sides (Sign-in named Identity) |
| Links | 33: 2 user links, 6 entries, 25 tile links | user link 1 (same action name) or ½ (another); entry 1 (same lane) or ½ (other lane); tile link 1 (same style, solid or dashed) or ½ (the other) |
| Modules | 26 | 1 for the name and kind in the matched tile; ½ for the name with another kind, or the only module of its kind left in that tile |
| Module links | 30 | 1 when the matched module links to the matched tile, or in-process to the matched module |
| Templates | 13 selections + 8 values | 1 per template resolved in the matched tile (a stub for the matched module); 1 per value set the same |

Names match case-insensitively, punctuation and spacing aside, and a trailing kind word of the
tile's own kind is ignored ("Metadata database" is Metadata, "Video lifecycle worker" is Video
lifecycle), as the contract's naming rule allows. Descriptions are not scored. The report lists
every item with less than full credit and why ("kind event-publisher, not custom", "missing",
"is 1000").

### The capability rubric

The product briefs name nothing, so a design is scored by what it can do
([`design-rubric.ts`](../jeeves/apps/server/src/eval/design-rubric.ts)): five areas, each 100 ×
credit ÷ checks, and the total their mean. Tiles are found by kind and wiring, never by name, so
a model that names everything its own way scores as one that keeps the patterns' placeholders.

| Area | Checks (1 each; ½ where noted) |
| --- | --- |
| Kinds (10) | an Uploads tile on the upload lane (½ elsewhere); object storage the uploads write; a processing worker fed through a queue by the uploads; separate storage it writes (½ if the same); a CDN on the download lane serving storage; a database the uploads record into; an identity; a search index; a cache a download-lane service reads; a counts database written by a worker that consumes events |
| Wiring (6) | both lanes used; a download-lane service reads the records the uploads write; a lifecycle worker after the processing results writes the records; search fed by events, the index read from the download lane (½ without the events); counting from events; Favorites in a download-lane service with its own database (½ otherwise) |
| Async (5) | every link into or out of a channel dashed; no line-style finding; the jobs channel a Queue; the event channels Topics (½ for some); four channels (pro rata) |
| Guards (4) | Required sign-in on the uploads, Optional on the read path, Required on favorites (½ for a guard set the other way or not connected); every guard verifying an identity |
| Templates (11) | Multipart upload; Video encoding (the podcast: the processing worker's modules resolve, template or stub); Upload lifecycle; Sign-in on three tiles (pro rata); Cache read; Event counter; Search indexing; Search query; Favorites; Runnable processes on; nothing left to fix in the review |

The rubric accepts reasonable alternatives (one service that serves and searches, any names); it
does not judge how readable the board is, which the spec build and a mouse check still do.

### Reviews

A review case is **50 × named + 50 × fixed**. **Named:** 1 when the model's own text (not the
service's summary) names where the defect is and what is wrong (one of the case's subjects and one
of its terms), ½ for where alone. **Fixed:** 1 when the saved design's review no longer reports
that class there, with no new finding to fix and no seed tile lost, ½ when it is gone at such a
cost; for the long line, advice, the right change is none, so 1 when no tile was added or removed
and nothing new needs fixing. The review score is the mean of the ten.

### Cost of one run

Measured offline from the good scripted run, in the OpenAI wire form (2.0.0, thirteen cases):
per model, **53 requests, 3.5 MB sent (≈ 0.91–1.22 million input tokens, 69% of it the
instructions and tools every request repeats) and about 19 KB received**. V3-10's ten cases took
39 requests and 5.2 MB (84% repeated) with the larger tools. The figures below are V3-10's. A live model usually takes more rounds; the bound is
160 requests (≈ 9–12 million input tokens, at most 655 thousand output). At RF06's gpt-5.4-mini
list prices that is about $0.25–0.35 per model with the repeated prefix cached, $1.00–1.35 without,
and at most about $10–12. A stronger model sends about as many tokens at its own price. Details
and the offline scores: [V3-10 results](evals/v3-10/README.md).

## Design evals 2.0.0 (V3-19)

V3-10's live run (gpt-6.1-sol 100 and 94.4, gpt-6-luna 0 and 50) raised two questions: was the
build fair, and why did the cheap model's turns fail? 2.0.0 answers both.

- **The build leaked the answer**, twice: the 795-word brief names every tile, link and module,
  and the patterns' defaults were v3's names, so a patterns-only run scored 90.7. The patterns'
  defaults are now neutral ([patterns](studio-patterns.md#curated-module-patterns)); the spec
  build stays, as **follow a spec**, beside two short **product briefs** scored by capability.
- **The leak check** (`design-leak.test.ts`) fails if the system prompt, a tool definition, a
  pattern's defaults, what chat reads about a seed, or any tool output of a scripted run contains
  a tile, module, action or system name of YouTube v3, v2 or a study that the case didn't supply
  (its brief or seed, or the model's own arguments). The studio's catalog words don't count (kind,
  module kind, template, lane action, guidance role, operation and profile names); names match
  case-sensitively. It found the canvas note's "(Watch, Publish)" and the publication-to-search
  guidance example's "Publication events" and "Search indexer"; both now use other words.
- **Luna's turns failed in the harness, not in chat.** The recording provider measured each
  request in the OpenAI wire form, and that codec refuses arguments outside the strict schema.
  Codex isn't held to it, so Luna's malformed commands (`element`/`settings` keys, a command type
  that doesn't exist) threw while being measured, before chat could refuse them in its own words.
  Measuring now never throws (`requestSize`, `design-harness.ts`).
- **Sturdier tools** ([studio guide](studio.md#chat)): chat's own commands, one shape each, a
  setting as `setSetting`, IDs from names; per-command refusals naming every malformed command
  (and up to five refused ones) with the shape each takes; commands already in effect skipped,
  not refused; no `baseRevision` on the apply tools; readiness findings counted, not listed as
  errors; preview as `preview: true` on the apply tools (`previewCommands` is gone). The tool
  schemas went from 86 KB to 37 KB (113 KB to 44 KB as strict OpenAI tools);
  `applyStudioCommands` from 43 KB to 10 KB.
- **The turn's budget is stated:** the prompt says a turn has 16 responses and one that runs out
  saves nothing, so batch and apply directly (preview only when unsure); the last three tool
  rounds carry a reminder. A first live pass without these (stopped early) lost whole builds to
  the limit, Sol's included: every step was previewed, then applied.
- **Refusals say what to do:** a batch over 50 commands is refused with "split them into two
  calls in the same response" (it was Zod's bare "Too big"), and the repair-pass refusal says the
  turn itself isn't over (gpt-6-luna read it as the 16-response limit and stopped).
- **Codex's preamble** says the Jeeves tools are called through `toolCalls` and are always
  available that way: in a pass without it, gpt-6-luna told the person "the studio tools aren't
  available in this session" in 7 of 23 cases (gpt-6.1-sol never did).
- **A pinned template version has a way back:** the review's fix for a module's selection saved
  with an uninstalled template version now reconnects one of its links (commands checked against
  the design), where it only said to change the saved value.
- **The out-of-range review seed** V3-10 dropped is back (`review-out-of-range`, stored as a
  legacy revision), since V3-18 made the value fixable by chat.
- **Repeats and spread:** `--repeat`, `--resume`, `--cases` and `--merge`; reports give each
  score's mean with its lowest and highest sample.
- **Anthropic:** `anthropic:<model>` runs Claude on the Messages API, key from
  `ANTHROPIC_API_KEY` only, adaptive thinking at medium effort (Codex's level), prompt caching on,
  2 SDK retries; list-price estimates for Haiku 5.5 and Sonnet 5.5 (checked 2026-11-11).

The live results: [V3-19 evals](evals/v3-19/README.md).

Since PF03 changed the link table chat's tools send, the recorded V3-19 live reports no longer
replay (their requests differ); they stay as the record of that run. `pnpm eval:chat` still runs the
scripted arms.

Since PF05 changed chat's tools and context, the recorded scripted report
(`docs/evals/v3-19/scripted.json`) no longer replays either; `pnpm eval:chat` reruns its arms.

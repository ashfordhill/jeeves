# Chat tool argument schemas

The provider-neutral tools, conversation items and server commands use canonical Jeeves arguments.
Optional fields retain their existing omission semantics and defaults. The OpenAI adapter alone
encodes a separate wire representation, validates returned wire arguments and decodes them before
Workspace receives them. The codec preserves command meanings independently of the explicit stored-design/blueprint version boundary.

| Provider | Argument constraint |
| --- | --- |
| OpenAI Responses | Sends `strict: true` function tools using the audited adapter below. Every object is closed and every property is required on the wire. Local wire validation also rejects malformed arguments and extra fields before decoding. |
| Codex | Constrains only the outer message/tool-call answer. Each call's `arguments` is a JSON string; the output schema does **not** constrain its inner values. The canonical tool schemas appear in the prompt. |
| Scripted fake | Returns scripted canonical arguments; supplies no model-side schema guarantee. |

Every path still goes through Workspace's strict Zod inputs, the shared command builder and
design validation. JSON Schema cannot express every Zod refinement or graph/ownership rule.
For example an L1 cache TTL without an L1 size can pass the wire schema but is refused by server
validation. A structurally valid call is not evidence of a sound architecture or runtime behavior.

## Omission and explicit null

OpenAI requires all object properties in `required`. For each canonical optional field that
does not accept null, wire `null` means **omit**. Values such as `false`, `0`, `""`, `[]` and `{}`
retain their own meanings where accepted. Decoding does not apply defaults: the server does.
For `askUser.allowFreeText`, wire null omits the field and the server's default remains `true`;
explicit false remains false. An omitted `addTile.link` still uses the pair's default mode.

An already-nullable optional needs a presence wrapper. Currently this is `edit.owner`:

| Canonical command field | OpenAI wire field | Meaning |
| --- | --- | --- |
| omitted | `"owner": null` | Leave the existing owner unchanged. |
| `"owner": null` | `"owner": {"value": null}` | Clear the owner. |
| `"owner": {"kind":"element","id":"shorten"}` | `"owner": {"value":{"kind":"element","id":"shorten"}}` | Set the owner. |

Wire schemas describe these sentinels next to the field, including the server default when one
is present. Required nullable fields use their original null meaning. The codec validates the
entire value before dropping omission sentinels; it never strips unknown fields to make an input
acceptable. Invalid wire JSON/arguments or unknown tool names fail the provider response. They
do not execute commands. Validly shaped but semantically invalid commands receive the existing
server refusal.

Returned `ModelItem` and `ToolCall` arguments are canonical. Subsequent Responses requests
re-encode every historical tool call using the same schema; tool results retain their call IDs.
This includes explicit-null owner clearing and the server's synthesized `reviewDesign` call.
The adapter remains stateless and deterministic; it does not need an out-of-band copy of raw wire
arguments or expose OpenAI sentinels to Codex.

## Audited subset

The adapter accepts a deliberately finite subset of explicit draft 2020-12 schemas:

- Root objects and nested closed objects: `type`, `properties`, `required`,
  `additionalProperties: false`. Nested arrays use `items`, `minItems` and `maxItems`.
- Scalar string, number, integer, boolean and null types. Strings support `minLength`,
  `maxLength`, `pattern`; numbers support `minimum` and `maximum`. Integers use the safe integer
  range accepted by Jeeves/Zod. Scalar `enum` and `const` are preserved, with const emitted as a
  singleton enum. Other validation keywords must be audited before use.
- Nested `anyOf`. A `oneOf` becomes `anyOf` only after proving its branches disjoint in both
  canonical and wire representations. Proof uses distinct types/literals, closed object keys,
  shared required discriminators and recursive unions. Overlapping/unproven `oneOf` refuses.
  Overlapping `anyOf` refuses a value if its matching branches would normalize it differently.
- `description` is preserved. `$schema` is checked then removed as dialect metadata. `default`
  is an annotation: omitted values remain omitted and field guidance describes the server default.
  The adapter never replaces the server's default application.

References (`$ref`, `$defs`, external or recursive), implicit/open schemas, boolean schemas,
type arrays, formats and other unaudited constructs fail with a tool/schema path before transport.
This is narrower than OpenAI's full supported subset. No constraint is silently discarded, and
there is no fallback to best-effort tools. New schema constructs require a codec/test update.

The current fourteen tools compile, including RF04 turn scope, NC01 persistent scope, NC02 explicit ownership and NC03 exact operation lookup/binding. Schemas use only the audited subset and no references. After adaptation `applyStudioCommands` has 466 properties, 592 enum
values and at most nine nesting levels under the adapter's conservative traversal, as measured
after MA05 added the four module commands (`addModule`, `connectModule`, `disconnectModule`,
`removeModule`) and eight module kinds. The adapter
checks emitted schemas, including wrappers, against 5,000 properties, ten nesting levels, 1,000
enum values, 120,000 characters for names/enum values, and the large-enum string limit.
TP03 (IDs follow names) adds no command or argument: a rename is still `edit`/`editComponent`
with `name`. Only the `applyStudioCommands` result gains `renamed: [{from, to}]` when a rename
re-keyed IDs; later commands in the turn use the new IDs.
TP04 adds one command, `setRunnableProcesses` (`on`, a boolean): 2 properties and 1 enum value.
Measured after it, `applyStudioCommands` has 465 properties and 590 enum values, still at most
nine nesting levels. `getDesign` gains `processes` (true or false).

These rules follow the official [function-calling strict-mode documentation](https://developers.openai.com/api/docs/guides/function-calling)
and [Structured Outputs supported schemas](https://developers.openai.com/api/docs/guides/structured-outputs),
checked 2026-11-07. Model variants can have narrower support (including fine-tuned model
constraints); API rejections remain explicit provider errors. Mocked HTTP tests demonstrate the
actual transmitted schemas, decoding, canonical Workspace behavior and continuation replay. They
require no API key/network and do not establish live model/API acceptance or design quality.


NC01's separate `configureDesignScope` strict tool has 17 properties, 18 enum values and five
nesting levels (2,497 UTF-8 bytes including tool metadata). `applyStudioCommands` remains at
427 properties / 538 enum values / depth nine; its union was not enlarged. Profile null is an
explicit required nullable reference. Omitted `upgrade` remains omitted through wire null and
defaults to false at Workspace; custom element/connection omission also survives replay.
Duplicate requirements and other Zod refinements remain authoritative server checks.

On the same default schema2 TinyURL, the rendered instructions grew 10,161 → 11,237 bytes,
caller context 13,549 → 15,147 bytes and strict tool array 55,397 → 57,895 bytes. These are
UTF-8 sizes, not token/latency/quality measurements. A scripted scope/repair regression uses five
responses including two repairs, third-apply refusal and a read-only preview after exhaustion.
No paid/live run was made. RF06's reported 2.44× input / 2.07× response overhead is unchanged
historical evidence, not a claimed NC01 improvement.

Old RF06 as-run records remain immutable. Their first replay request now intentionally differs
because caller context adds explicit schema/persistent scope, the current prompt adds its rules
and the current tool map adds the narrow tool. The separately versioned
`jeeves/apps/server/src/chat/fixtures/nc01-scope-v1.json` freezes the new scripted scope arguments;
network-free synthetic RF06 cases still replay deterministically under the current code.


The first old Codex replay drift is `video-build/rf00-ablation`, round 1: expected request hash
`77669bb5b59a1dbcc98c08bbcd07d3a70a2cae54f285972bc6650417b2995a6b`, new hash
`05ea669ff9f5c887fbc9099d92454f74ca9e3024c1e138116f3c0082a970c39b`.
That arm retains its old prompt/tools but uses shared caller context; it now includes schema
version, persistent scope/unknown requirements and the available profile. No recorded response
runs. The CLI's subsequent `design` mismatch is a consequence of this earlier context refusal,
not a re-adjudication of the old model result. [Audit](plans/reliable-foundations/evidence/nc01/audit.json)
and [drift](plans/reliable-foundations/evidence/nc01/replay-drift.json) retain the observed values.


NC02 adds the narrow `configureOwnership` tool: **28 properties, 13 enum values, depth five**
(3,600 UTF-8 bytes including metadata). The existing tile union remains 427 / 538 / nine.
Omitted deployable/published-read boundary use wire null and return to omission; omitted upgrade
defaults false. Malformed/null arrays and extra fields refuse before normalization, and canonical
history re-encodes every ownership union. Real ChatService tests cover two repair passes, refused
third apply and permitted previews; all accepted edits are one Undo.

A selected logical owner travels as `owner:<slug>` (at most 69 chars including a 63-char owner
ID), distinct from canonical element/connection IDs. The route validates this new namespace,
refuses missing owners, and caller context resolves the owner without selecting its roles.
Legacy selection strings and stored history remain unchanged; rename preserves the owner ID.

Against the retained NC01 audit on the same default schema2 TinyURL, instructions grow
11,237 → 12,512 bytes, caller context 15,147 → 15,928 and strict tools 57,895 → 61,496.
These are UTF-8 bytes, not tokens, latency, price or quality results. Ownership-only scripted
repair coverage uses five responses. No paid/live calls were made. The new ownership context,
selection namespace and tool intentionally drift old RF06 request hashes; raw as-run evidence is
unchanged. The current network-forbidden synthetic suite remains deterministic. Exact audit and
first old-request drift are retained in `plans/reliable-foundations/evidence/nc02/`. Mini/live strict
acceptance and RF06's historical 2.44× input / 2.07× response overhead remain disclosed limits.


NC03 adds `describeOperation` (**4 properties / 0 enum values / depth three**, 754 UTF-8 bytes)
and `configureOperations` (**67 / 16 / seven**, 6,726 bytes). The giant tile tool stays
**427 / 538 / nine**. A tagged closed create-link configuration keeps nullable retention/verifier
explicit; omitted `upgrade` still decodes to omission and defaults false. A one-branch union was
correctly refused by the existing audited codec during development; the unnecessary wrapper was
removed, preserving the stored tag and all strictness. NC04 can extend it to a finite multi-branch
union without migrating existing records. Extra fields/malformed refs refuse before mutation.

The actual emitted strict tool array is **69,051 UTF-8 bytes**, versus retained NC02 **61,496**
(+7,555). On the same default schema2 TinyURL, rendered instructions are **13,886** versus
**12,512** (+1,374), caller context **16,293** versus **15,928** (+365). These are measured bytes,
not tokens, price, speed or model-quality evidence. A separately versioned
`jeeves/packages/spec/src/fixtures/nc03-create-v1.json` drives current scripted regression: five real
ChatService responses, two accepted repair passes, refused third apply, permitted lookup/preview
and one turn Undo. Mocked transport verifies exact tagged refs, nullable values and canonical
history; no live/paid call or Mini/live strict acceptance is claimed.

Explicit operation selection uses `operation:<binding-id>` (maximum 73 characters), separate from
canonical role/edge/owner IDs. Context resolves one exact binding; parent selection selects none.
Malformed/missing/removed refs refuse at the real chat boundary, rename preserves identity and
history preserves the original reference. The current network-forbidden RF06 synthetic suite
remains deterministic. Immutable old RF06 records now intentionally stop at the first request:
`video-build/rf00-ablation` round 1 expected `77669bb5…`, actual `cf667290…`, because shared context
adds operation declarations/findings/catalog identity and namespaced selection. No recorded
response was replayed. Exact audit/drift are retained in
`plans/reliable-foundations/evidence/nc03/`; RF06's 2.44× input / 2.07× responses and intended
Mini/live acceptance gap remain historical limits.

V3-09 (D6) adds two tools, `applyPattern` and `previewCommands`; there are now **seventeen**.
Measured on the adapter's emitted wire schemas:

| Tool | Properties | Enum values | Depth | Bytes |
| --- | ---: | ---: | ---: | ---: |
| `applyStudioCommands` (unchanged union) | 469 | 598 | 9 | 57,589 |
| `applyPattern` | 66 | 9 | 4 | 9,284 |
| `previewCommands` | 185 | 144 | 5 | 23,559 |

- `applyPattern {baseRevision, pattern}`: `pattern` is a discriminated union on `id` (seven
  distinct literals, closed objects of optional strings, one `signIn` enum and one bounded
  `readers` array), so the adapter proves its branches disjoint. Omitted arguments travel as wire
  null and return to omission; the server applies the defaults.
- `previewCommands {baseRevision, commands?, pattern?}`: the same `pattern` union, and a narrower
  command union than `applyStudioCommands`: the lane commands except `changeKind`, `editSystem`,
  the module commands, `editComponent` and `setRunnableProcesses`. Tile settings (`edit`, 17 KB of
  canonical schema), link labels and the retained source commands have nothing to preview, and
  repeating the full union would have doubled the tool array. Exactly one of `commands` and
  `pattern` is a server check the schema can't express.
- `applyStudioCommands` keeps its union: the codec tests round-trip historical
  `createComponent`/`connectComponent` arguments through it, though normal authoring refuses them.
  `addTile` of a legacy kind (Gateway, Redirect, Notifications, Billing) is now a server refusal,
  not a schema change.

The prompt moved into the tools. On the same designs as HEAD (`1c9116f`), UTF-8 bytes:

| | HEAD | V3-09 |
| --- | ---: | ---: |
| Instructions | 18,468 | 2,168 |
| Strict tool array (all tools) | 76,396 | 113,238 |
| Caller context, TinyURL study | 22,687 | 11,718 |
| Caller context, v2 module design | 49,047 | 25,592 |
| `getDesign`, v2 module design | 42,712 | 29,503 |
| `listStudioDefinitions` | 10,339 | 16,212 |

The first request of a turn is about the same size on the v2 module design (143.9 KB → 141.0 KB)
and 9.5 KB larger on TinyURL: the tool array grew by the two tools and the descriptions that now
carry what the prompt said, while the caller context no longer repeats the catalog and the design
is compact (no per-link connection objects; module-level selections read as statuses). These are
bytes, not tokens, price or quality results. Old RF06 records still stop at their first request
([chat evals](chat-evals.md#eval-110-no-new-billing-tile-v3-09)). No live or paid call was made.


V3-19 makes the tools small and flat enough for a modest model, and drops `previewCommands`;
there are now **sixteen**. `applyStudioCommands` takes chat's own commands
([studio guide](studio.md#chat), `jeeves/apps/server/src/chat/commands.ts`), each compiling to
exactly one studio command, and both apply tools take `preview: true` for a dry run and no
`baseRevision` (the parser ignores one sent; the configure tools keep theirs). Measured on the
emitted wire schemas:

| Tool | Properties | Enum values | Depth | Bytes |
| --- | ---: | ---: | ---: | ---: |
| `applyStudioCommands` | 81 (was 469) | 79 (was 598) | 5 (was 9) | 12,210 (was 57,589) |
| `applyPattern` | 66 | 9 | 4 | 9,364 (was 9,284) |
| All sixteen tools, strict | | | | 44,362 (was 113,238) |
| All sixteen tools, canonical | | | | 37,317 (was 86,382) |

The command union lost the tile settings union (`edit`'s 17 KB of canonical schema: a setting
is now `setSetting {tile or module, setting, value}`, checked on the server against the target's
normal controls), the commands chat always refused (`changeKind`, `createComponent`,
`connectComponent`, transport settings on `editConnection`) and the legacy tile kinds from
`addTile`'s enum. A setting's `value` is a string, number, boolean or null; each branch carries a
description, so Zod writes an `anyOf` rather than a type array, which the audited codec still
refuses. `editTile.owner` (a tile ID, or null to clear it) keeps the presence wrapper described
above. The server's parser for `applyStudioCommands` takes any commands and checks each on its
own shape, so a refusal can name every malformed command; it also accepts the studio's own
shapes (a settings object on `edit`, `editComponent`, `side`, `planned.label`), which the strict
schema doesn't list. The instructions are 2,804 bytes (2,168 in V3-09): they now state the turn's 16-response budget.

The Anthropic adapter (V3-19) sends each tool's canonical schema as its `input_schema`, with no
`strict` mode: like Codex, nothing constrains the arguments, and the server checks every call.

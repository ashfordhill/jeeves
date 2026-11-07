# Chat tool argument schemas

The provider-neutral tools, conversation items and server commands use canonical Jeeves arguments.
Optional fields retain their existing omission semantics and defaults. The OpenAI adapter alone
encodes a separate wire representation, validates returned wire arguments and decodes them before
Workspace receives them. No command, setting, saved design or blueprint format changes.

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

The current ten tools compile, including RF04 scope. The canonical schema audit has 18 `oneOf`,
3 `anyOf` and no references. After adaptation `applyStudioCommands` has 427 properties, 538 enum
values and at most nine nesting levels under the adapter's conservative traversal. The adapter
checks emitted schemas, including wrappers, against 5,000 properties, ten nesting levels, 1,000
enum values, 120,000 characters for names/enum values, and the large-enum string limit.

These rules follow the official [function-calling strict-mode documentation](https://developers.openai.com/api/docs/guides/function-calling)
and [Structured Outputs supported schemas](https://developers.openai.com/api/docs/guides/structured-outputs),
checked 2026-11-07. Model variants can have narrower support (including fine-tuned model
constraints); API rejections remain explicit provider errors. Mocked HTTP tests demonstrate the
actual transmitted schemas, decoding, canonical Workspace behavior and continuation replay. They
require no API key/network and do not establish live model/API acceptance or design quality.

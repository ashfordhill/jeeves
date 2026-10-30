# Editor and provider review

Status: the user approved the resource pattern, React Flow recommendation, and qrwty service/auth boundaries on 2026-10-29 (SRC-18 in `docs/sources.md`). The production editor and provider adapters have not been replaced. Read with [the resource specification](improvements.md) and [qrwty acceptance](examples/qrwty.md).

## Runnable editor comparison

Run `pnpm --filter @jeeves/web dev`, then open <http://127.0.0.1:4300/editor-review.html>. This separate Vite entry makes no API calls and saves no projects. Choose an engine at the top. Add a Service rectangle, choose its subtype, and select compatible components in the inspector. Changing a configured subtype opens a discard confirmation. Postgres is a separate cylinder-shaped element. The prototype uses React Flow 12.11.6 (existing) and Excalidraw 0.18.0 (exact dev dependency, stable release predating this work by more than two weeks, supporting React 19). No source is copied from Excalidraw; its dependency retains its package license.

The temporary node/config data is only spike state; it is not a second production design format. Both production engines would still have to adapt the existing validated spec/operations API and separate layout document. The spike deliberately does not implement saving, undo reconciliation, database migrations, production findings, or complete connection semantics.

| Interaction | React Flow spike / existing API | Excalidraw spike / public API |
| --- | --- | --- |
| Service/subtype/component hierarchy | One DOM node, ordinary inline select and inspector controls, internal list without handles | Grouped native rectangles/text plus external inspector; selecting a primitive maps to its outer service ID |
| Selection | Node selection is an element ID; child forms use `nodrag` | Native selection/group IDs require an adapter back to semantic element IDs |
| Resizing | `NodeResizer` updates outer geometry; contents use normal layout | Native resize scales grouped primitives, including text; changing components needs a layout adapter |
| Arrow attachment | Only the outer node renders handles | Native arrows bind to drawable primitives; grouped inner components are still bindable shapes |
| Routing | Smooth-step paths in the spike; existing product uses Bezier | Native arrow drawing/editing; shape geometry supplied by Excalidraw |
| Reconnection | Native endpoint gestures call a validation callback; creation/reconnection use one rule in the spike | Native endpoint movement changes scene binding IDs; validation must translate/reject scene changes |
| Inspector | Existing production forms can be reused directly | Existing forms can be kept outside the canvas; inline React controls on generic shapes require additional work |
| History/layout | Existing operations API plus layout history | Need to reconcile Excalidraw scene history, deletion, duplication, and transforms with semantic operation history |

Mouse evidence is recorded by `apps/web/e2e/editor-review.spec.ts`. The spike includes native engine gestures instead of mocks: outer connections, reconnection, actual outer-node width changes after resize, and subtype/component controls. The Excalidraw test also draws an arrow from an inner component and verifies its native binding contains `service-component-0`: grouping alone does not enforce outer-only endpoints. Its exposed binding IDs and geometry make limitations inspectable. Neither comparison demonstrates obstacle avoidance, dense-board routing quality, or a production migration. Those require their own examples if later needed.

Spike limitations: native Excalidraw drawing remains unrestricted and state is temporary; it can demonstrate incompatible arrows that a production adapter would have to reject. React Flow resize gestures currently produce browser ResizeObserver notification warnings while their geometry assertions pass. Excalidraw's transitive Radix dependencies declare older React peers, so `pnpm peers check` reports warnings with React 19 even though the exercised interactions work. Keep this dev dependency isolated or remove it after the engine review; do not treat the spike as production-ready UI.

Recommendation: **retain React Flow**, update the product interaction to generic Service → subtype → compatible internal components, remove internal connection handles, give databases a distinct shape, and validate outer connections/reconnections through the registry. This preserves working forms, layout persistence, operations, and findings while implementing the requested hierarchy. React Flow's built-in paths do not provide automatic obstacle avoidance; keep the current routing scope explicit.

Excalidraw reuse is feasible for a geometric drawing editor. The spike demonstrates that nested visual components are possible; the previous blanket dismissal was too strong. For Jeeves, reuse adds adapters for semantic selection, allowed shapes, connection restrictions, grouping/layout, and history. The inspected generic render hooks offer surrounding UI and embeddables, rather than a general replacement for every native shape renderer. This recommendation is an engineering inference from the prototype and public APIs, not a claim that Excalidraw cannot be extended.

Primary references: [React Flow custom nodes](https://reactflow.dev/learn/customization/custom-nodes), [NodeResizer](https://reactflow.dev/api-reference/components/node-resizer), [reconnection example](https://reactflow.dev/examples/edges/reconnect-edge), [Excalidraw scene API](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api), [render hooks](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/render-props). Installed type definitions were also inspected for element groups, custom data, arrow bindings, scene updates, and skeleton conversion.

## Provider and Settings recommendation

Official documentation was checked on 2026-10-29. Supported authentication paths must be distinguished from available credits and successful execution. No paid provider call was made for this investigation.

| Integration | Supported setup | Jeeves status and recommendation |
| --- | --- | --- |
| OpenAI Responses API | Server-side API key; API billing is separate from a ChatGPT subscription | Existing model adapter. Keep API-key setup clearly labeled; a stored key is configuration evidence, not a successful access test. [API authentication](https://developers.openai.com/api/reference/overview) |
| Codex SDK / local CLI | Codex supports ChatGPT subscription sign-in and API-key access; CLI has `codex login` and `codex login status` | Existing model/coding adapters use local Codex. Preserve them. Check the CLI's reported state instead of treating `auth.json` existence as verified login: credentials may use an OS store. Do not read or copy tokens. [Official authentication docs](https://learn.chatgpt.com/docs/auth) |
| Codex app-server | Supported account read, browser/device login start, login-completed notifications, cancel and logout methods | A future in-app **Connect Codex** action can use this protocol, show the returned URL/code, and wait for completion. This is a concrete supported integration; it is not implemented by the spike. Keep SDK execution while evaluating authentication integration; no need to rewrite the harness first. [App-server account flow](https://learn.chatgpt.com/docs/app-server#authentication-endpoints) |
| Anthropic Messages API | Anthropic API credentials, with documented SDKs | A model adapter can use native tool calls/usage. No Anthropic adapter is implemented yet. [API overview](https://platform.claude.com/docs/en/api/overview) |
| Claude Agent SDK | API-key authentication for third-party products unless separately approved | Appropriate candidate for coding integration behind `CodingAgentProvider`. An ordinary claude.ai subscription does not authorize Jeeves to offer subscription login. [Agent SDK authentication guidance](https://code.claude.com/docs/en/agent-sdk/overview#get-started) |

OpenAI also documents a separate [Sign in with ChatGPT plan-usage preview](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server) with [specific request limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations). Do not infer that an existing Codex credential or generic OAuth button enables the current Responses adapter. Treat that preview as a separately evaluated integration; the established local Codex path is sufficient for the immediate recommendation.

Proposed Settings layout:

```text
Providers
  Codex        [Not connected / configured / verified / blocked]
               [Setup instructions] [Refresh status]
               Future: [Connect Codex] after app-server login is implemented
  OpenAI API   [Key configured / not configured / blocked]
               [API setup instructions] [Refresh status]
  Anthropic    [Not yet supported] API key required for Jeeves integration

Models
  Design         Provider [ ... ]   Model [ ... ]
  Implementation Provider [ ... ]   Model [ ... ]
  > Advanced role overrides
      Planner    Provider [ ... ]   Model [ ... ]
  [Save]
```

Setup instructions and status refresh must work by mouse. Until a supported login API is wired, label the action **Setup instructions**, show `codex login`, and link official instructions. Never show a fake Sign in button. A browser-based API-key entry form would require a separate server-only secret-storage change; the immediate design can retain environment/config-file setup. Connection test is an explicit action because inference may spend credits; label its scope and result. A successful login, a model catalog entry, and a successful inference are different evidence. Show quota/auth failure from actual calls; a config file alone cannot establish readiness.

Keep the current persisted `roles` map and read compatibility for legacy `models`. Design maps to `designChat`, Implementation maps to `coding`, and Planner remains independently stored in the secondary controls. Existing planner overrides stay effective and visible in a summary; no silent change of provider or model. Missing usage/cost remains unknown. Setup, status refresh, model save, and advanced override controls need browser/axe checks when implemented.

## Review decisions

1. **Approved:** the small resource pattern and generated-output contract in [docs/improvements.md](improvements.md#small-structured-resource-pattern).
2. **Approved:** retain React Flow with the demonstrated hierarchy and outer-only connections.
3. **Approved:** the single API service + frontend + Postgres boundary and email/password with server sessions in [the qrwty brief](examples/qrwty.md#approved-architecture).

These review checkpoints were satisfied by the user's explicit approval, not by prototype test results. P3 has implemented the approved production hierarchy and outer connections; continue with P4. Do not repeat the approval request. The prototype remains temporary; Settings/provider simplification is still outstanding.

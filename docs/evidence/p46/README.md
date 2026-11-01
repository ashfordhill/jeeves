# P46 — Catalog semantics and system choices

P46 implements architectural classification and independent system intent in the existing
editor. All new C3 families are **planned**: no new runtime or generated behavior is supplied.

- Element classification, responsibility ownership and operation are separate from runtime
  host-role compatibility. Catalog defaults remain implicit on old documents; changing one
  classification field does not infer a new ownership choice. C2 boundaries use logical
  ownership; externally operated stores can stay inside. Infrastructure remains inspectable,
  labeled as awaiting deployment placement. It cannot masquerade as a C1 external provider.
- Business tenancy, authorization intent, data isolation and delivery model have independent
  saved choices in Edit context and system inspection. C1 displays tenant audience only.
  Legacy combined `config.tenancy` values remain readable and are never expanded into claims.
- Entitlements & quotas, Abuse & trust/safety, Custom domains and Data lifecycle are editable
  on compatible service/worker hosts. Policy choices default to Unspecified.
- Queues/streams describe named logical channels; broker placement belongs in deployment.
  Two queues remain distinct. Internal notification applications, C3 notification modules and
  external providers retain separate identities. The old billing-provider ID/config stays
  compatible under the clearer Payment provider preset label; no schema-equivalent provider
  definitions existed to merge safely.
- UI and chat share the same schemas/catalog/operations. New metadata remains outside
  generated behavior, executable bindings and verification claims.

## Visual evidence

Inspected at 1440 × 900 light and 390 × 844 dark. The inspector/dialog bodies scroll while
Save/Cancel remain reachable. Full C2/C3 diagrams at narrow fit are overviews.

- [Externally operated data, owned collector and independent queues](p46-collector-light.png)
- [Independent system choices, desktop](p46-system-light.png)
- [Independent system choices, narrow dark](p46-system-dark.png)
- [Entitlement policy defaults, desktop](p46-entitlements-light.png)
- [Entitlement editor, narrow dark](p46-entitlements-dark.png)

Screenshot review led to a separate classification-summary block so its wrapped text does
not collide with the Planned badge, and a generic Application badge for non-API applications.

## Verification scope

Focused spec/generator/chat checks and production Chromium journeys cover old examples,
independent choices, metadata-only generation equality, component placement, history/reload,
Cancel, conflict retention, accessibility and strict browser diagnostics. Final commands,
counts, recorded run IDs and any limitations are in the P46 entry of
[the handoff](../../handoff.md).

Existing template/version pins, resource contracts, generated golden fixtures and live qrwty
were not changed. P47 interface/contract authoring is the next package; deployment editing,
relationship policy execution and the later architecture library remain separate work.

Final recorded checks (unchanged source fingerprints):

| Check | Result | Run |
| --- | --- | --- |
| `VITEST_MAX_WORKERS=4 pnpm work run check` | Passed; 758 tests / 110 files; all typechecks; no lint errors | `2026-11-01T02-34-52-324Z-check-5278d4ea` |
| Authoring, new choices and all four example browser suites | 9 passed | `2026-11-01T02-34-53-515Z-browser-preview-3b3aaa12` |
| Existing container notation/inspector and SaaS-container browser suites | 8 passed | `2026-11-01T02-35-57-677Z-browser-preview-1bf7a3c2` |
| Final P46 desktop/narrow capture journeys | 2 passed (repeat of the new flows for archived captures) | `2026-11-01T02-37-07-117Z-browser-preview-6c460564` |

Classification does not grant a different C3 host role: compatibility continues to follow
the selected runtime or planned host family. Later interface authoring can document required
boundaries; no runtime/deployment capability is inferred from a classification label.

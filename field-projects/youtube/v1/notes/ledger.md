# Decisions and reusable hypotheses

Append new entries. No runtime finding, effort saving or functional coverage is measured yet.
Owner review follows working v1; this ledger does not authorize automatic v2.

| ID | Decision / evidence | Classification and current outcome |
| --- | --- | --- |
| D01 | Owner chose local Docker, signed-in creator upload, automatic public success, real encoding/playback/search/counts, minimal UI and PostgreSQL | Agreed product scope; [active plan](../../../../docs/plans/reliable-foundations/youtube-field-project-plan.md); no unanswered product choice |
| D02 | Archive actual owner revision 1 before the two engine changes; preserve schema/origin and all other fields | Source provenance; snapshots 001→002, API operation 6466; owner now revision 2 |
| D03 | Make a retained named copy using full schema-aware seed operations | Experiment isolation; snapshot 003, operation 6467; no shipped study/global-default rewrite |
| D04 | Bind objects/edge locally and normalize capacity intent explicitly on the copy | Local substitution; 35 changed setting paths in snapshot 004, operation 6468; original scale/cloud intent remains archived |
| D05 | Correct replica descriptions and local-edge name/prose in another snapshot | Source/context consistency; snapshot 005, operation 6469; no topology change, new clean image |
| D06 | Use pinned local Garage/Keycloak/RabbitMQ/Valkey/OpenSearch/PostgreSQL/nginx and Node/FFmpeg | Bounded experimental adapter choice; primary metadata/digests in inputs; startup/compatibility still unverified |
| D07 | Preserve exact TypeScript identity and HTTPS/service-identity declarations but expose explicit local overrides | Unsupported source intent; 25 exact paths in bindings, no false implementation claim; revisit in custom plan/review |
| D08 | Count explicit two-second playback events once per page session/event ID; public-only search and fixed encoding bounds | App-specific demonstration policy; [S01–S08](scenarios.md) frozen before generation; not implemented |
| D09 | Do not front-load lifecycle/search/idempotence abstractions or broaden NC07–NC13 | G01–G08 remain named gaps for the actual-output custom plan; necessary correctness/diagram fixes stay allowed |

These hypotheses are deliberately tentative. Another plausible use motivates investigation,
not immediate promotion into a new tile or a claimed reusable template.

| ID | Observed starting problem / references | Candidate / another plausible use | Decision and evidence needed |
| --- | --- | --- | --- |
| H01 | Upload multipart/resume is prose-only (`upload-multipart`, G06) | Signed/resumable upload module + bounded template; document/image import | Investigate after v1; show what actual custom code repeats and provider limitations |
| H02 | Pending/failure state and ownership are missing (G01) | Owned asynchronous lifecycle/status pattern; reports/imports/builds | Defer representation until actual implementation; retain owner consistency and failure evidence |
| H03 | Independent completion consumers can publish search too early (G02) | Committed-publication projection pattern; catalogs/listings | Correct v1, record actual diagram/code change, then judge reusable event/operation/template form |
| H04 | Retried processing/count delivery needs identities and receipts (G03/G05) | Idempotent worker/aggregation module; exports/activity counters | Require concrete side-effect boundaries and observed duplicate protection before promotion |
| H05 | Vendor/provider choices do not express transport/language substitution (D07/G08) | Explicit adapter override report; other local field projects | FP02 should report exact unsupported paths; no universal provider schema in FP01 |
| H06 | Hidden settings changes produce identical diagram PNGs (001–004) | Paired clean image + source + inspector evidence; any resource-setting edit | Accepted evidence practice; no need to add all settings to tile faces |
| H07 | Local settings edits left contradictory descriptions until review (004→005) | Context/source consistency review; any prose + structured intent pair | Accepted narrow correction; no runtime/chat-quality improvement claimed |
| H08 | Encoding ladder/packaging/thumbnail code is video-specific (G07) | Video template first; later other video products | Keep app-specific until a second use justifies generalization |
| H09 | Browser interface is outside current diagram (G04) | Browser/template entry and explicit client/server bindings; any minimal app | Track actual custom cost; do not pretend existing action lanes generate a UI |

For each later adoption/rejection append: observed problem, source/code/smoke references, chosen
representation, applicability/exclusions, implementation commit, investment in Jeeves, remaining
custom cost and stable-scope v2 result. Preserve rejected approaches. Curating a documentation
lesson alone does not change actual chat guidance or prove assistant/model quality.

## 2026-11-07 — FP03a observed foundations and independent boundary

- **D10 (deferred build detail resolved):** use Debian and Debian-security snapshot
  `20261024T000000Z` for exact frozen FFmpeg `7:5.1.9-0+deb12u1`; lock/check all 288 OS package
  versions and the frozen deb SHA in template source. [Actual builds](evidence/fp03a/README.md)
  pass; no input pin was replaced or image reproducibility/certification claimed.
- **D11 (independent field tooling boundary):** exclude exactly `field-projects/youtube/v1/app`
  from root Biome, as it is already outside root workspaces. Preserve untouched generated files
  and immutable `.jeeves` snapshots. This supersedes FP01's initial no-app-exclusion choice;
  future field handoffs run their own frozen install/TypeScript build and applicable field checks.
  Existing Jeeves studio/generator checks remain mandatory. No formatter dependency was added.
- **D12 (observed local compatibility):** bounded actual generated-output probes establish
  basic pinned-client/resource interoperability, public/internal Host and issuer wiring,
  scoped UID-readable secrets and readable nginx mounts. [Results](evidence/fp03a/provider-result.json)
  are separate from application S01–S08, all still unrun; G01–G08 remain custom and no functional
  coverage or effort saving is inferred. Empty index/realm/bucket/client setup is foundation output.

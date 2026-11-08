# Working v1 review pack — FP07b

The completed custom local app has independent integrated evidence for the frozen S01–S08
walkthrough. **S05 remains partial: no human listening observation is recorded for the fixture tone.** The automated
browser decoded video and unmuted 440 Hz PCM; that does not establish human listening. This is a
narrow working demonstration, ready for **FP08 owner/fresh-agent review**, not production or
enterprise readiness, generic diagram compilation, template certification or permission to start v2.

[Integrated scenario results, commands and retained evidence](evidence/fp07b/README.md) and
[per-file provenance](evidence/fp07b/provenance.json) are the completion record. Frozen
[scenarios](scenarios.md), [baseline](baseline.md), input/manifest bytes and historical notes stay
unchanged. The baseline delivered **zero complete S01–S08 scenarios**, with useful independently
buildable transport/provider/container foundations. Eight scenarios are not equal engineering
weights; no feature coverage or effort-saving percentage follows.

## Owner walkthrough

From `field-projects/youtube/v1/app`, use `pnpm start` and `pnpm stop`. The retained project is
**jeeves-youtube-v1**, all fourteen services/six volumes, at **http://127.0.0.1:4400/**. Identity uses
4401 and S3 signing4402. Normal stop/start retains data and credentials; do not run setup/bootstrap
again or remove volumes. For a genuinely new outside copy use the [app README](../app/README.md).

1. Open the URL signed out. Search `marigoldquartz`, `saffroncobalt` or `creator`; click Watch video
   for **FP07a marigoldquartz public fixture** (`fdd51924-5a94-4e45-be02-a77b3c82d1a7`). Its count was
   **3 before FP07b and remains 3 after restore**, with no reset. Direct URL:
   `http://127.0.0.1:4400/?watch=fdd51924-5a94-4e45-be02-a77b3c82d1a7`.
2. Click the thumbnail disclosure, Play and the timeline. Listen for the synthetic tone on your
   audio device; this is the outstanding S05 criterion. Playing two cumulative qualifying seconds
   adds one view for that page session. A later owner interaction may legitimately raise the
   retained count above3. Pause/seek/resume reuses its event ID; reload creates a new session.
3. Click Sign in. Username **creator**, password read locally from
   `app/.runtime/secrets/creator_password` (path relative to `v1/`; from app use
   `.runtime/secrets/creator_password`). `other-creator` has its separate password file. Do not
   copy credentials into feedback or logs. Sign out ends the provider session too.
4. For another upload choose the retained `.runtime/media/youtube-v1-fixture.mp4`, supply a title
   and description, and click Upload video. Keep the same bytes and mtime for v2: **15,584,953B**,
   SHA256 `1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9`.
   Pause during transfer, refresh, reselect that file and Resume; abort applies only before complete.
   View status shows processing/ready or a finite error. Successful completion publishes automatically.
5. The older **FP06c heliotrope public fixture** (`fdbbc43f-78a0-4be2-9910-a383de70acf6`) remains
   ready/searchable with0views at FP07b restore. Invalid and elapsed staged jobs remain visible to
   the creator; they are not searchable/watchable. Do not delete them to tidy the demonstration.

The independent scratch video IDs in the evidence belong to **jeeves-fp07b-review**, which has
been removed. They are evidence, not retained owner demo URLs. Jeeves4300/4310, its Postgres54329,
owner4304 and the other Compose projects were preserved. Browser operator tooling used the root
Playwright installation; the independent app used only its own lockfile/compiler/runtime and did
not call Jeeves, cloud services or a model.

## Benchmark and provenance

The owner subsequently added a [source-line composition benchmark](../../../../docs/field-projects/source-loc.md):
**159 retained template LOC (5.53%) / 2,715 post-template LOC**, in 2,874 backend `src/` lines.
[Per-file result](benchmarks/source-loc-v2.json) uses an explicit backend/UI scope and excludes all
UI/frontend code, tests and configuration/infrastructure. The original counts are unchanged;
this source-share metric supplements the behavior evidence below.

Compare against untouched FP04 **02ac280da62616e9c7aad7f88457dcb72084cb25**, not a regenerated
or retrospectively fixed baseline. Its107 hashed payloads plus manifest have manifest SHA256
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`. FP06a–FP07a supply the
custom completion; FP07b found no product integration repair. The generated business extension
shells earn foundation credit only; their multipart, encoder/packager/thumbnail, search/index and
counter implementations are **custom business behavior**. New browser, contracts, state,
migrations, startup and public-schema code are custom. Modified-generated services/config/client
wiring implement planned integration; scoped HTTP/AMQP helper repairs are separately annotated.
The provenance file names reused custom code and its origin commits, exact hashes and external
pinned dependencies. File/line counts measure bytes, not usefulness, coverage or labor saved.

Generator/profile/template/export and studio/source/diagram investment (FP00–FP05 and FP06a's
saved edits) is distinct from field completion. Model assignment was sequential **Sol xhigh**;
prior code, docs, runtime, fixture and operator harnesses were available. Runtime is Linux amd64
WSL2/Docker local with Node24.21.0/pnpm12.16.1; exact versions are in evidence. Active effort,
turns/tokens/cost and savings are **unknown**. No 60% effort-saving claim is supported.

## Drawing versus running application

Current saved source is schema3/revision6/native010. It correctly assigns Upload and lifecycle to
one Video owner, Transcoder to Media without SQL, and **Processing → lifecycle commit → Publication
→ indexer**. Explicit state/grants/projections, enabled owned outboxes and batch1 source settings
match current code. Inspect [native010](../diagrams/010-readable-upload-role/snapshot.json) beside
its source and the FP07b studio screenshots. No architecture or presentation decision changed in
this unit, so no duplicate011 was created for Fit/focus.

The drawing is not the full application specification. Exact HTTP routes/bodies, SQL schema and
transitions, S3/SQL reconciliation, deadlines, media ladder/marker, browser OIDC/resume/search/
play policy, event receipts, cache freshness and startup identity guards live in custom code and
[implementation plan](implementation-plan.md). Queue authority is not a schema3 store authority
contract. Eight executable-contract findings, the local HTTP/service-identity/Keycloak language
substitutions and strict readiness gaps are still explicit. Original owner design and005 inputs
remain historical, not falsely upgraded by the runnable app.

Native010's fitted expanded-role overview has small text. Shared orthogonal trunks obscure which
relationship owns an arrow; read versus write direction and long return paths still deserve owner
readability review. Focus Upload/lifecycle/Publication/indexer and Watch/counts separately; assess
short relationship labels such as “commit ready”, “publish after commit”, “read ready view”,
“record played event” and “read totals”. These are review candidates, not new renderer/source edits
or evidence that whole-canvas readability is settled.

The current generator proves deterministic export only for exact frozen005/profile1.0.0. It
**cannot emit customr6** and correctly refuses that source. The completed app is a separate custom
artifact. Before claiming a diagram stays an executable source of truth across iterations,
review a preserve/regenerate strategy for generated helper edits, integrations, owned extensions,
migrations and custom files, with conflict/refusal and reproducibility evidence. This is a proposal,
not a generalized regeneration feature shipped in v1.

## Fresh-agent FP08 checklist

- Read this record, immutable baseline/scenarios, current app README and latest handoff. Inspect
  actual JSON/logs/screenshots and seven extension implementations; distinguish behavior from pins.
- Verify retained owner runtime14healthy and6volume identities without resetting/bootstrapping;
  use mouse search/Watch, creator sign-in/out and upload controls. Record honest starting counts.
- Have the owner listen to the fixture. Keep S05 partial until that observation is recorded; do
  not infer audibility from FFT or unmuted video. OS background-tab behavior also lacks direct proof.
- Review source/native010 routing/read-write labels at useful focus and full overview. Decide
  whether an operation/flow view or labels would help before proposing more tiles or a renderer.
- Examine H01–H09 observations in the appended [ledger](ledger.md). Choose only improvements
  supported by concrete custom code, another use and explicit exclusions. No generic DSL is adopted.
- Agree a safe regeneration boundary before a later app claims diagram-driven repeatability.
  Keep scope/fixture/versions/comparison conditions stable, disclose changes, measure actual effort
  prospectively. Do not treat current file accounting as savings.
- Keep public encoded guessed partial keys/remote orphans, bucket-scoped credentials, local HTTP,
  single instances and basic anonymous counts in view. No HA/capacity/fraud/crash-safe/atomic ACL/
  arbitrary-codec/production-security certification was performed.
- Decide the next Jeeves improvements and whether/how to run v2 **with the owner**. FP07b does not
  initiate v2 or expand the experimental profile.

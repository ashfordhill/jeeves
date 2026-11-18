# RG24 regeneration and maintenance checkpoint

Complete for coordinator review, on accepted RG23 `99396d1`. This unit changes checkpoint
infrastructure, new fixture inputs and evidence only. Production generator/runtime/API/schema,
dependency pins and original field apps/exports remain unchanged.

- [Migration](migration.md): actual public commands, four passing witnesses, byte/data/pending-work
  preservation, explicit API migration and the guarded legacy SQL namespace limit.
- [Maintenance](maintenance.md): reviewed backend/UI scope for each of four reports, reproducible
  source-loc-v2 snapshot counts, separate handwritten SQL/declarations/manual actions and named A/B
  lessons. [All four recounts](recount-verification.json) exactly reproduce their reports/commit IDs.
- [Full check](check-final.txt): lint/types and145 files/1353 tests. [Browser](e2e-final.txt):87/87,
  including TinyURL and both mouse rebuilds. [Web build](build-final.txt): pass, existing chunk advisory.
- [Final source](source-review.json): exactly matches native4; no production or pin change.
  [Scope/shadow review](reviewed-scope-and-shadow-exclusions.json) names every omitted non-runtime
  metadata copy and its hash in the full export determinism receipt.
- [Preservation](preservation-final.txt), [inventory](preservation-inventory.json) and
  [cleanup](cleanup-audit.json):42 original container triples,9 networks,23 volumes,43 images,
  two old e2e projects, current roots/owner patch and accepted SQL/dependencies/frozenv1 retained.
  Own projects/resources/temporaries remaining0. [Artifact scan](safe-artifacts.json) checks raw
  JWT/PEM material, including decompressed snapshot payloads; existing native sanitizers also run.

Native2 cold-adoption and native3 link per-case passes are retained; their overall runs correctly
remain failed because other selected cases failed. Native4 passes both remaining selected cases.
Failed attempts and [recoverable progress](progress.md) remain a paper trail; no broader native
matrix, new full A/B benchmark or product rebuild is claimed.

The live preservation proof is compatible API8 with stable identities. A live legacy m_*→p_*
data conversion is not automatically supported or proved: the existing guard refuses it. The
explicit catalog adoption here is cold, and the separate tiny example proves successful in-place
hook migration where namespaces stay unchanged. No later unit, owner studio, root edit, live
provider/paid call, push or deployment. The owner WD-after-RG26 queue remains unread and unexecuted.

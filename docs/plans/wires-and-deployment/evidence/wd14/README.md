# WD14 evidence

Review starts at accepted WD13 `238de0836dd285904b741895c4f1457de06f6928`. The
[review](../../review.md#wd14--final-review-of-wires-and-deployment) gives acceptance, rough-edge
and stopped-unit dispositions. Approved WD plan `95d60ac` predates accepted RG23–RG26 carry-in;
actual WD implementation starts after amended RG26 `0ea91d3`. The
[957-path inventory](diff-inventory.tsv) classifies 739 RG-only, 205 WD-only and 13 shared paths.
No worker transcript/session was used. All three saved patches were read as stopped work,
including their source, proof and evidence inventories, without applying them:
[hashes/sections](stopped-inventory.json).

## Fresh CLI artifacts and manual comparison

Existing fixture sources only: [composition](../../../../../field-projects/generator-system/fixtures/wd-deployment/design.ts)
and [required stamp](../../../../../field-projects/generator-system/fixtures/wd-front-door/design.ts).
[Input serialization](export-inputs.mts.txt) calls those existing source functions without changing
their design. Exact serialized inputs are retained as [composition](deployment-input.json.gz) and
[required](required-input.json.gz). With Node 24.21.0:

```sh
pnpm --filter @jeeves/generator export:v2 /tmp/jeeves-wd14/deployment.json /tmp/jeeves-wd14/deployment-final
pnpm --filter @jeeves/generator export:v2 /tmp/jeeves-wd14/required.json /tmp/jeeves-wd14/required-final
```

The actual `deploy/contract.json` and `deploy/README.md` in both directories were opened, then
compared by hand with the source design. Exact emitted copies:

| Fixture | Machine contract | Deployment guide | Generated root README |
| --- | --- | --- | --- |
| Composition | [JSON, gzip](deployment-contract.json.gz) | [guide](deployment-guide.md) | [root README](deployment-root-readme.md) |
| Required stamp | [JSON, gzip](required-contract.json.gz) | [guide](required-guide.md) | [root README](required-root-readme.md) |

The composition source names four hosts. Public **front** calls internal **catalog**, with caller
and callee workload slots on **issuer**. Catalog's product/custom stub and positive reader use
**records**; the cache reader can refill **copies** from its source. Same-owner **timer** schedules
work on records. **indexer** consumes **events** and writes **index**. Those are exactly the
contract's four processes, four stores and six arrows. Only the consume arrow is asynchronous.
HTTP hosts have port 3000 and live/ready paths; workers have no invented HTTP health listener.
Front has no background obligation. Catalog can host generated cleanup/durable work; timer and
indexer have scheduling/consumption, so all three are conservatively always-on. Copies is
rebuildable; records/events/index retain original state. Event delivery alone supplies no complete
index reconstruction guarantee. Identity is separate from stores and exposes environment names.

Names/IDs, uses/access, calls, role/loss sentences, heading clicks and real source-folder links
agree. Stable alphabetical IDs and environment names make output deterministic. The handwritten
expectation is imported only as a check, never built by the emitter. Front and indexer list
`JEEVES_DB_POOL_MAX` because their actual shared import closure loads the SQL runtime, although
neither declares a database use. The actual-reader proxy audit independently verifies this.
Installed runtime optional/credential/TLS names are present; application-owned settings and SDK
conventions are outside this inventory and require their own deployment review.

The supplemental source is one public `front` HTTP process with `frontDoor: required`, no stores
or calls. Its contract has both private key names and the exact header/window; identity is absent.
The root local table's `app-front: none` and stamper's `LOCAL_HTTP_PORT` describe explicit local
configuration, not the runtime key reads. The generated guide correctly names the requirement.
Neither fixture is a completed application: **94 files / 12 gaps** and **55 files / two gaps**,
zero findings. Both packages lack WD12 drill/check/check:all/workflow surfaces.

## Bounded correction and checks

The new observable-output regression [fails first](readme-fail-first.log.gz) on the misleading
“Each process reads” wording. The corrected table names its actual explicit Compose keys,
required external URLs and optional workload-file summary; excludes env_file, other secret-path
overrides and other optional reads; links the exact installed-runtime inventory. Its nearby
source comment is corrected too. No inventory algorithm, runtime mechanism or diagram changed.
[Initial targeted pass](readme-pass.log.gz): 14/14, including unchanged off pins.
[Final focused run](focused-final.log.gz): **70/70** across deployment, stamp, pooler, recovery,
idempotency and workload suites. The latter includes WD13's six real-file/fake-issuer cases.
No live issuer, network, Postgres, Docker or installation is needed by these tests.

The [export comparison](export-review.json) identifies every before/after changed file: only root
README, report and manifest for each export. All **55/24 source files** are byte-identical.
Three processes-off pins remain unchanged; no golden refresh. The exact deployment artifacts are
unchanged. [Artifact audit](audit.mts.txt) and [result](artifact-audit.log.gz) independently check
handwritten expectation, Mermaid declarations/clicks, scaffold ownership and WD12 surface absence.

Both final exported API8 checkers pass ([composition](check-extensions-deployment-final.log.gz),
[required](check-extensions-required-final.log.gz)); both compile under
[TypeScript 7.0.2](typescript-version.log.gz) with existing pinned dependency links and no install
([composition](typescript-deployment-final.log.gz), [required](typescript-required-final.log.gz);
empty logs mean no diagnostics). Public update checks have zero create/replace/refused/remove/
orphan paths ([composition](update-deployment.log.gz), [required](update-required.log.gz)).

## Evidence reuse and limits

[Exact source-equality receipt](evidence-reuse.json) supports reusing accepted native observations:
WD10's 27 stamp/local-edge observations; WD11 native-2's 10 foundation + six catalog + four session
cases through pinned transaction-mode PgBouncer; WD13's six real-file/fake-issuer cases. Both
COMMIT fault proxies use the pooler, while setup/admin probes remain direct. WD10 internal 401s
were user-first refusals, not new workload-token/issuer proof. The old51 payload compatibility is
a historical WD10 comparison. The lost initial v3 trace/PNG remains lost; its log survives.
No blanket system rerun or production/provider certification was performed for a documentation
payload correction. WD12 receipt/progress proof does not satisfy its product-effect acceptance.

All optional Board sources, studio activation call sites, preferences and WD08 evidence are
unchanged since WD08. Its 12 actual cases used **legacy zero-wire** rendering. Detailed 61px
shared return, synthetic arrival collapse, close fans/head spacing and ~129/157ms sampling medians
remain open/limited; the generic hit fix is accepted without claiming studio activation.

## Required gates and preservation

[Final checks](checks.json), run serially on final source:

- [Repository check](check-final.log.gz): lint/types, 153 files / **1,431 tests**, 114.19s.
- [Native E2E](e2e-final.log.gz): **89/89**, 5.1m, including TinyURL and both mouse rebuilds.
- [Web build](build-final.log.gz): pass, 832ms, inherited chunk warning.
- [Targeted browser/export](browser-final.log.gz): **1/1**, 9.2s. TinyURL [renders](tinyurl-mouse.png)
  with 12 legacy edges/zero wires; Fit and [Preview/Download](mouse-export.png) work by mouse.
  Both screenshots were visually inspected. The actual downloaded ZIP contains the corrected
  local summary, exact deployment links and stamp-key inventory: [receipt](browser-receipt.json).
  [Temporary config](browser.config.mts.txt) and [probe](browser-review.spec.ts.txt) are retained
  as text, with no permanent browser fixture or dependency added.

The [first probe](browser-first-failure.log.gz) reached download, then its temporary harness
failed `spawnSync unzip ENOENT`. Its [PNG](browser-first-failure.png) and
[trace](browser-first-failure-trace.zip) were copied before rerunning. Only the temporary harness
changed to Python's standard-library ZIP reader; the product/source and assertions stayed intact.
No successful unrelated gate was repeated. The downloaded archive's SHA-256 is in checks.json.

[Preservation](preservation.json) compares all **7,404 unrelated starting byte/mode/absence
states**, own starting modes and the old handoff prefix. The exact original **42 container
ID/name/state triples / nine networks / 23 volumes / 43 images** and both old E2E rows match;
no task resource/project remains and test ports are free. Owner web PID 1124326 is unchanged.
API child 907676→927362 remains under the pre-existing watcher; automatic source reload is the
supported inference, not an owner-service control. No owner-port request was made.

The read-only original [RG21 audit](rg21-preservation.log.gz) passes with process-local Git
abbreviation 7, preserving owner/root bytes/modes, accepted migrations/SQL/dependencies, frozen
v1 and original container identities. [Link/status checks](link-check.json) pass. No root edits,
old export/evidence change, stopped patch application, new architectural contract, later plan,
whole-application benchmark, live/paid call, push or deployment occurred. Existing lint/chunk
warnings remain. Final own-path lint caught only the new browser receipt's array formatting;
that receipt was formatted and the [scoped check](scoped-lint-final.log.gz) passes. The
[initial formatting report](scoped-lint.log.gz) is retained; no product/gate rerun was needed.
WD14 ends with this review and its single scoped local commit; coordinator
acceptance follows. WD06/07/12 remain stopped, with their Acceptance unmet as recorded.

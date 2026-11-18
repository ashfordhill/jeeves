# WD09 evidence

The new [fixture](../../../../../field-projects/generator-system/fixtures/wd-deployment/design.ts)
has four processes, a workload-authenticated call, source-backed cache, original database,
consumer/channel and an application-written search index. Its
[handwritten expectation](../../../../../field-projects/generator-system/fixtures/wd-deployment/expected.ts)
is independent of the emitter. Separate new variants cover admission state and browser sessions.

[Focused tests](../../../../../jeeves-generator/src/v2/deployment.test.ts) compare the entire
contract, evaluate the actual emitted configuration readers with a per-process environment proxy,
check each emitted import closure for env-reading modules, verify Mermaid declarations/targets
and existing source folders, and exercise public directory updates and tamper refusal. Four TLS /
credential-location combinations cover optional/dynamically compiled names. The audit executes no
application hooks, clients, sockets or databases. Application-defined settings and third-party SDK
environment conventions remain outside this inventory; no arbitrary hook completeness claim.

The actual public CLI export has 94 files, no findings and 12 explicit required hook/application
gaps. Its generated API8 checker and TypeScript 7.0.2 compile pass offline with existing pinned
dependencies; no install or native generated-system matrix was run. A public `update:v2 --check`
finds no refused or changed files. Generated sources were emitted, never patched for the checks.

[Pin delta](pin-delta.json) lists every changed path in all three current v2 processes-off pins:
two new deployment scaffolds, manifest entries, and resource-label metadata in the two applicable
normalized/diagnostic records. Every old executable payload hash remains unchanged; historical
field inputs/exports and frozen v1 are unchanged. No bulk golden update was used.
[Label rename](label-rename.json) independently compares before/after exports: only metadata,
deployment text and two existing module-slot display comments change. Executable process, pool
and durable-work configuration remains identical.

Deliberate nearest-detail interpretations preserve the reliable-generation contract:

- The existing normalized resource record now retains its source display label. This changes
  its normalized metadata hash, never its stable resource identity or runtime settings. Four
  former label/count assertions were extended for this new display consumer; operational and
  historical expectations remain exact, with original fixtures unedited.
- `alwaysOn` conservatively includes write-capable modules that can enable generated background
  work through application-owned declarations, plus browser session maintenance. Hooks are not
  inspected to fabricate a finer answer.
- Admission/coordination and unknown custom state remain original even in a physical cache.
  Only installed source-backed positive cache reads promise refill. An event feed alone provides
  no full original-source index reconstruction guarantee; current search indexes stay original.
- Environment names describe actual possible generated reads, including optional TLS and private
  credential/replay locations. A mounted-but-unused browser product credential is excluded.

A targeted export run first found the former normalized-label hash assertion. The initial full
check found the old 60-file assertion and two exact normalized-label assertions;
all were corrected to recognize the specified two-file/display-metadata addition, retaining their
other expectations. Focused reruns passed before the final full check. Earlier audit-harness
setup failures and raw logs remain under `/tmp/jeeves-wd09/`; final commands and preservation are
recorded in [checks](checks.json) and [preservation](preservation.json). No studio wire activation or later WD unit was changed.

The first preservation probe failed its strict PID comparison: owner API child 471674 became
656661, while the web PID and listener addresses stayed fixed. Read-only process ancestry shows
the API child under the pre-existing `tsx watch src/main.ts` parent 1124324 (started November 10).
An automatic child reload from required generator/spec source edits is the supported inference;
no owner-port request, process restart/stop or service control action was performed. The final
receipt records this exception explicitly, alongside exact file/resource/project preservation.

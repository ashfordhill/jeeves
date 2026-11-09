# Actual untouched YouTube v2 baseline

**YV2-21 commit `695addeb3ac4a77c3a6fbfd2f68d901fced3619f`** is the prior untouched
generated app. It contains93 files /4,243,495 bytes; each Git blob independently matches
`../inputs/output-path-hashes.json`. The exact frozen YV2-20 command generated that new directory,
then its own frozen install/untouched backend build passed before the baseline commit.
No browser or post-baseline repair was included in that credit.

- Manifest SHA256 `1f49c9301fec3122671190269681adf9423b0d6e6f871873c5f8f6afbf21e9cc`.
- Output inventory SHA256 `ed6eab9609fd59b4148b72ddd25e4481770ab88bff826eebaf7cdbc93195c938`.
- Canonical source SHA256 `e118df2fdb6a4f1d05d1ef24962a926eb8c75e4219d45c9a6eccdfe87030a87b`.
- All four `.jeeves/` files (manifest, report, normalized model, embedded source) remain byte-identical
  after custom completion. Those historical files deliberately keep runtime:none/strict:not-assessed.

YV2-22 adds the existing v1 browser as **reused custom UI**, plus its frontend build and runtime/
edge integration. Every generated backend `src/` byte is retained; **custom backend paths: none;
generated-file repair paths: none**. This is based on actual inspection and the bounded real
walkthrough, not an assertion that an unrun shell was a usable app. The generated static page
was the intentional browser slot. Nine generated app files change and nine app files are added;
[per-file provenance](../../../../docs/plans/reliable-foundations/evidence/youtube-v2/yv2-22/provenance.json)
records baseline/final hashes, categories, v1 source paths/commits and exact-copy status.
[Completion evidence](../../../../docs/plans/reliable-foundations/evidence/youtube-v2/yv2-22-completion.md),
[scope](source-scope.md), [runtime](runtime.md), [scenarios](scenarios.md).

No templates, frozen inputs, source snapshot or baseline metadata were regenerated/relabelled.
All UI remains excluded from both backend LOC totals. YV2-23 must independently copy/build/run,
review the final scope and compare this exact baseline to the actual YV2-22 completion commit
using unchanged source-loc-v2/parser/LCS. No numerical v2 template-share claim is made here.

# Chat design evals (scripted)

Eval 2.0.0; source c7904034360515a056b1dea850aed43ff2c48994; 2026-11-12T04:20:31.140Z. Limits: 16 responses and 16000 output tokens per response, 600 s per case. Scripted models: they prove the scorers and the loop, not model quality.

## Scores

| Run | Spec build | Video brief | Podcast brief | Review | Requests | Input | Output | Est. USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| scripted-good | 100 | 100 | 100 | 100 | 53 | 3565.8 KB ≈ 912,839–1,217,118 tokens | 18.7 KB ≈ 4,796–6,394 tokens | unknown |
| scripted-patterns | 86.3 | 98.2 | 98.2 | – | 12 | 942.9 KB ≈ 241,371–321,828 tokens | 4.8 KB ≈ 1,221–1,628 tokens | unknown |
| scripted-bad | 1.7 | 18.5 | 18.5 | 5 | 19 | 1052.7 KB ≈ 269,497–359,329 tokens | 5.4 KB ≈ 1,372–1,829 tokens | unknown |

Spec build: 0–100 against the v3 reference by name (tiles, links, modules, module links, templates). Video and podcast briefs: 0–100 by the capability rubric (kinds, wiring, async, guards, templates), names aside. Review: each sample's mean over the review cases, each 50 × named + 50 × fixed. Input and output are the provider's reported tokens, or, where it reports none, the measured bytes, at about 3 to 4 bytes a token. Est. USD uses known list prices only (gpt-5.4-mini, Claude Haiku 5.5 and Sonnet 5.5); it is an estimate, not billing.

## Every case

| Case | scripted-good | scripted-patterns | scripted-bad |
| --- | ---: | ---: | ---: |
| v3-build | 100 | 86.3 | 1.7 |
| video-build | 100 | 98.2 | 18.5 |
| podcast-build | 100 | 98.2 | 18.5 |
| review-module-status | 100 | – | 0 |
| review-unconnected-slot | 100 | – | 0 |
| review-generation | 100 | – | 0 |
| review-store-without-writer | 100 | – | 0 |
| review-unrelated-store | 100 | – | 0 |
| review-user-reaches-store | 100 | – | 0 |
| review-long-line | 100 | – | 50 |
| review-line-style | 100 | – | 0 |
| review-out-of-range | 100 | – | 0 |
| review-warning | 100 | – | 0 |

## scripted-good

53 requests, 3565.8 KB sent (2443.2 KB of it the repeated instructions and tools; the largest request 132.9 KB), 18.7 KB received.

- Spec build: tiles 100, links 100, modules 100, module links 100, templates 100.
- Video brief: kinds 100, wiring 100, async 100, guards 100, templates 100.
- Podcast brief: kinds 100, wiring 100, async 100, guards 100, templates 100.

| Case | # | Score | Requests | Sent | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| v3-build | 1 | 100 | 5 | 427.8 KB | none |
| video-build | 1 | 100 | 5 | 388.1 KB | none |
| podcast-build | 1 | 100 | 5 | 388.3 KB | none |
| review-module-status | 1 | 100 | 4 | 248.7 KB | none |
| review-unconnected-slot | 1 | 100 | 4 | 260.8 KB | none |
| review-generation | 1 | 100 | 4 | 245.1 KB | none |
| review-store-without-writer | 1 | 100 | 4 | 217.2 KB | none |
| review-unrelated-store | 1 | 100 | 4 | 299.2 KB | none |
| review-user-reaches-store | 1 | 100 | 4 | 218.2 KB | none |
| review-long-line | 1 | 100 | 2 | 139.6 KB | none |
| review-line-style | 1 | 100 | 4 | 258.6 KB | none |
| review-out-of-range | 1 | 100 | 4 | 257.4 KB | none |
| review-warning | 1 | 100 | 4 | 216.9 KB | none |

## scripted-patterns

12 requests, 942.9 KB sent (553.2 KB of it the repeated instructions and tools; the largest request 124.3 KB), 4.8 KB received.

- Spec build: tiles 100, links 97, modules 71.2, module links 96.7, templates 66.7.
- Video brief: kinds 100, wiring 100, async 100, guards 100, templates 90.9.
- Podcast brief: kinds 100, wiring 100, async 100, guards 100, templates 90.9.

| Case | # | Score | Requests | Sent | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| v3-build | 1 | 86.3 | 4 | 328.4 KB | upload entry → Sign-in (missing); Watch API / View publisher (kind event-publisher, not custom); View counter / View consumer (another name; the only one of its kind); View counter / Receipt and increment (another name; the only one of its kind); View counter / Count writer (another name; the only one of its kind); Upload API / Creator check (another name; the only one of its kind); Upload API / Job outbox publisher (another name; the only one of its kind); Upload API / Upload state writer (another name; the only one of its kind) |
| video-build | 1 | 98.2 | 4 | 307.2 KB | Runnable processes on (off) |
| podcast-build | 1 | 98.2 | 4 | 307.3 KB | Runnable processes on (off) |

## scripted-bad

19 requests, 1052.7 KB sent (875.9 KB of it the repeated instructions and tools; the largest request 64.8 KB), 5.4 KB received.

- Spec build: tiles 2.4, links 6.1, modules 0, module links 0, templates 0.
- Video brief: kinds 30, wiring 33.3, async 20, guards 0, templates 9.1.
- Podcast brief: kinds 30, wiring 33.3, async 20, guards 0, templates 9.1.

| Case | # | Score | Requests | Sent | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| v3-build | 1 | 1.7 | 3 | 172.9 KB | Watch API (missing); Hot metadata (missing); Metadata (missing); View counts (missing); View events (missing); View counter (missing); Search API (missing); Videos (missing) |
| video-build | 1 | 18.5 | 3 | 159.8 KB | a processing worker fed through a queue by the uploads (none); separate object storage the processing worker writes (no processing worker); a CDN on the download lane serving object storage (none); an identity provider (none); a search index (none); a cache a download-lane service reads (none); a counts database written by a worker that consumes events (none); a lifecycle worker after the processing results writes the records (no worker consumes the processing results) |
| podcast-build | 1 | 18.5 | 3 | 159.8 KB | a processing worker fed through a queue by the uploads (none); separate object storage the processing worker writes (no processing worker); a CDN on the download lane serving object storage (none); an identity provider (none); a search index (none); a cache a download-lane service reads (none); a counts database written by a worker that consumes events (none); a lifecycle worker after the processing results writes the records (no worker consumes the processing results) |
| review-module-status | 1 | 0 | 1 | 55.2 KB | not named; still reported |
| review-unconnected-slot | 1 | 0 | 1 | 57.0 KB | not named; still reported |
| review-generation | 1 | 0 | 1 | 54.6 KB | not named; still reported |
| review-store-without-writer | 1 | 0 | 1 | 51.2 KB | not named; still reported |
| review-unrelated-store | 1 | 0 | 1 | 61.8 KB | not named; still reported |
| review-user-reaches-store | 1 | 0 | 1 | 51.4 KB | not named; still reported |
| review-long-line | 1 | 50 | 1 | 64.8 KB | not named |
| review-line-style | 1 | 0 | 1 | 56.5 KB | not named; still reported |
| review-out-of-range | 1 | 0 | 1 | 56.7 KB | not named; still reported |
| review-warning | 1 | 0 | 1 | 51.0 KB | not named; still reported |

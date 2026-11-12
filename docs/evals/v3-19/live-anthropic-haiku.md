# Chat design evals (live)

Eval 2.0.0; source c7904034360515a056b1dea850aed43ff2c48994; 2026-11-12T04:21:05.651Z. Limits: 16 responses and 16000 output tokens per response, 600 s per case. Up to 5 samples per case per model; each cell is the mean, then the lowest and highest sample.

## Scores

| Run | Spec build | Video brief | Podcast brief | Review | Requests | Input | Output | Est. USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| anthropic:claude-haiku-5-5 | 99.8 (99–100, n=5) | 97.8 (94.4–100, n=5) | 94.4 (94.4–94.4, n=5) | 98 (95–100, n=5) | 288 | 9272711 tokens (7690824 cached) | 256043 tokens | 0.40 |

Spec build: 0–100 against the v3 reference by name (tiles, links, modules, module links, templates). Video and podcast briefs: 0–100 by the capability rubric (kinds, wiring, async, guards, templates), names aside. Review: each sample's mean over the review cases, each 50 × named + 50 × fixed. Input and output are the provider's reported tokens, or, where it reports none, the measured bytes, at about 3 to 4 bytes a token. Est. USD uses known list prices only (gpt-5.4-mini, Claude Haiku 5.5 and Sonnet 5.5); it is an estimate, not billing.

## Every case

| Case | anthropic:claude-haiku-5-5 |
| --- | ---: |
| v3-build | 99.8 (99–100, n=5) |
| video-build | 97.8 (94.4–100, n=5) |
| podcast-build | 94.4 (94.4–94.4, n=5) |
| review-module-status | 100 (100–100, n=5) |
| review-unconnected-slot | 100 (100–100, n=5) |
| review-generation | 100 (100–100, n=5) |
| review-store-without-writer | 100 (100–100, n=5) |
| review-unrelated-store | 80 (50–100, n=5) |
| review-user-reaches-store | 100 (100–100, n=5) |
| review-long-line | 100 (100–100, n=5) |
| review-line-style | 100 (100–100, n=5) |
| review-out-of-range | 100 (100–100, n=5) |
| review-warning | 100 (100–100, n=5) |

## anthropic:claude-haiku-5-5

288 requests, 22981.7 KB sent (13276.4 KB of it the repeated instructions and tools; the largest request 202.7 KB), 301.3 KB received. Settings: api Messages API, streamed; adaptive thinking; prompt caching on; effort medium; maxRetries 2.

- Spec build: tiles 100 (100–100, n=5), links 100 (100–100, n=5), modules 100 (100–100, n=5), module links 100 (100–100, n=5), templates 99 (95.2–100, n=5).
- Video brief: kinds 100 (100–100, n=5), wiring 100 (100–100, n=5), async 100 (100–100, n=5), guards 90 (75–100, n=5), templates 98.8 (97–100, n=5).
- Podcast brief: kinds 100 (100–100, n=5), wiring 100 (100–100, n=5), async 100 (100–100, n=5), guards 75 (75–75, n=5), templates 97 (97–97, n=5).

| Case | # | Score | Requests | Sent | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| v3-build | 1 | 100 | 9 | 997.2 KB | none |
| video-build | 1 | 100 | 6 | 534.0 KB | none |
| podcast-build | 1 | 94.4 | 4 | 360.6 KB | Optional sign-in on the read path (no Auth guard); Sign-in on three tiles resolves (2 resolve) |
| review-module-status | 1 | 100 | 4 | 276.3 KB | none |
| review-unconnected-slot | 1 | 100 | 4 | 293.6 KB | none |
| review-generation | 1 | 100 | 4 | 270.8 KB | none |
| review-store-without-writer | 1 | 100 | 4 | 218.0 KB | none |
| review-unrelated-store | 1 | 100 | 3 | 223.5 KB | none |
| review-user-reaches-store | 1 | 100 | 5 | 283.1 KB | none |
| review-long-line | 1 | 100 | 2 | 139.6 KB | none |
| review-line-style | 1 | 100 | 3 | 193.0 KB | none |
| review-out-of-range | 1 | 100 | 4 | 313.5 KB | none |
| review-warning | 1 | 100 | 6 | 391.5 KB | none |
| v3-build | 2 | 100 | 8 | 934.4 KB | none |
| video-build | 2 | 94.4 | 5 | 443.2 KB | Optional sign-in on the read path (no Auth guard); Sign-in on three tiles resolves (2 resolve) |
| podcast-build | 2 | 94.4 | 7 | 649.9 KB | Optional sign-in on the read path (no Auth guard); Sign-in on three tiles resolves (2 resolve) |
| review-module-status | 2 | 100 | 4 | 249.9 KB | none |
| review-unconnected-slot | 2 | 100 | 4 | 293.8 KB | none |
| review-generation | 2 | 100 | 4 | 279.1 KB | none |
| review-store-without-writer | 2 | 100 | 2 | 105.4 KB | none |
| review-unrelated-store | 2 | 50 | 2 | 133.8 KB | still reported |
| review-user-reaches-store | 2 | 100 | 4 | 211.3 KB | none |
| review-long-line | 2 | 100 | 2 | 139.6 KB | none |
| review-line-style | 2 | 100 | 6 | 475.8 KB | none |
| review-out-of-range | 2 | 100 | 3 | 180.3 KB | none |
| review-warning | 2 | 100 | 5 | 316.7 KB | none |
| v3-build | 3 | 99 | 8 | 849.7 KB | Watch API / Viewer check.signIn = optional (is required) |
| video-build | 3 | 100 | 6 | 556.2 KB | none |
| podcast-build | 3 | 94.4 | 6 | 532.6 KB | Optional sign-in on the read path (no Auth guard); Sign-in on three tiles resolves (2 resolve) |
| review-module-status | 3 | 100 | 4 | 250.0 KB | none |
| review-unconnected-slot | 3 | 100 | 4 | 293.4 KB | none |
| review-generation | 3 | 100 | 3 | 183.1 KB | none |
| review-store-without-writer | 3 | 100 | 2 | 105.4 KB | none |
| review-unrelated-store | 3 | 100 | 5 | 451.1 KB | none |
| review-user-reaches-store | 3 | 100 | 3 | 157.7 KB | none |
| review-long-line | 3 | 100 | 2 | 139.6 KB | none |
| review-line-style | 3 | 100 | 4 | 260.5 KB | none |
| review-out-of-range | 3 | 100 | 2 | 121.2 KB | none |
| review-warning | 3 | 100 | 4 | 231.7 KB | none |
| v3-build | 4 | 100 | 8 | 954.9 KB | none |
| video-build | 4 | 94.4 | 6 | 608.7 KB | Optional sign-in on the read path (no Auth guard); Sign-in on three tiles resolves (2 resolve) |
| podcast-build | 4 | 94.4 | 5 | 442.7 KB | Optional sign-in on the read path (no Auth guard); Sign-in on three tiles resolves (2 resolve) |
| review-module-status | 4 | 100 | 5 | 349.6 KB | none |
| review-unconnected-slot | 4 | 100 | 4 | 293.7 KB | none |
| review-generation | 4 | 100 | 4 | 271.2 KB | none |
| review-store-without-writer | 4 | 100 | 2 | 105.4 KB | none |
| review-unrelated-store | 4 | 50 | 2 | 149.1 KB | still reported |
| review-user-reaches-store | 4 | 100 | 2 | 105.8 KB | none |
| review-long-line | 4 | 100 | 2 | 139.6 KB | none |
| review-line-style | 4 | 100 | 5 | 328.6 KB | none |
| review-out-of-range | 4 | 100 | 4 | 258.5 KB | none |
| review-warning | 4 | 100 | 4 | 231.8 KB | none |
| v3-build | 5 | 100 | 8 | 910.2 KB | none |
| video-build | 5 | 100 | 10 | 1018.4 KB | none |
| podcast-build | 5 | 94.4 | 9 | 880.0 KB | Optional sign-in on the read path (no Auth guard); Sign-in on three tiles resolves (2 resolve) |
| review-module-status | 5 | 100 | 4 | 276.2 KB | none |
| review-unconnected-slot | 5 | 100 | 4 | 294.8 KB | none |
| review-generation | 5 | 100 | 4 | 271.2 KB | none |
| review-store-without-writer | 5 | 100 | 5 | 286.0 KB | none |
| review-unrelated-store | 5 | 100 | 5 | 524.3 KB | none |
| review-user-reaches-store | 5 | 100 | 4 | 221.8 KB | none |
| review-long-line | 5 | 100 | 2 | 139.6 KB | none |
| review-line-style | 5 | 100 | 3 | 193.3 KB | none |
| review-out-of-range | 5 | 100 | 4 | 295.5 KB | none |
| review-warning | 5 | 100 | 6 | 390.9 KB | none |

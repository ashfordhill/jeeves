# Chat design evals (live)

Eval 2.0.0; source c7904034360515a056b1dea850aed43ff2c48994; 2026-11-12T04:45:47.073Z. Limits: 16 responses and 16000 output tokens per response, 600 s per case. Up to 5 samples per case per model; each cell is the mean, then the lowest and highest sample.

## Scores

| Run | Spec build | Video brief | Podcast brief | Review | Requests | Input | Output | Est. USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codex:gpt-6-luna | 98 (91–100, n=5) | 81.2 (5.8–100, n=5) | 90.5 (79.6–100, n=5) | 85 (70–92.5, n=5) | 323 | 19663779 tokens (11478144 cached) | 109286 tokens | unknown |

Spec build: 0–100 against the v3 reference by name (tiles, links, modules, module links, templates). Video and podcast briefs: 0–100 by the capability rubric (kinds, wiring, async, guards, templates), names aside. Review: each sample's mean over the review cases, each 50 × named + 50 × fixed. Input and output are the provider's reported tokens, or, where it reports none, the measured bytes, at about 3 to 4 bytes a token. Est. USD uses known list prices only (gpt-5.4-mini, Claude Haiku 5.5 and Sonnet 5.5); it is an estimate, not billing.

## Every case

| Case | codex:gpt-6-luna |
| --- | ---: |
| v3-build | 98 (91–100, n=5) |
| video-build | 81.2 (5.8–100, n=5) |
| podcast-build | 90.5 (79.6–100, n=5) |
| review-module-status | 95 (75–100, n=5) |
| review-unconnected-slot | 70 (50–100, n=5) |
| review-generation | 80 (0–100, n=5) |
| review-store-without-writer | 90 (50–100, n=5) |
| review-unrelated-store | 45 (25–50, n=5) |
| review-user-reaches-store | 90 (50–100, n=5) |
| review-long-line | 100 (100–100, n=5) |
| review-line-style | 90 (50–100, n=5) |
| review-out-of-range | 90 (50–100, n=5) |
| review-warning | 100 (100–100, n=5) |

## codex:gpt-6-luna

323 requests, 34316.9 KB sent (14889.9 KB of it the repeated instructions and tools; the largest request 371.4 KB), 201.0 KB received. Settings: api Codex SDK, ChatGPT login, structured answer; effort medium.

- Spec build: tiles 100 (100–100, n=5), links 98.8 (97–100, n=5), modules 100 (100–100, n=5), module links 98.7 (93.3–100, n=5), templates 92.4 (61.9–100, n=5).
- Video brief: kinds 80 (0–100, n=5), wiring 80 (0–100, n=5), async 84 (20–100, n=5), guards 80 (0–100, n=5), templates 81.8 (9.1–100, n=5).
- Podcast brief: kinds 92 (80–100, n=5), wiring 96.7 (83.3–100, n=5), async 98 (90–100, n=5), guards 77.5 (62.5–100, n=5), templates 88.5 (69.7–100, n=5).

| Case | # | Score | Requests | Sent | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| v3-build | 1 | 99.4 | 9 | 1002.4 KB | upload entry → Sign-in (missing) |
| video-build | 1 | 100 | 9 | 1218.5 KB | none |
| podcast-build | 1 | 92.4 | 9 | 1438.6 KB | a CDN on the download lane serving object storage (none); Optional sign-in on the read path (no Auth guard); Sign-in on three tiles resolves (2 resolve) |
| review-module-status | 1 | 100 | 6 | 551.4 KB | none |
| review-unconnected-slot | 1 | 50 | 4 | 355.0 KB | not named |
| review-generation | 1 | 100 | 4 | 245.2 KB | none |
| review-store-without-writer | 1 | 100 | 4 | 309.8 KB | none |
| review-unrelated-store | 1 | 50 | 2 | 178.0 KB | still reported |
| review-user-reaches-store | 1 | 100 | 4 | 278.7 KB | none |
| review-long-line | 1 | 100 | 2 | 139.6 KB | none |
| review-line-style | 1 | 100 | 4 | 296.9 KB | none |
| review-out-of-range | 1 | 100 | 3 | 235.2 KB | none |
| review-warning | 1 | 100 | 4 | 308.9 KB | none |
| v3-build | 2 | 100 | 8 | 1095.7 KB | none |
| video-build | 2 | 100 | 8 | 876.1 KB | none |
| podcast-build | 2 | 100 | 13 | 2373.5 KB | none |
| review-module-status | 2 | 100 | 5 | 449.9 KB | none |
| review-unconnected-slot | 2 | 100 | 5 | 475.6 KB | none |
| review-generation | 2 | 100 | 4 | 302.0 KB | none |
| review-store-without-writer | 2 | 100 | 4 | 249.7 KB | none |
| review-unrelated-store | 2 | 25 | 2 | 149.8 KB | named where, not what; still reported |
| review-user-reaches-store | 2 | 100 | 4 | 278.2 KB | none |
| review-long-line | 2 | 100 | 5 | 621.1 KB | none |
| review-line-style | 2 | 100 | 5 | 431.2 KB | none |
| review-out-of-range | 2 | 100 | 4 | 342.8 KB | none |
| review-warning | 2 | 100 | 4 | 276.1 KB | none |
| v3-build | 3 | 99.4 | 7 | 864.4 KB | upload entry → Sign-in (missing) |
| video-build | 3 | 5.8 | 16 | 2726.0 KB | error: The assistant didn't finish within 16 steps. Nothing was changed.; an Uploads tile on the upload lane (none); object storage the uploads write (the uploads write none); a processing worker fed through a queue by the uploads (none); separate object storage the processing worker writes (no processing worker); a CDN on the download lane serving object storage (none); a database the uploads record into (none); an identity provider (none); a search index (none) |
| podcast-build | 3 | 92.4 | 6 | 683.1 KB | a CDN on the download lane serving object storage (none); Optional sign-in on the read path (no Auth guard); Sign-in on three tiles resolves (2 resolve) |
| review-module-status | 3 | 100 | 4 | 248.9 KB | none |
| review-unconnected-slot | 3 | 50 | 4 | 343.3 KB | still reported |
| review-generation | 3 | 0 | 2 | 146.3 KB | not named; still reported |
| review-store-without-writer | 3 | 100 | 4 | 318.3 KB | none |
| review-unrelated-store | 3 | 50 | 2 | 159.9 KB | still reported |
| review-user-reaches-store | 3 | 100 | 4 | 279.5 KB | none |
| review-long-line | 3 | 100 | 2 | 176.2 KB | none |
| review-line-style | 3 | 50 | 2 | 141.9 KB | still reported |
| review-out-of-range | 3 | 50 | 2 | 142.8 KB | still reported |
| review-warning | 3 | 100 | 5 | 402.5 KB | none |
| v3-build | 4 | 91 | 15 | 2377.2 KB | View publisher → View events (missing); View publisher → Metadata (missing); Upload API.requestTimeoutMs = 5000 (is 1000); Upload API.concurrencyLimit = 500 (is 1000); Watch API.concurrencyLimit = 2000 (is 1000); Watch API / Video details reader.poolSize = 50 (is 10); Watch API / Video details reader.statementTimeoutMs = 500 (is 2000); Hot metadata.ttlSeconds = 3601 (is 3600) |
| video-build | 4 | 100 | 5 | 527.6 KB | none |
| podcast-build | 4 | 79.6 | 8 | 1006.1 KB | a CDN on the download lane serving object storage (none); a search index (none); search fed by events: an indexer after the lifecycle writes the index a service reads (the index isn't fed by events); the event channels are Topics (some aren't topics); Optional sign-in on the read path (no Auth guard); Sign-in on three tiles resolves (2 resolve); Search indexing resolves (not a template); Search query resolves (not a template) |
| review-module-status | 4 | 75 | 3 | 248.2 KB | named where, not what |
| review-unconnected-slot | 4 | 100 | 4 | 355.4 KB | none |
| review-generation | 4 | 100 | 6 | 559.0 KB | none |
| review-store-without-writer | 4 | 50 | 3 | 222.2 KB | still reported |
| review-unrelated-store | 4 | 50 | 3 | 284.1 KB | still reported |
| review-user-reaches-store | 4 | 50 | 2 | 125.9 KB | still reported |
| review-long-line | 4 | 100 | 2 | 139.6 KB | none |
| review-line-style | 4 | 100 | 4 | 267.5 KB | none |
| review-out-of-range | 4 | 100 | 4 | 312.0 KB | none |
| review-warning | 4 | 100 | 5 | 388.4 KB | none |
| v3-build | 5 | 100 | 10 | 1351.9 KB | none |
| video-build | 5 | 100 | 5 | 617.6 KB | none |
| podcast-build | 5 | 88.3 | 6 | 864.5 KB | Optional sign-in on the read path (no Auth guard); Required sign-in on favorites (optional); Sign-in on three tiles resolves (2 resolve); Favorites resolves (not a template); nothing left to fix in the review (1 to fix) |
| review-module-status | 5 | 100 | 6 | 533.6 KB | none |
| review-unconnected-slot | 5 | 50 | 2 | 153.3 KB | still reported |
| review-generation | 5 | 100 | 5 | 375.4 KB | none |
| review-store-without-writer | 5 | 100 | 4 | 309.6 KB | none |
| review-unrelated-store | 5 | 50 | 3 | 247.8 KB | still reported |
| review-user-reaches-store | 5 | 100 | 4 | 282.9 KB | none |
| review-long-line | 5 | 100 | 5 | 589.7 KB | none |
| review-line-style | 5 | 100 | 5 | 322.9 KB | none |
| review-out-of-range | 5 | 100 | 4 | 353.2 KB | none |
| review-warning | 5 | 100 | 5 | 387.9 KB | none |

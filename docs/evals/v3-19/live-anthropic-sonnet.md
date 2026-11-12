# Chat design evals (live)

Eval 2.0.0; source c7904034360515a056b1dea850aed43ff2c48994; 2026-11-12T04:21:05.416Z. Limits: 16 responses and 16000 output tokens per response, 600 s per case. Up to 3 samples per case per model; each cell is the mean, then the lowest and highest sample.

## Scores

| Run | Spec build | Video brief | Podcast brief | Review | Requests | Input | Output | Est. USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| anthropic:claude-sonnet-5-5 | 100 (100–100, n=3) | 100 (100–100, n=3) | 100 (100–100, n=3) | 95 (95–95, n=3) | 164 | 4835664 tokens (4151526 cached) | 73109 tokens | 3.27 |

Spec build: 0–100 against the v3 reference by name (tiles, links, modules, module links, templates). Video and podcast briefs: 0–100 by the capability rubric (kinds, wiring, async, guards, templates), names aside. Review: each sample's mean over the review cases, each 50 × named + 50 × fixed. Input and output are the provider's reported tokens, or, where it reports none, the measured bytes, at about 3 to 4 bytes a token. Est. USD uses known list prices only (gpt-5.4-mini, Claude Haiku 5.5 and Sonnet 5.5); it is an estimate, not billing.

## Every case

| Case | anthropic:claude-sonnet-5-5 |
| --- | ---: |
| v3-build | 100 (100–100, n=3) |
| video-build | 100 (100–100, n=3) |
| podcast-build | 100 (100–100, n=3) |
| review-module-status | 100 (100–100, n=3) |
| review-unconnected-slot | 100 (100–100, n=3) |
| review-generation | 100 (100–100, n=3) |
| review-store-without-writer | 100 (100–100, n=3) |
| review-unrelated-store | 50 (50–50, n=3) |
| review-user-reaches-store | 100 (100–100, n=3) |
| review-long-line | 100 (100–100, n=3) |
| review-line-style | 100 (100–100, n=3) |
| review-out-of-range | 100 (100–100, n=3) |
| review-warning | 100 (100–100, n=3) |

## anthropic:claude-sonnet-5-5

164 requests, 12580.8 KB sent (7560.2 KB of it the repeated instructions and tools; the largest request 208.4 KB), 183.2 KB received. Settings: api Messages API, streamed; adaptive thinking; prompt caching on; effort medium; maxRetries 2.

- Spec build: tiles 100 (100–100, n=3), links 100 (100–100, n=3), modules 100 (100–100, n=3), module links 100 (100–100, n=3), templates 100 (100–100, n=3).
- Video brief: kinds 100 (100–100, n=3), wiring 100 (100–100, n=3), async 100 (100–100, n=3), guards 100 (100–100, n=3), templates 100 (100–100, n=3).
- Podcast brief: kinds 100 (100–100, n=3), wiring 100 (100–100, n=3), async 100 (100–100, n=3), guards 100 (100–100, n=3), templates 100 (100–100, n=3).

| Case | # | Score | Requests | Sent | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| v3-build | 1 | 100 | 8 | 939.3 KB | none |
| video-build | 1 | 100 | 8 | 737.4 KB | none |
| podcast-build | 1 | 100 | 5 | 480.2 KB | none |
| review-module-status | 1 | 100 | 4 | 248.1 KB | none |
| review-unconnected-slot | 1 | 100 | 3 | 181.1 KB | none |
| review-generation | 1 | 100 | 4 | 245.9 KB | none |
| review-store-without-writer | 1 | 100 | 3 | 157.9 KB | none |
| review-unrelated-store | 1 | 50 | 6 | 444.0 KB | still reported |
| review-user-reaches-store | 1 | 100 | 3 | 158.6 KB | none |
| review-long-line | 1 | 100 | 2 | 139.6 KB | none |
| review-line-style | 1 | 100 | 4 | 240.9 KB | none |
| review-out-of-range | 1 | 100 | 3 | 180.1 KB | none |
| review-warning | 1 | 100 | 4 | 254.8 KB | none |
| v3-build | 2 | 100 | 8 | 939.3 KB | none |
| video-build | 2 | 100 | 5 | 469.6 KB | none |
| podcast-build | 2 | 100 | 7 | 651.3 KB | none |
| review-module-status | 2 | 100 | 4 | 249.7 KB | none |
| review-unconnected-slot | 2 | 100 | 3 | 180.8 KB | none |
| review-generation | 2 | 100 | 4 | 246.0 KB | none |
| review-store-without-writer | 2 | 100 | 3 | 158.0 KB | none |
| review-unrelated-store | 2 | 50 | 4 | 294.4 KB | still reported |
| review-user-reaches-store | 2 | 100 | 3 | 158.7 KB | none |
| review-long-line | 2 | 100 | 2 | 139.6 KB | none |
| review-line-style | 2 | 100 | 4 | 240.7 KB | none |
| review-out-of-range | 2 | 100 | 3 | 180.1 KB | none |
| review-warning | 2 | 100 | 3 | 157.5 KB | none |
| v3-build | 3 | 100 | 7 | 880.4 KB | none |
| video-build | 3 | 100 | 5 | 411.4 KB | none |
| podcast-build | 3 | 100 | 7 | 654.2 KB | none |
| review-module-status | 3 | 100 | 4 | 249.6 KB | none |
| review-unconnected-slot | 3 | 100 | 3 | 180.9 KB | none |
| review-generation | 3 | 100 | 4 | 246.1 KB | none |
| review-store-without-writer | 3 | 100 | 3 | 158.0 KB | none |
| review-unrelated-store | 3 | 50 | 6 | 449.2 KB | still reported |
| review-user-reaches-store | 3 | 100 | 3 | 158.8 KB | none |
| review-long-line | 3 | 100 | 2 | 139.6 KB | none |
| review-line-style | 3 | 100 | 4 | 240.9 KB | none |
| review-out-of-range | 3 | 100 | 3 | 180.3 KB | none |
| review-warning | 3 | 100 | 3 | 157.6 KB | none |

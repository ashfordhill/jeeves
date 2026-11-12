# Chat design evals (live)

Eval 2.0.0; source c7904034360515a056b1dea850aed43ff2c48994; 2026-11-12T04:41:49.568Z. Limits: 16 responses and 16000 output tokens per response, 600 s per case. Up to 3 samples per case per model; each cell is the mean, then the lowest and highest sample.

## Scores

| Run | Spec build | Video brief | Podcast brief | Review | Requests | Input | Output | Est. USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codex:gpt-6.1-sol | 100 (100–100, n=3) | 100 (100–100, n=3) | 90.5 (84.7–100, n=3) | 93.3 (92.5–95, n=3) | 176 | 5568332 tokens (1675520 cached) | 33700 tokens | unknown |

Spec build: 0–100 against the v3 reference by name (tiles, links, modules, module links, templates). Video and podcast briefs: 0–100 by the capability rubric (kinds, wiring, async, guards, templates), names aside. Review: each sample's mean over the review cases, each 50 × named + 50 × fixed. Input and output are the provider's reported tokens, or, where it reports none, the measured bytes, at about 3 to 4 bytes a token. Est. USD uses known list prices only (gpt-5.4-mini, Claude Haiku 5.5 and Sonnet 5.5); it is an estimate, not billing.

## Every case

| Case | codex:gpt-6.1-sol |
| --- | ---: |
| v3-build | 100 (100–100, n=3) |
| video-build | 100 (100–100, n=3) |
| podcast-build | 90.5 (84.7–100, n=3) |
| review-module-status | 100 (100–100, n=3) |
| review-unconnected-slot | 100 (100–100, n=3) |
| review-generation | 100 (100–100, n=3) |
| review-store-without-writer | 100 (100–100, n=3) |
| review-unrelated-store | 50 (50–50, n=3) |
| review-user-reaches-store | 83.3 (75–100, n=3) |
| review-long-line | 100 (100–100, n=3) |
| review-line-style | 100 (100–100, n=3) |
| review-out-of-range | 100 (100–100, n=3) |
| review-warning | 100 (100–100, n=3) |

## codex:gpt-6.1-sol

176 requests, 16308.1 KB sent (8113.4 KB of it the repeated instructions and tools; the largest request 236.4 KB), 140.5 KB received. Settings: api Codex SDK, ChatGPT login, structured answer; effort medium.

- Spec build: tiles 100 (100–100, n=3), links 100 (100–100, n=3), modules 100 (100–100, n=3), module links 100 (100–100, n=3), templates 100 (100–100, n=3).
- Video brief: kinds 100 (100–100, n=3), wiring 100 (100–100, n=3), async 100 (100–100, n=3), guards 100 (100–100, n=3), templates 100 (100–100, n=3).
- Podcast brief: kinds 96.7 (90–100, n=3), wiring 83.3 (75–100, n=3), async 96.7 (95–100, n=3), guards 100 (100–100, n=3), templates 75.7 (63.6–100, n=3).

| Case | # | Score | Requests | Sent | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| v3-build | 1 | 100 | 6 | 713.5 KB | none |
| video-build | 1 | 100 | 8 | 1005.4 KB | none |
| podcast-build | 1 | 84.7 | 9 | 1176.5 KB | a CDN on the download lane serving object storage (none); a lifecycle worker after the processing results writes the records (no worker consumes the processing results); search fed by events: an indexer after the lifecycle writes the index a service reads (the index isn't fed by events); four channels: jobs, results, publications and plays (3 channels); Upload lifecycle resolves (not a template); Search indexing resolves (not a template); Search query resolves (not a template); nothing left to fix in the review (2 to fix) |
| review-module-status | 1 | 100 | 4 | 336.2 KB | none |
| review-unconnected-slot | 1 | 100 | 4 | 261.8 KB | none |
| review-generation | 1 | 100 | 4 | 332.9 KB | none |
| review-store-without-writer | 1 | 100 | 4 | 217.6 KB | none |
| review-unrelated-store | 1 | 50 | 2 | 162.9 KB | still reported |
| review-user-reaches-store | 1 | 75 | 4 | 233.1 KB | named where, not what |
| review-long-line | 1 | 100 | 2 | 157.7 KB | none |
| review-line-style | 1 | 100 | 4 | 259.2 KB | none |
| review-out-of-range | 1 | 100 | 4 | 258.0 KB | none |
| review-warning | 1 | 100 | 4 | 305.0 KB | none |
| v3-build | 2 | 100 | 6 | 724.2 KB | none |
| video-build | 2 | 100 | 7 | 913.5 KB | none |
| podcast-build | 2 | 86.7 | 10 | 1321.9 KB | a lifecycle worker after the processing results writes the records (no worker consumes the processing results); search fed by events: an indexer after the lifecycle writes the index a service reads (the index isn't fed by events); four channels: jobs, results, publications and plays (3 channels); Upload lifecycle resolves (not a template); Search indexing resolves (not a template); Search query resolves (not a template); nothing left to fix in the review (2 to fix) |
| review-module-status | 2 | 100 | 4 | 303.7 KB | none |
| review-unconnected-slot | 2 | 100 | 4 | 347.1 KB | none |
| review-generation | 2 | 100 | 4 | 332.2 KB | none |
| review-store-without-writer | 2 | 100 | 4 | 218.1 KB | none |
| review-unrelated-store | 2 | 50 | 2 | 162.7 KB | still reported |
| review-user-reaches-store | 2 | 75 | 4 | 273.1 KB | named where, not what |
| review-long-line | 2 | 100 | 2 | 139.6 KB | none |
| review-line-style | 2 | 100 | 4 | 313.7 KB | none |
| review-out-of-range | 2 | 100 | 4 | 257.6 KB | none |
| review-warning | 2 | 100 | 4 | 304.6 KB | none |
| v3-build | 3 | 100 | 6 | 747.3 KB | none |
| video-build | 3 | 100 | 8 | 904.1 KB | none |
| podcast-build | 3 | 100 | 8 | 1059.4 KB | none |
| review-module-status | 3 | 100 | 4 | 303.7 KB | none |
| review-unconnected-slot | 3 | 100 | 4 | 315.5 KB | none |
| review-generation | 3 | 100 | 4 | 300.1 KB | none |
| review-store-without-writer | 3 | 100 | 4 | 218.1 KB | none |
| review-unrelated-store | 3 | 50 | 2 | 162.7 KB | still reported |
| review-user-reaches-store | 3 | 100 | 4 | 218.6 KB | none |
| review-long-line | 3 | 100 | 2 | 157.7 KB | none |
| review-line-style | 3 | 100 | 4 | 313.4 KB | none |
| review-out-of-range | 3 | 100 | 4 | 258.3 KB | none |
| review-warning | 3 | 100 | 4 | 317.5 KB | none |

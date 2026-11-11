# Chat design evals (scripted)

Eval 1.0.0; source f27b8a33fa4fc739a4b9d2e98b853b08697bc95e; 2026-11-11T20:10:24.574Z. Limits: 16 responses and 4096 output tokens per response, 300 s per case. Scripted models: they prove the scorers and the loop, not model quality.

## Scores

| Run | Build total | Tiles | Links | Modules | Module links | Templates | Review | Requests | Input | Output | Est. USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| scripted-good | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 39 | 5221.1 KB ≈ 1,336,609–1,782,146 tokens | 15.0 KB ≈ 3,832–5,109 tokens | unknown |
| scripted-patterns | 90.7 | 100 | 93.9 | 96.2 | 96.7 | 66.7 | – | 4 | 637.4 KB ≈ 163,180–217,574 tokens | 1.4 KB ≈ 355–473 tokens | unknown |
| scripted-bad | 1.7 | 2.4 | 6.1 | 0 | 0 | 0 | 5.6 | 12 | 1475.9 KB ≈ 377,834–503,779 tokens | 2.6 KB ≈ 678–904 tokens | unknown |

Build: each area is 100 × credit ÷ the larger of the reference's and the candidate's count; the total is their mean. Review: each case is 50 × named + 50 × fixed; Review is their mean. Input and output are the provider's reported tokens, or, where it reports none, the measured bytes, at about 3 to 4 bytes a token. Est. USD uses a known list price only (RF06's gpt-5.4-mini, checked 2026-11-07); it is an estimate, not billing.

## scripted-good

39 requests, 5221.1 KB sent (4396.1 KB of it the repeated instructions and tools; the largest request 226.6 KB), 15.0 KB received.

| Case | Score | Requests | Sent | Notes |
| --- | ---: | ---: | ---: | --- |
| v3-build | 100 | 5 | 836.3 KB | none |
| review-module-status | 100 | 4 | 516.4 KB | none |
| review-unconnected-slot | 100 | 4 | 531.3 KB | none |
| review-generation | 100 | 4 | 511.5 KB | none |
| review-store-without-writer | 100 | 4 | 482.8 KB | none |
| review-unrelated-store | 100 | 4 | 575.2 KB | none |
| review-user-reaches-store | 100 | 4 | 483.6 KB | none |
| review-long-line | 100 | 2 | 273.0 KB | none |
| review-line-style | 100 | 4 | 528.7 KB | none |
| review-warning | 100 | 4 | 482.3 KB | none |

## scripted-patterns

4 requests, 637.4 KB sent (450.9 KB of it the repeated instructions and tools; the largest request 212.2 KB), 1.4 KB received.

| Case | Score | Requests | Sent | Notes |
| --- | ---: | ---: | ---: | --- |
| v3-build | 90.7 | 4 | 637.4 KB | user → Watch (named Consume); user → Publish (named Produce); upload entry → Sign-in (missing); Watch API / View publisher (kind event-publisher, not custom); Search indexer / Video publication consumer (another name; the only one of its kind); View publisher → Metadata (missing); Upload API.requestTimeoutMs = 5000 (is 1000); Upload API.concurrencyLimit = 500 (is 1000) |

## scripted-bad

12 requests, 1475.9 KB sent (1352.6 KB of it the repeated instructions and tools; the largest request 131.5 KB), 2.6 KB received.

| Case | Score | Requests | Sent | Notes |
| --- | ---: | ---: | ---: | --- |
| v3-build | 1.7 | 3 | 372.7 KB | Watch API (missing); Hot metadata (missing); Metadata (missing); user → Watch (named Consume); user → Publish (named Produce); download entry → Watch API (missing); Watch API / Viewer check (missing); Watch API / Video details cache (missing) |
| review-module-status | 0 | 1 | 121.8 KB | not named; still reported |
| review-unconnected-slot | 0 | 1 | 123.6 KB | not named; still reported |
| review-generation | 0 | 1 | 121.2 KB | not named; still reported |
| review-store-without-writer | 0 | 1 | 117.8 KB | not named; still reported |
| review-unrelated-store | 0 | 1 | 128.4 KB | not named; still reported |
| review-user-reaches-store | 0 | 1 | 118.1 KB | not named; still reported |
| review-long-line | 50 | 1 | 131.5 KB | not named |
| review-line-style | 0 | 1 | 123.1 KB | not named; still reported |
| review-warning | 0 | 1 | 117.6 KB | not named; still reported |

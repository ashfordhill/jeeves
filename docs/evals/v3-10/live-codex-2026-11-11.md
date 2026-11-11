# Live design eval through the Codex login, 2026-11-11

Run by the coordinator, at the owner's request, through the owner's ChatGPT Codex login (no API credits were available).

Command: `env -u OPENAI_API_KEY -u CODEX_API_KEY pnpm eval:chat --suite=design --live --allow-paid-api --models=codex:gpt-5.3-codex,codex:gpt-6.1-sol`. Run at commit 928c6ac (V3-13).

- **gpt-6.1-sol:** build 100, review 94.4 (it named the "unrelated store" defect but did not fix it).
- **gpt-5.3-codex:** produced no result. A ChatGPT account cannot use this model through Codex, so every request was refused before any work was done.
- **An earlier attempt** with `openai:gpt-5.4-mini` against `openai:gpt-5.5` was refused at its first request, because the API account had no credits. No charge was made.

The question this run was meant to answer, whether a cheap model is enough with the new tools, is still open.

The full report follows.

# Chat design evals (live)

Eval 1.0.0; source 928c6ac2d56dfd37928ba4c0986b6f281e98843c; 2026-11-11T23:06:28.651Z. Limits: 16 responses and 4096 output tokens per response, 300 s per case. One sample per case per model: a small suite, with substantial uncertainty.

## Scores

| Run | Build total | Tiles | Links | Modules | Module links | Templates | Review | Requests | Input | Output | Est. USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codex:gpt-5.3-codex | 0 | 0 | 0 | 0 | 0 | 0 | 5.6 | 10 | 1225.2 KB ≈ 313,648–418,197 tokens | 0.0 KB ≈ 0–0 tokens | unknown |
| codex:gpt-6.1-sol | 100 | 100 | 100 | 100 | 100 | 100 | 94.4 | 61 | 2893013 tokens (226688 cached) | 10872 tokens | unknown |

Build: each area is 100 × credit ÷ the larger of the reference's and the candidate's count; the total is their mean. Review: each case is 50 × named + 50 × fixed; Review is their mean. Input and output are the provider's reported tokens, or, where it reports none, the measured bytes, at about 3 to 4 bytes a token. Est. USD uses a known list price only (RF06's gpt-5.4-mini, checked 2026-11-07); it is an estimate, not billing.

## codex:gpt-5.3-codex

10 requests, 1225.2 KB sent (1127.2 KB of it the repeated instructions and tools; the largest request 131.5 KB), 0.0 KB received.

| Case | Score | Requests | Sent | Notes |
| --- | ---: | ---: | ---: | --- |
| v3-build | 0 | 1 | 122.0 KB | error: Codex: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}}; Watch API (missing); Hot metadata (missing); Metadata (missing); user → Watch (missing); user → Publish (missing); download entry → Watch API (missing); Watch API / Viewer check (missing); Watch API / Video details cache (missing) |
| review-module-status | 0 | 1 | 121.8 KB | error: Codex: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}}; not named; still reported |
| review-unconnected-slot | 0 | 1 | 123.6 KB | error: Codex: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}}; not named; still reported |
| review-generation | 0 | 1 | 121.2 KB | error: Codex: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}}; not named; still reported |
| review-store-without-writer | 0 | 1 | 117.8 KB | error: Codex: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}}; not named; still reported |
| review-unrelated-store | 0 | 1 | 128.4 KB | error: Codex: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}}; not named; still reported |
| review-user-reaches-store | 0 | 1 | 118.1 KB | error: Codex: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}}; not named; still reported |
| review-long-line | 50 | 1 | 131.5 KB | error: Codex: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}}; not named |
| review-line-style | 0 | 1 | 123.1 KB | error: Codex: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}}; not named; still reported |
| review-warning | 0 | 1 | 117.6 KB | error: Codex: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}}; not named; still reported |

## codex:gpt-6.1-sol

61 requests, 10804.4 KB sent (6876.0 KB of it the repeated instructions and tools; the largest request 441.9 KB), 43.4 KB received.

| Case | Score | Requests | Sent | Notes |
| --- | ---: | ---: | ---: | --- |
| v3-build | 100 | 12 | 3091.1 KB | none |
| review-module-status | 100 | 5 | 725.7 KB | none |
| review-unconnected-slot | 100 | 5 | 810.9 KB | none |
| review-generation | 100 | 6 | 971.3 KB | none |
| review-store-without-writer | 100 | 4 | 536.9 KB | none |
| review-unrelated-store | 50 | 8 | 1432.6 KB | still reported |
| review-user-reaches-store | 100 | 5 | 679.8 KB | none |
| review-long-line | 100 | 6 | 1070.7 KB | none |
| review-line-style | 100 | 5 | 745.3 KB | none |
| review-warning | 100 | 5 | 740.0 KB | none |

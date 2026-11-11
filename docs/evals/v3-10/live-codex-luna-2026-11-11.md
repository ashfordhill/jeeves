# Live design eval: gpt-6-luna through the Codex login, 2026-11-11

The cheap model, run on the same suite and commit context as `live-codex-2026-11-11.md`. **gpt-6-luna scored build 0, review 50, against gpt-6.1-sol's 100 and 94.4.**

- **The build failed at the tool boundary.** Luna sent malformed command arguments (unknown keys and an invalid command type), and the whole turn failed, so nothing was saved.
- **Review:** three finding classes were found and fixed. Most of the others were named but not fixed, or missed. One case failed the same way as the build.
- **For V3-19:** a cheap model needs smaller, flatter tool schemas, and errors per command that it can correct and retry, not a failed turn. The suite also needs a fair brief and neutral pattern defaults.

The full report follows.

# Chat design evals (live)

Eval 1.0.0; source 4810f101dc733decda975f984369c1b90ef0c77d; 2026-11-11T23:19:56.255Z. Limits: 16 responses and 4096 output tokens per response, 300 s per case. One sample per case per model: a small suite, with substantial uncertainty.

## Scores

| Run | Build total | Tiles | Links | Modules | Module links | Templates | Review | Requests | Input | Output | Est. USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codex:gpt-6-luna | 0 | 0 | 0 | 0 | 0 | 0 | 50 | 45 | 4261900 tokens (2451968 cached) | 15749 tokens | unknown |

Build: each area is 100 × credit ÷ the larger of the reference's and the candidate's count; the total is their mean. Review: each case is 50 × named + 50 × fixed; Review is their mean. Input and output are the provider's reported tokens, or, where it reports none, the measured bytes, at about 3 to 4 bytes a token. Est. USD uses a known list price only (RF06's gpt-5.4-mini, checked 2026-11-07); it is an estimate, not billing.

## codex:gpt-6-luna

45 requests, 7287.5 KB sent (5072.4 KB of it the repeated instructions and tools; the largest request 300.6 KB), 19.0 KB received.

| Case | Score | Requests | Sent | Notes |
| --- | ---: | ---: | ---: | --- |
| v3-build | 0 | 7 | 1447.9 KB | error: The assistant failed: Invalid canonical tool arguments: ✖ Unrecognized keys: "element", "settings"
  → at commands[7]
✖ Unrecognized keys: "element", "settings"
  → at commands[8]
✖ Unrecognized keys: "element", "settings"
  → at commands[9]
✖ Unrecognized keys: "element", "settings"
  → at commands[10]
✖ Value outside enum
  → at commands[7].type
✖ Value outside enum
  → at commands[8].type
✖ Value outside enum
  → at commands[9].type
✖ Value outside enum
  → at commands[10].type; Watch API (missing); Hot metadata (missing); Metadata (missing); user → Watch (missing); user → Publish (missing); download entry → Watch API (missing); Watch API / Viewer check (missing); Watch API / Video details cache (missing) |
| review-module-status | 50 | 4 | 556.7 KB | not named |
| review-unconnected-slot | 50 | 4 | 630.9 KB | still reported |
| review-generation | 0 | 3 | 466.4 KB | not named; still reported |
| review-store-without-writer | 0 | 2 | 238.3 KB | error: The assistant failed: Invalid canonical tool arguments: ✖ Unrecognized keys: "element", "owner"
  → at commands[0]
✖ Value outside enum
  → at commands[0].type; not named; still reported |
| review-unrelated-store | 0 | 6 | 993.6 KB | not named; still reported |
| review-user-reaches-store | 50 | 2 | 259.2 KB | still reported |
| review-long-line | 100 | 6 | 998.4 KB | none |
| review-line-style | 100 | 5 | 800.6 KB | none |
| review-warning | 100 | 6 | 895.5 KB | none |

# V3-10 chat design evals: offline results

2026-11-11, recorded on the V3-10 working tree (parent `f27b8a3`). **Offline only:** scripted
models through the production chat loop, with `fetch` throwing. No live or paid model call was
made; the live comparison waits for the owner's go-ahead. How to run and read them:
[chat evals](../../chat-evals.md#design-evals-v3-10).

- [Scripted report](scripted.json) (rounds, request hashes and sizes, saved designs, scores) and
  its [summary](scripted.md). `pnpm eval:chat --report=$PWD/docs/evals/v3-10/scripted.json`
  replays it offline at this commit; a later change to the prompt, tools or cases drifts it.
- [The v3 brief](../../../jeeves/apps/server/src/eval/fixtures/v3-brief.md), contract §5 in prose;
  the reference is `jeeves/packages/spec/src/fixtures/v3-modules.ts`.

## Scores

The scripted models prove the scorers and the loop discriminate. They are not model-quality
evidence.

| Run | Build total | Tiles | Links | Modules | Module links | Templates | Review |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| good: six patterns, then the brief's fixes | 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| patterns: six patterns with their defaults only | 90.7 | 100 | 93.9 | 96.2 | 96.7 | 66.7 | – |
| bad: a generic video site; "looks fine" | 1.7 | 2.4 | 6.1 | 0 | 0 | 0 | 5.6 |

The patterns run shows what the curated patterns leave against the brief: the actions keep their
default names (Consume, Produce), Sign-in is not a Publish entry, View publisher is an Event
publisher rather than a Custom module reading Metadata, the indexer's consumer has another name,
and the 8 values and Runnable processes are unset. The good run fixes those in one batch.

Review, per case (good / bad):

| Case | Seeded defect | Good | Bad |
| --- | --- | ---: | ---: |
| review-module-status | Favorite videos is a Stub behind an Optional guard | 100 | 0 |
| review-unconnected-slot | Price reader's database slot is empty | 100 | 0 |
| review-generation | Account check's Sign-in pinned to an uninstalled 0.0.1 | 100 | 0 |
| review-store-without-writer | Records has no owner | 100 | 0 |
| review-unrelated-store | Processor writes Outputs and Metadata | 100 | 0 |
| review-user-reaches-store | The action reaches Files directly (stored as a legacy design) | 100 | 0 |
| review-long-line | Upload API's long line to Metadata (advice: change nothing) | 100 | 50 |
| review-line-style | Shop API's database line is dashed (stored as a legacy design) | 100 | 0 |
| review-warning | Upload API has no storage | 100 | 0 |

The bad run's 50 on the long line is the rule working: advice needs no change, but it named
nothing.

## Size and cost of one run

Measured from the offline runs, in the OpenAI Responses wire form (strict tools are 113 KB, the
canonical schemas 86 KB). Tokens are estimated from bytes at 3 to 4 bytes a token; a live report
records the provider's own counts.

| Per model, the 10 cases | Requests | Sent | Input tokens (est.) | Output tokens (est.) |
| --- | ---: | ---: | ---: | ---: |
| Measured: the good scripted run | 39 | 5.2 MB, 84% the repeated instructions and tools | 1.3–1.8 M | 4–5 k |
| Bound: 16 requests a case at the largest request (227 KB) | 160 | 36 MB | 9–12 M | ≤ 655 k (16 × 4,096 a case) |

The build is 5 requests (836 KB) and each review 2–4 (≈ 0.5 MB). A real model usually takes more
rounds than the scripted one (reading the design and catalog, previews, refused calls), so expect
somewhere between the two rows; a comparison of two models doubles it. At RF06's gpt-5.4-mini
list prices (checked 2026-11-07: $0.75 input, $0.075 cached input, $4.50 output per million), the
measured run is about **$1.00–1.35 uncached, or about $0.25–0.35 with the repeated prefix
cached**, plus about $0.02 of output; the bound is about $10–12. These are list-price estimates,
not billing. A stronger model sends about the same tokens at its own price, which this runner
does not know.

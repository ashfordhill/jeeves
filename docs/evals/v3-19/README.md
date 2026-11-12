# V3-19 chat design evals: is a modest model enough?

2026-11-11, at the V3-19 working tree (parent `c790403`). **Live and paid**, approved by the owner
the same day. Design evals **2.0.0** ([how to run and read them](../../chat-evals.md#design-evals-v3-10-v3-19)):
three builds and ten reviews, each run **five times** for the modest models (gpt-6-luna,
claude-haiku-5-5) and **three times** for the strong ones (gpt-6.1-sol, claude-sonnet-5-5), through
the production chat loop.

| Report | Model | Through |
| --- | --- | --- |
| [live-codex-luna](live-codex-luna.md) ([json](live-codex-luna.json.gz)) | gpt-6-luna (modest) | the owner's Codex login (ChatGPT), medium effort |
| [live-codex-sol](live-codex-sol.md) ([json](live-codex-sol.json.gz)) | gpt-6.1-sol (strong) | the same |
| [live-anthropic-haiku](live-anthropic-haiku.md) ([json](live-anthropic-haiku.json.gz)) | claude-haiku-5-5 (modest) | the Messages API, the owner's key from the environment, adaptive thinking at medium effort, prompt caching |
| [live-anthropic-sonnet](live-anthropic-sonnet.md) ([json](live-anthropic-sonnet.json.gz)) | claude-sonnet-5-5 (strong) | the same |
| [live](live.md) | all four side by side (`--merge`) | |
| [scripted](scripted.md) ([json](scripted.json)) | the scripted good, patterns and bad models | offline |

Every report replays offline at this commit, gzipped as it is:
`pnpm eval:chat --report=$PWD/docs/evals/v3-19/<name>.json.gz` (the scripted one is plain `.json`).

## Verdict

**Yes: a modest model is now enough, and Claude Haiku 5.5 is the one to use.** With V3-19's
tools, Haiku builds and reviews almost as well as Sonnet 5.5, never lost a turn in 65, and costs
about a fourteenth as much: roughly **$0.08 for a full run of the 13 cases against $1.09** (list
prices). gpt-6-luna through Codex is now usable (V3-10: 0 and 50), but less reliable: most of its
runs match Sol, and about one in five falls short.

| Model | Samples | Spec build | Video brief | Podcast brief | Review | Turns lost | Requests | Seconds a case | Est. USD, all samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gpt-6-luna | 5 | 98 (91–100) | 81.2 (5.8–100) | 90.5 (79.6–100) | 85 (70–92.5) | 1 of 65 | 323 | 45.4 | unknown (ChatGPT login) |
| gpt-6.1-sol | 3 | 100 | 100 | 90.5 (84.7–100) | 93.3 (92.5–95) | 0 of 39 | 176 | 32.4 | unknown (ChatGPT login) |
| **claude-haiku-5-5** | 5 | **99.8 (99–100)** | **97.8 (94.4–100)** | **94.4** | **98 (95–100)** | 0 of 65 | 288 | 17.0 | **0.40** |
| claude-sonnet-5-5 | 3 | 100 | 100 | 100 | 95 | 0 of 39 | 164 | 12.5 | 3.27 |

Each cell is the mean over the samples, then the lowest and highest sample. Spec build: 0–100 by
name against the v3 reference. Video and podcast briefs: 0–100 by the capability rubric. Review:
each sample's mean over the ten review cases. V3-10, for comparison: Sol 100 and 94.4, Luna 0 and
50, on one sample of the spec build and nine reviews.

| Case | gpt-6-luna | gpt-6.1-sol | claude-haiku-5-5 | claude-sonnet-5-5 |
| --- | ---: | ---: | ---: | ---: |
| v3-build | 98 (91–100) | 100 | 99.8 (99–100) | 100 |
| video-build | 81.2 (5.8–100) | 100 | 97.8 (94.4–100) | 100 |
| podcast-build | 90.5 (79.6–100) | 90.5 (84.7–100) | 94.4 | 100 |
| review-module-status | 95 (75–100) | 100 | 100 | 100 |
| review-unconnected-slot | 70 (50–100) | 100 | 100 | 100 |
| review-generation | 80 (0–100) | 100 | 100 | 100 |
| review-store-without-writer | 90 (50–100) | 100 | 100 | 100 |
| review-unrelated-store | 45 (25–50) | 50 | 80 (50–100) | 50 |
| review-user-reaches-store | 90 (50–100) | 83.3 (75–100) | 100 | 100 |
| review-long-line | 100 | 100 | 100 | 100 |
| review-line-style | 90 (50–100) | 100 | 100 | 100 |
| review-out-of-range | 90 (50–100) | 100 | 100 | 100 |
| review-warning | 100 | 100 | 100 | 100 |

## Where the modest models still fall short

- **Haiku: optional sign-in.** "Anyone can watch without an account, but viewers may sign in"
  needs an Auth guard set to Optional on the read path. Haiku left it out in 7 of 10 product
  builds (every podcast build), and once left the spec's Viewer check Required. Sol and Sonnet
  never missed it. Otherwise Haiku lost points only on `review-unrelated-store` (below).
- **Luna: consistency.** Most of its samples match Sol, but in 65 cases it once ran out of the 16
  responses (a video build: the six patterns in one step, then ten one-command retries the tools
  kept refusing), left 7 review findings it had named unfixed (besides `review-unrelated-store`),
  once asked the person to send it the design instead of calling `getDesign`, and once still said
  the tool wasn't available. It also skipped Optional sign-in in 5 of 10 product builds and the
  CDN in some podcast builds.
- **Both strong models** also drop points on the podcast brief's shape where they choose another
  defensible one (Sol: no CDN, no lifecycle after the processing worker), and on
  `review-unrelated-store`.

## Cost and time

Haiku's 65 cases took 9.3 million input tokens (83% read from the prompt cache) and 256 thousand
output tokens: $0.40 at list prices, about $0.006 a case. Sonnet's 39: 4.8 million and 73
thousand, $3.27, about $0.08 a case. Haiku's largest request was 84 thousand tokens, under its
100-thousand-token rate card. Codex's tokens (Luna 19.7 million in, Sol 5.6 million) include
Codex's own session prompt, and its cost to a ChatGPT login is unknown. Mean wall time a case:
Sonnet 12.5 s, Haiku 17.0 s, Sol 32.4 s, Luna 45.4 s.

## Before the fixes: what the first passes showed

The tools changed twice during this unit, because the first live passes showed where models lost
whole cases. Pass 1, and pass 2's Codex arms, were stopped and are not the results above; their
reports are not kept, but what they showed is:

- **Pass 1** (chat's new commands and neutral defaults only; stopped after 16 Haiku, 26 Sonnet,
  4 Sol and 2 Luna results): Haiku 100 / 100 / 97.2 on the builds and 82.5 on review, Sonnet
  100 / 94.4 / 100 and 87.5. Luna's spec build and video brief, and **Sol's podcast brief**, ended
  at the 16-response limit with nothing saved (0, 5.8 and 5.8). Every one had previewed each step
  and then applied it, been refused one problem per round, or been refused for a link `addTile`
  had already made; one sent a stale `baseRevision` that refused a whole batch. Haiku fixed the
  out-of-range value, then spent the case configuring ownership because the review listed 18
  readiness "errors". Both Anthropic models named the pinned template version but couldn't fix
  it: the review's fix was "change the saved value".
- **Pass 2** (the budget in the prompt and a reminder near the end, up to five refusals per call,
  skips for what is already there, no `baseRevision`, readiness counted rather than listed, a
  reconnect fix for the pinned version): Sonnet's report and Haiku's first three samples are from
  this pass. Luna's spec build went to 99.4 and 51.6, its video brief to 92.4 and 100, Sol's
  podcast brief to 100, 84.7 and 86.8. But in 7 of its 23 results Luna told the person "the
  studio tools aren't available in this session":
  through Codex the tools are described in the prompt and called in a structured answer, and Luna
  looked for them in Codex's own tool list. Sol never did.
- **Pass 3** (the Codex reports, and Haiku's samples 4 and 5): Codex's preamble says the Jeeves
  tools are called through `toolCalls` and are always available that way, a batch over 50
  commands is refused with what to do (it was Zod's bare "Too big", after which Luna's first build
  on the new preamble stopped at 61.3), and the repair-pass refusal says the turn isn't over (Luna
  had read it as the 16-response limit). Luna then said a tool wasn't available once in 65 cases.
  All four reports replay identically at this commit (Luna 65 cases, Haiku 65, Sol 39, Sonnet 39),
  so nothing the earlier samples saw changed.

## Limits of this evidence

- Five samples per case for the modest models and three for the strong ones: enough to separate a
  model that fails whole cases from one that doesn't, not to rank close scores. The spread is the
  lowest and highest sample.
- The capability rubric checks the shape the curated patterns make. A defensible alternative
  (Sol's podcast app with no CDN and the processing worker writing the records itself) loses
  credit for the lifecycle, search and channel checks it skips.
- `review-unrelated-store` expects a fix, but the review marks that finding **check** (advice),
  and the prompt says advice is to confirm. Sonnet always named it and left it with a reason
  ("it would add a tile and change the architecture; say if you want it"), which scores 50. Read
  50 there as a defensible answer; every Anthropic review sample below 100 is this case.
- Codex is a whole agent session per request, with its own prompt around ours; its token counts
  include that, and its cost is unknown (a ChatGPT login). Anthropic cost is a list-price
  estimate from the reported tokens, not billing.
- No owner review of the designs yet: the scores are the rubric's and the reference diff's.

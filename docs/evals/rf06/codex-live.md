# RF06 bounded paired live comparison

Model: `gpt-6.1-sol`; reasoning: medium (existing adapter). Eval 1.0.0; patterns 1.0.0; source f5a9aa15598e4ee3009713f319289771f39b8a43.

Baseline is an RF00 guidance/six-tool/no-review **ablation**, sharing current context, command engine, provider transport and atomic save. Current uses production ChatService. This does not reconstruct full legacy execution or isolate individual improvements.

Same synthetic prompts/seeds and limits: 16 responses, 180s/case. Output cap: unsupported by Codex adapter (4,096 requested but not forwarded). SDK/CLI retry behavior is not controlled by this harness. No tuning or selection by result.

Independent AGENT adjudication credits both arms' disclosed unresolved requirements. See reviewer-notes.md for the owner-change tradeoff and lexical false negatives. Owner/human review is pending; no Mini-model improvement or runtime claim is made.

Candidate rubric flags need [independent adjudication](reviewer-notes.md); the table is not a quality score.

| Case | Arm | Checks | Candidate rubric flags | Refusals / mutation batches after review | Seconds | Input / cached / output | Est. USD |
| --- | --- | --- | --- | --- | --- | --- | --- |
| video-build | rf00-ablation | 5/5 deterministic; prose assessed separately | none detected | 1 / 0 | 75.6 | 79744 / 0 / 2812 | unknown |
| video-build | current | 5/5 deterministic; prose assessed separately | none detected | 0 / 0 | 53.3 | 124357 / 0 / 1781 | unknown |
| video-publication-repair | rf00-ablation | 8/9 deterministic; prose assessed separately | preserve-originals | 0 / 0 | 57.1 | 53726 / 12288 / 1564 | unknown |
| video-publication-repair | current | 9/9 deterministic; prose assessed separately | none detected | 0 / 0 | 43.9 | 125758 / 0 / 1253 | unknown |
| checkout-build | rf00-ablation | 4/4 deterministic; prose assessed separately | none detected | 1 / 0 | 68.0 | 79559 / 0 / 2489 | unknown |
| checkout-build | current | 4/4 deterministic; prose assessed separately | none detected | 2 / 2 | 81.7 | 217697 / 22144 / 3127 | unknown |
| checkout-late-notification-edit | rf00-ablation | 7/7 deterministic; prose assessed separately | none detected | 1 / 0 | 27.2 | 78184 / 12288 / 589 | unknown |
| checkout-late-notification-edit | current | 7/7 deterministic; prose assessed separately | none detected | 1 / 1 | 50.6 | 183904 / 54144 / 1263 | unknown |
| tinyurl-response-cache-repair | rf00-ablation | 8/8 deterministic; prose assessed separately | none detected | 0 / 0 | 19.7 | 53584 / 9856 / 593 | unknown |
| tinyurl-response-cache-repair | current | 8/8 deterministic; prose assessed separately | none detected | 1 / 0 | 52.2 | 199670 / 9856 / 1467 | unknown |
| tinyurl-unsupported-edit | rf00-ablation | 9/9 deterministic; prose assessed separately | none detected | 0 / 0 | 7.8 | 27513 / 0 / 152 | unknown |
| tinyurl-unsupported-edit | current | 9/9 deterministic; prose assessed separately | none detected | 0 / 0 | 17.3 | 57648 / 9856 / 461 | unknown |

Codex monetary cost and reported billing are unknown; API list prices are not applied to the ChatGPT login. Token usage is CLI-reported, including its own prompt overhead. This fallback supplies no Mini-model evidence or strict OpenAI API schema acceptance.

Each arm has one sample per case. This small fixed suite cannot establish a population improvement or runtime correctness. Deterministic checks inspect represented topology/preservation and emitted unresolved obligations. They never credit domain behavior as implemented. A phrase scanner is a review aid only. See reviewer-notes.md for independent AGENT adjudication, alternatives, readability and release blockers. Human/owner review is pending.

## video-build / rf00-ablation

Error: none. Question: none.


## video-build / current

Error: none. Question: none.


## video-publication-repair / rf00-ablation

Error: none. Question: none.

- preserve-originals: Exact element, settings, ownership and hosted module identity/value
- obligation-durable-attempt (needs independent review): No explicit unresolved statement covering pending, failed, attempt
- obligation-duplicate-delivery (needs independent review): No explicit unresolved statement covering duplicate, retries

## video-publication-repair / current

Error: none. Question: none.


## checkout-build / rf00-ablation

Error: none. Question: none.

- obligation-finite-stock (needs independent review): No explicit unresolved statement covering stock, expiry, reservation

## checkout-build / current

Error: none. Question: none.


## checkout-late-notification-edit / rf00-ablation

Error: none. Question: none.


## checkout-late-notification-edit / current

Error: none. Question: none.


## tinyurl-response-cache-repair / rf00-ablation

Error: none. Question: none.

- obligation-redirect-analytics (needs independent review): No explicit unresolved statement covering analytics, redirect
- obligation-freshness-and-access (needs independent review): No explicit unresolved statement covering freshness, cache

## tinyurl-response-cache-repair / current

Error: none. Question: none.


## tinyurl-unsupported-edit / rf00-ablation

Error: none. Question: none.


## tinyurl-unsupported-edit / current

Error: none. Question: none.

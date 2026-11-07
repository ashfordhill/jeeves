# RF06 bounded paired live comparison

Model: `gpt-5.4-mini-2026-03-17`; reasoning: omitted by production adapter; documented default none. Eval 1.0.0; patterns 1.0.0; source f5a9aa15598e4ee3009713f319289771f39b8a43.

Baseline is an RF00 guidance/six-tool/no-review **ablation**, sharing current context, command engine, provider transport and atomic save. Current uses production ChatService. This does not reconstruct full legacy execution or isolate individual improvements.

Same synthetic prompts/seeds and limits: 16 responses, 180s/case. Output cap: 4,096 per response. OpenAI maxRetries: 0. No tuning or selection by result.

All twelve first-response attempts failed before model output: no credits. The initial stop matcher missed this error wording; it was fixed with regression coverage. No further Mini calls were made. Checks were re-scored offline after rubric evidence signals were made needs-review; no API rerun. Original failed attempts, latency, request hashes and untouched designs are retained. This is access evidence only, not quality or schema-acceptance evidence.

Candidate rubric flags need [independent adjudication](reviewer-notes.md); the table is not a quality score.

| Case | Arm | Checks | Candidate rubric flags | Refusals / mutation batches after review | Seconds | Input / cached / output | Est. USD |
| --- | --- | --- | --- | --- | --- | --- | --- |
| video-build | rf00-ablation | not evaluated | access blocked | 0 / 0 | 2.0 | unknown (failed request) | unknown |
| video-build | current | not evaluated | access blocked | 0 / 0 | 1.1 | unknown (failed request) | unknown |
| video-publication-repair | rf00-ablation | not evaluated | access blocked | 0 / 0 | 1.1 | unknown (failed request) | unknown |
| video-publication-repair | current | not evaluated | access blocked | 0 / 0 | 1.3 | unknown (failed request) | unknown |
| checkout-build | rf00-ablation | not evaluated | access blocked | 0 / 0 | 0.9 | unknown (failed request) | unknown |
| checkout-build | current | not evaluated | access blocked | 0 / 0 | 1.7 | unknown (failed request) | unknown |
| checkout-late-notification-edit | rf00-ablation | not evaluated | access blocked | 0 / 0 | 1.0 | unknown (failed request) | unknown |
| checkout-late-notification-edit | current | not evaluated | access blocked | 0 / 0 | 0.9 | unknown (failed request) | unknown |
| tinyurl-response-cache-repair | rf00-ablation | not evaluated | access blocked | 0 / 0 | 1.1 | unknown (failed request) | unknown |
| tinyurl-response-cache-repair | current | not evaluated | access blocked | 0 / 0 | 0.8 | unknown (failed request) | unknown |
| tinyurl-unsupported-edit | rf00-ablation | not evaluated | access blocked | 0 / 0 | 0.9 | unknown (failed request) | unknown |
| tinyurl-unsupported-edit | current | not evaluated | access blocked | 0 / 0 | 1.3 | unknown (failed request) | unknown |

All USD values are list-price **estimates**, not reported billing; reported billing is unknown. Failed requests may incur unknown usage. Source: [official model pricing](https://developers.openai.com/api/docs/models/gpt-5.4-mini), checked 2026-11-07: input $0.75, cached $0.075, output $4.50 per million tokens.

Each arm has one sample per case. This small fixed suite cannot establish a population improvement or runtime correctness. Deterministic checks inspect represented topology/preservation and emitted unresolved obligations. They never credit domain behavior as implemented. A phrase scanner is a review aid only. See reviewer-notes.md for independent AGENT adjudication, alternatives, readability and release blockers. Human/owner review is pending.

## video-build / rf00-ablation

Error: You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.. Question: none.

No model response; design quality not evaluated.

## video-build / current

Error: You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.. Question: none.

No model response; design quality not evaluated.

## video-publication-repair / rf00-ablation

Error: You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.. Question: none.

No model response; design quality not evaluated.

## video-publication-repair / current

Error: You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.. Question: none.

No model response; design quality not evaluated.

## checkout-build / rf00-ablation

Error: You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.. Question: none.

No model response; design quality not evaluated.

## checkout-build / current

Error: You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.. Question: none.

No model response; design quality not evaluated.

## checkout-late-notification-edit / rf00-ablation

Error: You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.. Question: none.

No model response; design quality not evaluated.

## checkout-late-notification-edit / current

Error: You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.. Question: none.

No model response; design quality not evaluated.

## tinyurl-response-cache-repair / rf00-ablation

Error: You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.. Question: none.

No model response; design quality not evaluated.

## tinyurl-response-cache-repair / current

Error: You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.. Question: none.

No model response; design quality not evaluated.

## tinyurl-unsupported-edit / rf00-ablation

Error: You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.. Question: none.

No model response; design quality not evaluated.

## tinyurl-unsupported-edit / current

Error: You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.. Question: none.

No model response; design quality not evaluated.

# Generator coordinator launch prompt

Paste the following into a fresh agent in `/home/ash/github/jeeves`.

```text
Coordinate and finish the three Jeeves generator changes in docs/plans/qrwty-v2-generator/units.md. You may dispatch fresh subagents for this assignment. You own the result through implementation, independent review, necessary repairs and the final handoff.

Read AGENTS.md, the latest docs/handoff.md entry and the plan. Work on main in the primary checkout. Use the committed revision-4 diagram as the reviewed input. Preserve unrelated work and later edits in the owner’s live project. Start the template-development usage ledger before dispatching anyone.

Assign one implementation unit at a time to a fresh subagent in the order Auth0, native Stripe webhooks, then click retention. Give each worker its unit, prerequisites, working directory, evidence requirements and acceptance tests. Have it implement and verify the actual generated behavior, run the repository checks, append its handoff and make one scoped local commit. Review its diff, test results and export before advancing. Keep one writer in the checkout. If a scoped repair is needed, dispatch it and verify the fix.

Assign the combined export to a fresh reviewer. Have them exercise the new options by mouse in a copy of the reviewed project, compare the Studio and CLI exports, build the result and verify the multi-copy, retry and retention outcomes in the plan. Use isolated test data and designated provider test accounts. If credentials for a provider check are missing, finish everything independent of it and report exactly which check still needs access. Keep credentials out of artifacts.

Return the generator commit, derived project and revision, editable design and export hashes, commands and results, usage coverage and any open findings. Stop at the generator handoff. The QRWTY v2 field build has its own plan.
```

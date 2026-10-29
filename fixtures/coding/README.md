# Coding-agent fixtures

`e2e-script.json` is the scripted fake coding agent used by the Playwright suite.
`playwright.config.ts` points the server at it with `JEEVES_FAKE_CODING_SCRIPT`, and sets
`JEEVES_FAKE_CHECKS` so Jeeves's checks after each task are the quick marker checks instead of
Docker and the template test packs.

The format is `codingScriptByTask` from `@jeeves/providers`: one entry per task key (`links`,
`links.links-api`, …) with one step per attempt (the last repeats). Every orchestrator prompt
starts with `Jeeves task: <key>, attempt <n>`, which is how the script picks a step.

Each step here writes its prompt into a feature file (`writePrompt`). The marker checks fail when
a changed file contains `JEEVES_FAKE_CHECK_FAIL`, so an e2e test makes a task fail by putting
that text in the task's description. A retry's prompt is the check output, not the brief, so the
next attempt passes.

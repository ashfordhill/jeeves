# GS01 repository verification

No existing test assertion, retry setting, timeout or generated template was changed.

| Check | Observed result |
| --- | --- |
| Initial `pnpm check` | 820 tests / 105 files passed; lint and typechecks passed. `/tmp/gs01-check-initial.log` |
| Repeated check overlapping image build and E2E | 819 passed, one existing `updateDirectory` test exceeded its unchanged 5,000 ms deadline (6,560 ms observed). `/tmp/gs01-check-final.log` |
| Isolated unchanged update test | Passed, 3.71 s overall; the name filter excluded the other 39 cases. `/tmp/gs01-update-isolated.log` |
| Quiet full `pnpm check` | 820 tests / 105 files passed, 52.04 s. `/tmp/gs01-check-quiet.log` |
| Initial E2E overlapping generated Compose runs | 72 passed / one failed, 5.5 min. The Settings test's page was blank: five Vite module fetches returned Chromium `net::ERR_NETWORK_CHANGED`, including React DOM, ViewTabs and useHashView. No Settings assertion beyond locating the tab was reached. `/tmp/gs01-e2e.log` |
| Isolated unchanged Settings E2E | Passed, 4.5 s overall. `/tmp/gs01-e2e-settings-isolated.log` |

The initial E2E trace, screenshot and error context were preserved under
`/tmp/gs01-e2e-initial-artifacts/`. Docker network topology changes were happening concurrently
with the failed module requests. Run generated suites and browser checks in separate phases;
also avoid overlapping image builds with the offline suite's existing tight test deadlines.
This removes the observed interference without changing test behavior or adding retries.

The quiet full E2E rerun passed **73/73 in 4.6 min**, including both complete mouse rebuilds
and the TinyURL lane canvas (`/tmp/gs01-e2e-quiet.log`). The web production build then passed
(`/tmp/gs01-web-build.log`). No studio UI behavior changed in GS01.

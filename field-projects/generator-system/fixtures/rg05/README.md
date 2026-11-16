# RG05 callable fixture

`design.ts` extends the existing Favorites fixture with one Custom operation's `call` link.
It introduces no process, provider or transport. `favorite-summary.ts` is application-owned code
copied into a fresh export at `src/modules/account-api/favorite-summary.ts`; `contracts.ts` goes
to `src/contracts/index.ts`. Its imports resolve against the generated public API and slots.

The generator tests execute the emitted dependency assignment and this operation without HTTP.
PGlite exercises the same Favorites core through direct/HTTP adapters. Scratch compilation checks
the real emitted types, rejects an invalid item ID and rejects mutation of readonly results.

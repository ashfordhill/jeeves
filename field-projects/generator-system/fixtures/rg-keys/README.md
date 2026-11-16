# RG08 private ring fixture

`design.ts` generates one HTTP process with two Custom operations and a cache dependency.
Copy the handwritten `cursor.ts` and `receipt.ts` into `src/modules/items-api/` in a fresh
scratch export. Both declare `VALUE_KEYS`, read from one process-private file, for different
purposes and modes. No ring or secret bytes enter the public API. Tests supply synthetic keys;
there is no committed credential file. This is mechanism evidence, not a session/replay feature.

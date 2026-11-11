# YouTube v3: custom paths in `app/`

`app/` started as a byte-for-byte copy of `generated/` in the commit `V3-12: v3 generated output`
([contract](../../../../docs/plans/youtube-v3/contract.md) §6). This table has one row for each
path that a later unit adds to or changes in `app/`. It says the area, the unit that made the
change, and what was written and why.

- **Areas:** hook, stub body, product SQL, UI or integration.
- **Not listed:** `generated/` (it is never edited), and the build and runtime output that
  `.gitignore` keeps out of Git (`node_modules`, `dist`, `dist-public` and `.runtime`).
- **Check (V3-17):** the rows must match `diff -rq generated app` with those four left out.

Nothing has been added or changed yet, so the table is empty.

| Path in `app/` | Area | Unit | What and why |
| --- | --- | --- | --- |

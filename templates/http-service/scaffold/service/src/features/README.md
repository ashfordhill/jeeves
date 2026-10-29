# Features of {{serviceName}}

Each folder here is one feature: `<name>/index.ts` default-exports `defineFeature({ ... })` from
`@jeeves/service-runtime`. The service loads every folder at startup, in name order. Folders
starting with `_` (for example `_shared/`) are skipped, so put shared helpers there.

```ts
import { defineFeature, z } from "@jeeves/service-runtime";

export default defineFeature({
  name: "greetings",
  env: { GREETING: z.string().default("hello") },
  register(app, ctx) {
    app.get("/greetings", async () => ({ message: ctx.env.GREETING }));
  },
});
```

See `jeeves/elements/{{serviceId}}.md` for the full guide.

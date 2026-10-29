# Tests for Links service

Project-owned tests go here and run with `pnpm test` (Vitest). Build the service in-process
and call it without opening a port:

```ts
import { createService } from "@jeeves/service-runtime";
import { expect, it } from "vitest";
import greetings from "../src/features/greetings/index.ts";
import { service } from "../src/jeeves.generated.ts";

it("greets", async () => {
  const built = await createService(service, { env: {}, features: [greetings], logger: false });
  const response = await built.app.inject("/greetings");
  expect(response.json()).toEqual({ message: "hello" });
  await built.stop();
});
```

A service with a database needs `DATABASE_URL` in `env` and a running database (for example
`docker compose up -d --wait <database>`).

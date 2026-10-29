// A service entry point like the scaffold's src/main.ts, for process-level tests.
import { defineService, startService } from "../src/index.ts";

await startService(defineService({ name: "fixture", displayName: "Fixture service" }), {
  features: new URL("./features/", import.meta.url),
});

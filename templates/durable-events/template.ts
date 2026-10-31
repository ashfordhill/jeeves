import { fileURLToPath } from "node:url";
import type { TemplateModule } from "@jeeves/template-kit";
import { generate } from "./generate.ts";
import manifest from "./manifest.ts";
import { testPack } from "./test-pack.ts";
export const durableEventsTemplate: TemplateModule = {
  manifest,
  generate,
  testPack,
  agentGuide:
    "Durable delivery, policy and contracts are generated. Implement only src/event-handlers/<event-id>.ts and supplemental tests. Use context.effect for database effects; use stable context.id for destination idempotency. Producer authorization and business-command idempotency remain project responsibilities. A producer uses delivery.transaction(tenant, tx => tx.emit(eventId, key, typedPayload)). Never edit delivery/, event-migrations/ or vendor/. Standard readiness is not business acceptance. Fixed event acceptance must pass.",
  runtime: {
    name: "@jeeves/durable-events",
    version: "0.1.0",
    dir: fileURLToPath(new URL("../../packages/durable-events", import.meta.url)),
    artifact: {
      path: fileURLToPath(
        new URL(
          "../../artifacts/durable-events/0.1.0/jeeves-durable-events-0.1.0.tgz",
          import.meta.url,
        ),
      ),
      sha256: "b0658fce9fbb692e317c54ded4c9b4fff3d4eb3c66b5d4b550947f67f60776fd",
    },
  },
};

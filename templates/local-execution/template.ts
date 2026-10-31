import type { TemplateModule } from "@jeeves/template-kit";
import { generate } from "./generate.ts";
import manifest from "./manifest.ts";
import { testPack } from "./test-pack.ts";
export const localExecutionTemplate: TemplateModule = {
  manifest,
  generate,
  testPack,
  agentGuide:
    "Local process limits, failure restart and shutdown configuration are generated. They need no application implementation. Do not edit execution-policy.generated.json or docker-compose.yml. Change the design's finite policy preset and regenerate. Restart is triggered by process failure, not by an unhealthy probe. This policy supplies neither replicas nor deployment failover.",
};

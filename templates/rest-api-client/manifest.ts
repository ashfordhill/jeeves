import { defineTemplate } from "@jeeves/spec";
import { z } from "zod";

export default defineTemplate({
  id: "rest-api-client",
  version: "0.1.0",
  kind: "attachment",
  displayName: "REST API client",
  description: "Typed client for another service's REST API, generated from its OpenAPI contract.",
  config: z.object({
    timeoutMs: z.int().min(100).max(120_000).default(5000).meta({ title: "Timeout (ms)" }),
    retries: z.int().min(0).max(5).default(0).meta({ title: "Retries" }),
  }),
  ports: [
    {
      kind: "calls",
      direction: "out",
      label: "Target API",
      required: true,
      multiple: false,
      accepts: { templates: ["rest-api-server"] },
    },
  ],
  card: { icon: "plug-connected", chips: ["timeoutMs"] },
});

import { defineTemplate, resourceConfigSchema } from "@jeeves/spec";
import { z } from "zod";

export default defineTemplate({
  id: "rest-api-server",
  version: "0.1.0",
  kind: "attachment",
  displayName: "REST API server",
  description:
    "Contract-first REST API: an OpenAPI file, request and response validation, and /openapi.json.",
  config: z.object({
    model: resourceConfigSchema.optional().meta({
      title: "Resource model",
      description:
        "Structured resources, selected database connection and fixed extension contracts",
    }),
    basePath: z
      .string()
      .regex(/^\/[a-z0-9\-/]*$/, "Start with / and use lowercase letters, digits, - and /")
      .default("/api")
      .meta({ title: "Base path" }),
    auth: z.enum(["none", "bearer", "session"]).default("none").meta({
      title: "Auth",
      description: "bearer is a placeholder until an auth template exists.",
    }),
  }),
  ports: [
    {
      kind: "calls",
      direction: "in",
      label: "API",
      accepts: { templates: ["rest-api-client"] },
    },
  ],
  card: { icon: "api", chips: ["basePath"] },
});

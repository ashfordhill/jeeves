import { defineTemplate } from "@jeeves/spec";
import { z } from "zod";

export default defineTemplate({
  id: "http-service",
  version: "0.1.0",
  kind: "element",
  elementKind: "service",
  displayName: "HTTP service",
  description:
    "TypeScript HTTP microservice on Fastify with health, readiness, and a feature plugin API.",
  config: z.object({
    port: z.int().min(1).max(65535).default(8080).meta({ title: "Port" }),
    replicas: z.int().min(1).max(10).default(1).meta({
      title: "Replicas",
      description: "Local Docker only runs one unless scaled manually.",
    }),
    logLevel: z
      .enum(["debug", "info", "warn", "error"])
      .default("info")
      .meta({ title: "Log level" }),
  }),
  ports: [
    {
      kind: "uses-database",
      direction: "out",
      label: "Database",
      accepts: { elementKinds: ["database"] },
    },
    { kind: "depends-on", direction: "out", label: "Depends on" },
    { kind: "depends-on", direction: "in", label: "Dependents" },
  ],
  attachmentSlots: [{ template: "rest-api-server", max: 1 }, { template: "rest-api-client" }],
  card: { icon: "server", chips: ["port"] },
});

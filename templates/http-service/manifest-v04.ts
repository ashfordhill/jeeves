import { defineTemplate } from "@jeeves/spec";
import { z } from "zod";
import previous from "./manifest-v03.ts";
export default defineTemplate({
  ...previous,
  version: "0.4.0",
  config: z.object({
    port: z.int().min(1).max(65535).default(8080).meta({ title: "Port" }),
    replicas: z.int().min(1).max(10).default(1).meta({
      title: "Legacy replica hint",
      description:
        "Retained for compatibility. Add a local HTTP pool policy to generate multiple instances; keep this hint at one.",
    }),
    logLevel: z
      .enum(["debug", "info", "warn", "error"])
      .default("info")
      .meta({ title: "Log level" }),
  }),
  attachmentSlots: [...previous.attachmentSlots, { template: "local-http-pool", max: 1 }],
});

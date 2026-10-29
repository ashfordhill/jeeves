import { defineTemplate } from "@jeeves/spec";
import { z } from "zod";

// Logical databases aren't config: they're derived from incoming uses-database connections, one
// database and role per consuming service.
export default defineTemplate({
  id: "postgres",
  version: "0.1.0",
  kind: "element",
  elementKind: "database",
  displayName: "PostgreSQL",
  description: "PostgreSQL instance; each consuming service gets its own database and role.",
  config: z.object({
    version: z.enum(["17"]).default("17").meta({ title: "PostgreSQL version" }),
  }),
  ports: [
    {
      kind: "uses-database",
      direction: "in",
      label: "Consumers",
      accepts: { elementKinds: ["service", "worker"] },
    },
  ],
  card: { icon: "database", chips: ["version"] },
});

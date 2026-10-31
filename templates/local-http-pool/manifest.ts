import { defineTemplate, localHttpPoolConfigSchema } from "@jeeves/spec";
export default defineTemplate({
  id: "local-http-pool",
  version: "0.1.0",
  kind: "attachment",
  displayName: "Local HTTP pool",
  description:
    "Two or three local instances of one generated resource API, with shared Postgres and bounded readiness routing. Requires reviewed generated source and an execution policy; no host failover.",
  config: localHttpPoolConfigSchema,
  ports: [],
  card: { icon: "server", chips: ["replicas"] },
  presets: [
    { id: "pair", name: "Pair", config: { replicas: 2 } },
    { id: "trio", name: "Trio", config: { replicas: 3 } },
  ],
});

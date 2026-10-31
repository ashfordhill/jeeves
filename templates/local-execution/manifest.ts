import { defineTemplate, localExecutionConfigSchema } from "@jeeves/spec";
export default defineTemplate({
  id: "local-execution",
  version: "0.1.0",
  kind: "attachment",
  displayName: "Local execution policy",
  description:
    "Finite local CPU, memory and process limits with failure restart and shutdown grace. One service instance; no autoscaling or failover.",
  config: localExecutionConfigSchema,
  ports: [],
  card: { icon: "settings", chips: ["preset"] },
  presets: [
    { id: "compact", name: "Compact", config: { preset: "compact" } },
    { id: "balanced", name: "Balanced", config: { preset: "balanced" } },
    { id: "expanded", name: "Expanded", config: { preset: "expanded" } },
  ],
});

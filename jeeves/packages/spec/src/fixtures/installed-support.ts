/**
 * An installed registry for spec tests: every template with a consumer for its binding, each of
 * its policies and each of its settings, and Runnable processes, as the executing registry lists
 * them. The server's tests use the real registry.
 */
import { generationRuntime, generationTemplates } from "../generation-catalog.ts";
import { type GenerationInstalledSupport, generationCapabilities } from "../generation-support.ts";

export const testInstalledSupport: GenerationInstalledSupport = {
  runtime: generationRuntime.ref,
  templates: Object.entries(generationTemplates).map(([kind, template]) => ({
    ref: template.ref,
    consumers: [
      { input: "binding", consumer: kind, outputPaths: ["src/a.ts"] },
      ...template.definition.policies.map((policy) => ({
        input: `policy.${policy.id}`,
        consumer: kind,
        outputPaths: ["src/a.ts"],
      })),
      ...generationCapabilities[kind as keyof typeof generationCapabilities].settings.map(
        (rule) => ({ input: rule.input, consumer: rule.consumer, outputPaths: ["src/a.ts"] }),
      ),
    ],
  })),
  processes: true,
};

/** Local execution policy 0.1.0. Change preset semantics only under a new policy version. */
import { z } from "zod";
import type { Element } from "./design.ts";
export const localExecutionConfigSchema = z.strictObject({
  preset: z.enum(["compact", "balanced", "expanded"]).default("balanced"),
});
export type LocalExecutionPreset = z.infer<typeof localExecutionConfigSchema>["preset"];
export const localExecutionPresets = {
  compact: {
    cpus: 0.5,
    memoryMiB: 512,
    pids: 128,
    restartAttempts: 3,
    shutdownMs: 15000,
    graceSeconds: 20,
  },
  balanced: {
    cpus: 1,
    memoryMiB: 768,
    pids: 192,
    restartAttempts: 5,
    shutdownMs: 20000,
    graceSeconds: 25,
  },
  expanded: {
    cpus: 2,
    memoryMiB: 1536,
    pids: 256,
    restartAttempts: 5,
    shutdownMs: 30000,
    graceSeconds: 35,
  },
} as const;
export function localExecutionPolicy(preset: LocalExecutionPreset) {
  return {
    version: "0.1.0" as const,
    preset,
    ...localExecutionPresets[preset],
    init: true as const,
    restart: `on-failure:${localExecutionPresets[preset].restartAttempts}`,
  };
}
export type LocalExecutionPolicy = ReturnType<typeof localExecutionPolicy>;
export function localExecutionFor(
  element: Element,
): (LocalExecutionPolicy & { attachment: string }) | undefined {
  const attachment = element.attachments.find(
    (item) => item.template.id === "local-execution" && item.template.version === "0.1.0",
  );
  const parsed = attachment && localExecutionConfigSchema.safeParse(attachment.config);
  return attachment && parsed?.success
    ? { attachment: attachment.id, ...localExecutionPolicy(parsed.data.preset) }
    : undefined;
}

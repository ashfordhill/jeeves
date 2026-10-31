import type { GenerateContext, GenerateResult } from "@jeeves/template-kit";
import { generate } from "./generate.ts";
/** Only 0.3 delegates these three fields to an explicitly attached execution policy. */
export function generateV03(ctx: GenerateContext): GenerateResult {
  const result = generate(ctx);
  if (ctx.attachments.some((attachment) => attachment.manifest.id === "local-execution")) {
    const service = result.compose?.services?.[ctx.element.id];
    if (!service) throw new Error("HTTP service output is missing");
    delete service.restart;
    delete service.stop_grace_period;
    if (service.environment) delete service.environment.SHUTDOWN_TIMEOUT_MS;
  }
  return result;
}

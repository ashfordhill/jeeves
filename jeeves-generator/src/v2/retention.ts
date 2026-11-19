import type { NormalizedGenerationSelection } from "@jeeves/spec";

const daySeconds = 86_400;

export function receiptPolicy(selection: NormalizedGenerationSelection) {
  const replayDays = selection.inputs["consumer.replayDays"];
  const receiptDays = selection.inputs["consumer.receiptDays"];
  if (typeof replayDays !== "number" || typeof receiptDays !== "number") return;
  return {
    deliveryHorizonSeconds: replayDays * daySeconds,
    retentionSeconds: receiptDays * daySeconds,
  };
}

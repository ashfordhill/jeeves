// @jeeves-extension: operation
import { defineReceiptConsumer, type ModuleMessage } from "../../extension-api/index.ts";
import type { Dependencies } from "./aggregate-click.slots.ts";

export const receiptConsumer = defineReceiptConsumer<Dependencies>({
  database: "analytics",
  map(event, id, policy) {
    const value = event as {
      day: unknown;
      agent: unknown;
      verifiedAgeSeconds?: number;
      rejectBreakdown?: boolean;
    };
    if (
      typeof value?.day !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value.day) ||
      typeof value.agent !== "string" ||
      (value.verifiedAgeSeconds ?? 0) > policy.deliveryHorizonSeconds
    )
      throw Error("Invalid or out-of-horizon fixture click");
    return {
      id,
      payload: { day: value.day, agent: value.agent, rejectBreakdown: !!value.rejectBreakdown },
    };
  },
  async complete(event, commands) {
    const { day, agent, rejectBreakdown } = event.payload as {
      day: string;
      agent: string;
      rejectBreakdown: boolean;
    };
    await commands.call("increment_day", [day]);
    await commands.call("increment_breakdown", [day, rejectBreakdown ? "" : agent]);
  },
});

export async function aggregateClick(
  _dependencies: Dependencies,
  _message: ModuleMessage,
): Promise<void> {
  throw Error("Not implemented: checked receipt path required");
}

// @jeeves-extension: operation
import { defineDurableWork } from "../../extension-api/index.ts";
import type { Dependencies } from "./retention-sweep.slots.ts";

type Tick = {
  tick: string;
  intervalSeconds: number;
  cutoffDay: string;
  keepDailyTotalsMonths: number;
};

export const durableWork = defineDurableWork<Tick, Dependencies>({
  database: "analytics",
  id: "retention-sweep",
  version: 1,
  retentionSeconds: 604800,
  maxAttempts: 4,
  integration: null,
  validate(input) {
    const value = input as Tick;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value.cutoffDay) ||
      !Number.isInteger(value.keepDailyTotalsMonths)
    )
      throw Error("Missing calendar retention");
    return {
      tick: value.tick,
      intervalSeconds: value.intervalSeconds,
      cutoffDay: value.cutoffDay,
      keepDailyTotalsMonths: value.keepDailyTotalsMonths,
    };
  },
  async complete(value, commands) {
    await commands.call("delete_days", [value.cutoffDay]);
    await commands.call("delete_breakdowns", [value.cutoffDay]);
    await commands.call("record_sweep", [
      value.tick,
      value.intervalSeconds,
      value.keepDailyTotalsMonths,
      value.cutoffDay,
    ]);
  },
});

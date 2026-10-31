import { defineTemplate } from "@jeeves/spec";
import previous from "./manifest.ts";

export default defineTemplate({
  ...previous,
  version: "0.2.0",
  attachmentSlots: [...previous.attachmentSlots, { template: "durable-events", max: 1 }],
});

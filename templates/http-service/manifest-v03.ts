import { defineTemplate } from "@jeeves/spec";
import previous from "./manifest-v02.ts";
export default defineTemplate({
  ...previous,
  version: "0.3.0",
  attachmentSlots: [...previous.attachmentSlots, { template: "local-execution", max: 1 }],
});

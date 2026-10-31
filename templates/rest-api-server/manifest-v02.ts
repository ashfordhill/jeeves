import { defineTemplate } from "@jeeves/spec";
import previous from "./manifest.ts";

export default defineTemplate({
  ...previous,
  version: "0.2.0",
  description:
    "Contract-first REST API with independent sessions per deployment public origin. Adoption requires signing in again with the existing account.",
});

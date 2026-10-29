import { defineFeature } from "../../../src/index.ts";
import { greeting } from "../_shared/greeting.ts";

export default defineFeature({
  name: "alpha",
  register(app) {
    app.get("/alpha", async () => ({ message: greeting("alpha") }));
  },
});

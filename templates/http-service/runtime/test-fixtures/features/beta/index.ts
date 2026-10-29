import { defineFeature, z } from "../../../src/index.ts";

export default defineFeature({
  name: "beta",
  env: { BETA_LIMIT: z.coerce.number().int().default(3) },
  register(app, ctx) {
    app.get("/beta", async () => ({ limit: ctx.env.BETA_LIMIT }));
  },
});

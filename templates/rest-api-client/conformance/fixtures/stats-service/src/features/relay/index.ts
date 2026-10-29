import { defineFeature } from "@jeeves/service-runtime";
import { linksClient } from "../../clients/links.generated.ts";

/** GET /relay: asks the links service which request ID it saw. */
export default defineFeature({
  name: "relay",
  register(app) {
    app.get("/relay", async () => {
      const { data } = await linksClient.GET("/request-id");
      if (!data) throw new Error("The links service didn't answer /request-id");
      return { seenByLinks: data.requestId };
    });
  },
});

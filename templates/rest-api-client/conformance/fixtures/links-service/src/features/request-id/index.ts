import { defineFeature } from "@jeeves/service-runtime";

export default defineFeature({
  name: "request-id",
  operations: {
    requestId: ({ request }) => ({ status: 200, body: { requestId: request.id } }),
  },
});

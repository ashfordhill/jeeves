// The ping operation from the {{serviceName}} API contract. Project-owned: an example to copy
// for real operations, or delete together with /ping in the contract.
import { defineFeature } from "@jeeves/service-runtime";

export default defineFeature({
  name: "ping",
  operations: {
    ping: ({ query }) => ({
      status: 200,
      body: { message: typeof query.message === "string" ? query.message : "pong" },
    }),
  },
});

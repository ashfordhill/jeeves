import { httpShell } from "../lib/http.ts";
await httpShell("search", {
  "concurrencyLimit": 1000,
  "requestTimeoutMs": 1000
});

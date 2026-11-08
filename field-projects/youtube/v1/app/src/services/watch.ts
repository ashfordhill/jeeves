import { httpShell } from "../lib/http.ts";
await httpShell("watch", {
  "concurrencyLimit": 2000,
  "requestTimeoutMs": 1000
});

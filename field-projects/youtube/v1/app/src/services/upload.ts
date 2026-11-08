import { httpShell } from "../lib/http.ts";
await httpShell("upload", {
  "concurrencyLimit": 500,
  "requestTimeoutMs": 5000
});

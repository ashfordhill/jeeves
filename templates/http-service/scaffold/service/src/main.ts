// Entry point for {{serviceName}}. Project-owned, but rarely worth changing: add behavior as
// features in src/features/<name>/index.ts, which are loaded automatically in name order.
// The wiring (dependencies, attachments) is in jeeves.generated.ts, generated from the design.
import { startService } from "@jeeves/service-runtime";
import { service } from "./jeeves.generated.ts";

await startService(service, { features: new URL("./features/", import.meta.url) });

import { defineFeature } from "@jeeves/service-runtime";

// Acceptance: QR-10, QR-12, QR-13, QR-14
// Read only the session owner QR. Return newest saved revisions, sorted by savedAt and id descending, at most 25 rows. Cursor must belong to this QR; reject another QR cursor without exposing it. Canonical URL is the earliest saved revision URL, or publicOrigin() plus /q/ plus the QR id before its first save. Never derive the canonical URL from destination or request headers.
// Implement operationId readQrStudio here; the runtime reports 501 until it is registered.
import { readQrStudio } from "../_shared/artwork.ts";
export default defineFeature({ name: "studio", operations: { readQrStudio } });

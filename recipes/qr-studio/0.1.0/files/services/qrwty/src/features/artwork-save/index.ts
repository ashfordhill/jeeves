import { defineFeature } from "@jeeves/service-runtime";

// Acceptance: QR-10, QR-12, QR-13, QR-14
// Authorize the owned QR in a database transaction. Strictly normalize settings; use requestId as revision UUID. Render PNG and SVG with the pinned 0.1.0 renderer; store their hashes, canonical URL and configuration. Same requestId for the same owned QR and normalized configuration returns its original revision. Conflicting reuse returns generic 409; do not disclose another owner. No update/delete operation. Preserve the first revision canonical URL for subsequent revisions; retain old renderer versions when upgrading.
// Implement operationId saveQrArtwork here; the runtime reports 501 until it is registered.
import { saveQrArtwork } from "../_shared/artwork.ts";
export default defineFeature({ name: "artwork-save", operations: { saveQrArtwork } });

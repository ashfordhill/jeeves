import { defineFeature } from "@jeeves/service-runtime";

// Acceptance: QR-11, QR-12, QR-14
// Authorize the owner before rendering. Strictly parse settings with @jeeves/qr-artwork@0.1.0, select the server-established canonical URL and render PNG. Return the exact bytes in a bounded base64 artifact envelope with hash and check evidence. Preview creates no revision. No uploads, browser QR rendering or client-selected identity/origin/renderer.
// Implement operationId previewQrArtwork here; the runtime reports 501 until it is registered.
import { previewQrArtwork } from "../_shared/artwork.ts";
export default defineFeature({ name: "artwork-preview", operations: { previewQrArtwork } });

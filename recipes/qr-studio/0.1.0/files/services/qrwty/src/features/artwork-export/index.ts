import { defineFeature } from "@jeeves/service-runtime";

// Acceptance: QR-11, QR-12, QR-13, QR-14
// Scope both QR and revision to the session owner. Render only the saved canonical URL, settings and pinned renderer version; verify against the saved SHA-256 before returning base64 bytes. Fail if the renderer/version/hash cannot be honored. Export never changes the revision, destination or legacy /image endpoint. The frontend downloads exactly these bytes and media type; it does not reconstruct geometry.
// Implement operationId exportQrArtwork here; the runtime reports 501 until it is registered.
import { exportQrArtwork } from "../_shared/artwork.ts";
export default defineFeature({ name: "artwork-export", operations: { exportQrArtwork } });

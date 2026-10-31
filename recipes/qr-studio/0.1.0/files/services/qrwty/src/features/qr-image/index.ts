import { publicOrigin, sessionPrincipal } from "@jeeves/rest-server";
import { defineFeature } from "@jeeves/service-runtime";
import QRCode from "qrcode";
import qr from "../../generated/resources/qr.ts";
import { database } from "../../jeeves.generated.ts";

// Acceptance: QR-02, QR-06
export default defineFeature({
  name: "qr-image",
  operations: {
    downloadQr: async (request) => {
      const principal = sessionPrincipal(request.request);
      if (!principal) {
        return { status: 401, body: { error: "UNAUTHENTICATED", message: "Sign in required" } };
      }

      const id = String(request.params.id);
      const { rows } = await database.pool.query(
        `SELECT "id" FROM "${qr.table}" WHERE "id" = $1 AND "owner_id" = $2`,
        [id, principal.id],
      );
      if (!rows.length) {
        return { status: 404, body: { error: "NOT_FOUND", message: "No such QR" } };
      }

      // Only the stable redirect URL affects the image, never mutable destination data.
      const png = await QRCode.toBuffer(publicOrigin() + "/q/" + id, {
        type: "png",
        width: 512,
        margin: 4,
        errorCorrectionLevel: "M",
      });
      return {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-disposition": `attachment; filename="${id}.png"`,
        },
        body: png,
      };
    },
  },
});

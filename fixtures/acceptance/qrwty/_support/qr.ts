import { createHash } from "node:crypto";
import jsQR from "jsqr";
import pngjs from "pngjs";

const { PNG } = pngjs;

/** Decode the real downloaded PNG with an encoder-independent library (jsQR + pngjs). */
export function decodeQr(png: Buffer): string {
  const image = PNG.sync.read(png);
  const code = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
  if (!code) throw new Error("The downloaded image does not contain a decodable QR code");
  return code.data;
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

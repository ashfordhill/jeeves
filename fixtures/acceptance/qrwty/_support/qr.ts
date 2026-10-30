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

/** The decoded PNG's pixel dimensions, from the image itself rather than its metadata claims. */
export function pngSize(png: Buffer): { width: number; height: number } {
  const image = PNG.sync.read(png);
  return { width: image.width, height: image.height };
}

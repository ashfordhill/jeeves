import { createHash } from "node:crypto";
import jsQR from "jsqr";
import pngjs from "pngjs";
import QRCode from "qrcode";
import { artworkSettingsSchema, contrast, RENDERER_VERSION, rgb } from "./settings.ts";

export type { ArtworkSettings } from "./settings.ts";
export {
  artworkPresets,
  artworkSettingsSchema,
  defaultSettings,
  RENDERER_VERSION,
} from "./settings.ts";

interface Rectangle {
  x: number;
  y: number;
  size: number;
  radius: number;
  color: string;
}
export interface ArtworkResult {
  bytes: Buffer;
  contentType: "image/png" | "image/svg+xml";
  sha256: string;
  rendererVersion: string;
  checks: {
    modules: number;
    modulePixels: number;
    quietZone: number;
    contrastRatio: number;
    pngDecode: true;
  };
}

/** Render the stable public URL only. A destination is deliberately not part of this API. */
export function renderArtwork(
  canonicalUrl: string,
  input: unknown,
  format: "png" | "svg",
): ArtworkResult {
  if (!["png", "svg"].includes(format)) throw new Error("Unsupported export format");
  const url = new URL(canonicalUrl);
  if (
    canonicalUrl !== url.href ||
    canonicalUrl.length > 2048 ||
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(
      "Use an absolute HTTP/HTTPS public URL without credentials, at most 2048 characters",
    );
  const settings = artworkSettingsSchema.parse(input);
  const { modules } = QRCode.create(canonicalUrl, {
    errorCorrectionLevel: settings.errorCorrection,
  });
  const cell = Math.floor(settings.size / (modules.size + settings.quietZone * 2));
  if (cell < 3)
    throw new Error("Increase export size: this code needs at least 3 pixels per module");
  const offset = Math.floor((settings.size - modules.size * cell) / 2);
  const eyes = [
    [0, 0],
    [modules.size - 7, 0],
    [0, modules.size - 7],
  ] as const;
  const rectangles: Rectangle[] = [
    { x: 0, y: 0, size: settings.size, radius: 0, color: settings.background },
  ];
  for (let y = 0; y < modules.size; y++)
    for (let x = 0; x < modules.size; x++) {
      if (
        !modules.data[y * modules.size + x] ||
        eyes.some(([ex, ey]) => x >= ex && x < ex + 7 && y >= ey && y < ey + 7)
      )
        continue;
      rectangles.push({
        x: offset + x * cell,
        y: offset + y * cell,
        size: cell,
        radius: settings.moduleStyle === "rounded" ? Math.max(1, Math.floor(cell * 0.2)) : 0,
        color: settings.foreground,
      });
    }
  for (const [x, y] of eyes)
    for (let inset = 0; inset < 3; inset++) {
      rectangles.push({
        x: offset + (x + inset) * cell,
        y: offset + (y + inset) * cell,
        size: (7 - inset * 2) * cell,
        radius:
          settings.finderStyle === "rounded"
            ? Math.max(1, Math.floor(cell * (1 - inset * 0.25)))
            : 0,
        color: inset === 1 ? settings.background : settings.foreground,
      });
    }
  const raster = new pngjs.PNG({ width: settings.size, height: settings.size });
  for (const rectangle of rectangles) fill(raster.data, settings.size, rectangle);
  const decoded = jsQR(new Uint8ClampedArray(raster.data), settings.size, settings.size, {
    inversionAttempts: "dontInvert",
  });
  if (decoded?.data !== canonicalUrl)
    throw new Error(
      "This design did not pass independent PNG decode. Choose another preset or a larger size.",
    );
  const bytes =
    format === "png"
      ? pngjs.PNG.sync.write(raster, {
          colorType: 6,
          filterType: 4,
          deflateLevel: 9,
          deflateStrategy: 3,
        })
      : Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${settings.size}" height="${settings.size}" viewBox="0 0 ${settings.size} ${settings.size}" role="img" aria-label="QR code"><title>QR code</title>${rectangles.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.size}" height="${r.size}" rx="${r.radius}" fill="${r.color}"/>`).join("")}</svg>\n`,
        );
  return {
    bytes,
    contentType: format === "png" ? "image/png" : "image/svg+xml",
    rendererVersion: RENDERER_VERSION,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    checks: {
      modules: modules.size,
      modulePixels: cell,
      quietZone: settings.quietZone,
      contrastRatio: contrast(settings.foreground, settings.background),
      pngDecode: true,
    },
  };
}

function fill(pixels: Buffer, width: number, rectangle: Rectangle) {
  const { x, y, size, radius } = rectangle;
  const color = rgb(rectangle.color);
  for (let dy = 0; dy < size; dy++)
    for (let dx = 0; dx < size; dx++) {
      const cx = Math.max(radius - dx - 0.5, dx + 0.5 - (size - radius), 0);
      const cy = Math.max(radius - dy - 0.5, dy + 0.5 - (size - radius), 0);
      if (cx * cx + cy * cy > radius * radius) continue;
      const at = ((y + dy) * width + x + dx) * 4;
      pixels[at] = color[0];
      pixels[at + 1] = color[1];
      pixels[at + 2] = color[2];
      pixels[at + 3] = 255;
    }
}

import { z } from "zod";

export const RENDERER_VERSION = "qr-artwork@0.1.0";
const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit opaque hex color")
  .transform((value) => value.toUpperCase());
export const artworkSettingsSchema = z
  .strictObject({
    foreground: color,
    background: color,
    moduleStyle: z.enum(["square", "rounded"]),
    finderStyle: z.enum(["square", "rounded"]),
    size: z.union([z.literal(256), z.literal(512), z.literal(1024)]),
    quietZone: z.int().min(4).max(8),
    errorCorrection: z.enum(["M", "Q", "H"]),
  })
  .superRefine((settings, ctx) => {
    if (luminance(settings.foreground) >= luminance(settings.background))
      ctx.addIssue({
        code: "custom",
        path: ["foreground"],
        message: "Use a dark foreground on a lighter background",
      });
    if (contrast(settings.foreground, settings.background) < 7)
      ctx.addIssue({
        code: "custom",
        path: ["foreground"],
        message: "Use colors with at least 7:1 contrast for this preset family",
      });
  });
export type ArtworkSettings = z.infer<typeof artworkSettingsSchema>;

export function rgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((value) => {
    const n = value / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
export function contrast(a: string, b: string): number {
  const first = luminance(a),
    second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
export const defaultSettings: Readonly<ArtworkSettings> = Object.freeze({
  foreground: "#15345A",
  background: "#FFFFFF",
  moduleStyle: "square",
  finderStyle: "square",
  size: 512,
  quietZone: 4,
  errorCorrection: "M",
});
export const artworkPresets: readonly {
  id: string;
  name: string;
  settings: Readonly<ArtworkSettings>;
}[] = Object.freeze([
  { id: "cobalt", name: "Qrwty Cobalt", settings: defaultSettings },
  {
    id: "paper",
    name: "Clean Paper",
    settings: Object.freeze({ ...defaultSettings, foreground: "#18271F", background: "#F4F3EB" }),
  },
  {
    id: "forest",
    name: "Forest Canopy",
    settings: Object.freeze({
      ...defaultSettings,
      foreground: "#193F35",
      background: "#F2F4DE",
      moduleStyle: "rounded",
      finderStyle: "rounded",
    }),
  },
  {
    id: "sunset",
    name: "Lo-fi Sunset",
    settings: Object.freeze({
      ...defaultSettings,
      foreground: "#653548",
      background: "#FFF2E4",
      moduleStyle: "rounded",
    }),
  },
]);

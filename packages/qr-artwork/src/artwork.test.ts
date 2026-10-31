import jsQR from "jsqr";
import pngjs from "pngjs";
import { describe, expect, it } from "vitest";
import { renderArtwork } from "./index.ts";
import {
  artworkPresets,
  artworkSettingsSchema,
  defaultSettings,
  RENDERER_VERSION,
} from "./settings.ts";

const url = "https://qr.example.test/q/12345678-1234-4123-8123-123456789abc";
const decode = (data: Uint8Array, size: number) =>
  jsQR(new Uint8ClampedArray(data), size, size)?.data;

describe("versioned QR artwork", () => {
  it("pins the 0.1.0 reference bytes for future renderer upgrades", () => {
    expect(RENDERER_VERSION).toBe("qr-artwork@0.1.0");
    expect(renderArtwork(url, defaultSettings, "png").sha256).toBe(
      "ab9d92688d9b97b9e8ce729f04c2d252f28a6f585f6b6e32a1c05f0fd277e4b3",
    );
    expect(renderArtwork(url, defaultSettings, "svg").sha256).toBe(
      "4b785eafdc6927d4f60f33054018ba98c8228b0663a58193dd4e504743bce8ce",
    );
  });
  for (const preset of artworkPresets)
    for (const size of [256, 512, 1024] as const) {
      it(`${preset.name} at ${size}px independently decodes, including rotation and reduced contrast`, () => {
        const settings = {
          ...preset.settings,
          size,
          errorCorrection: size === 256 ? "M" : size === 512 ? "Q" : "H",
        };
        const output = renderArtwork(url, settings, "png");
        expect(output.rendererVersion).toBe(RENDERER_VERSION);
        const image = pngjs.PNG.sync.read(output.bytes);
        expect([image.width, image.height]).toEqual([size, size]);
        expect(decode(image.data, size)).toBe(url);
        const rotated = Buffer.alloc(image.data.length);
        for (let y = 0; y < size; y++)
          for (let x = 0; x < size; x++) {
            const source = (y * size + x) * 4;
            const target = (x * size + size - 1 - y) * 4;
            for (let color = 0; color < 3; color++)
              rotated[target + color] = Math.round(image.data[source + color]! * 0.85 + 255 * 0.15);
            rotated[target + 3] = 255;
          }
        expect(decode(rotated, size)).toBe(url);
        // The actual quiet border, not only metadata, stays uniformly background-colored.
        const quietPixels = output.checks.modulePixels * settings.quietZone;
        const corner = image.data.subarray(0, 4);
        for (let y = 0; y < size; y++)
          for (let x = 0; x < size; x++) {
            if (
              x >= quietPixels &&
              y >= quietPixels &&
              x < size - quietPixels &&
              y < size - quietPixels
            )
              continue;
            const at = (y * size + x) * 4;
            if (!image.data.subarray(at, at + 4).equals(corner))
              throw new Error("Quiet zone contains a module");
          }
      });
    }
  for (const moduleStyle of ["square", "rounded"] as const)
    for (const finderStyle of ["square", "rounded"] as const) {
      it(`reproduces ${moduleStyle}/${finderStyle} bytes and a static accessible SVG`, () => {
        const settings = { ...defaultSettings, moduleStyle, finderStyle, quietZone: 8 };
        for (const format of ["png", "svg"] as const) {
          const first = renderArtwork(url, settings, format),
            second = renderArtwork(url, settings, format);
          expect(first.bytes.equals(second.bytes)).toBe(true);
          expect(first.sha256).toBe(second.sha256);
          if (format === "svg") {
            expect(first.bytes.toString()).toContain("<title>QR code</title>");
            expect(first.bytes.toString()).not.toMatch(/script|href|foreignObject|onload/);
          }
        }
      });
    }
  it("rejects unsupported, low-contrast and undersampled designs", () => {
    for (const change of [
      { size: 511 },
      { quietZone: 3 },
      { quietZone: 9 },
      { foreground: "#FFFFFF" },
      { background: "#000000" },
      { foreground: "#999999" },
      { foreground: "red" },
      { moduleStyle: "artistic" },
      { errorCorrection: "L" },
      { logo: "unvalidated" },
    ])
      expect(artworkSettingsSchema.safeParse({ ...defaultSettings, ...change }).success).toBe(
        false,
      );
    expect(() =>
      renderArtwork(url + "?long=" + "x".repeat(1500), { ...defaultSettings, size: 256 }, "png"),
    ).toThrow(/3 pixels per module/);
    for (const invalid of [
      "javascript:alert(1)",
      "https://user:pass@example.test/q/a",
      " https://example.test/q/a",
      url + "x".repeat(2100),
    ])
      expect(() => renderArtwork(invalid, defaultSettings, "png")).toThrow();
  });
  it("presets remain independent drafts and configuration normalization is deterministic", () => {
    const draft = { ...defaultSettings, foreground: "#15345a" };
    expect(artworkSettingsSchema.parse(draft).foreground).toBe("#15345A");
    draft.foreground = "#000000";
    expect(defaultSettings.foreground).toBe("#15345A");
    expect(
      artworkPresets.every((preset) => artworkSettingsSchema.safeParse(preset.settings).success),
    ).toBe(true);
  });
});

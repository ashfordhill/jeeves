/**
 * Chat file input (PLAN §7). Markdown and text go to the model as text; PNG, JPEG, and WebP as
 * images; SVG is rasterized to PNG with resvg, and its source is included too when it's small.
 */
import type { ContentPart, ImageMediaType } from "@jeeves/providers";
import { Resvg } from "@resvg/resvg-js";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Longest text file passed to the model in full; longer files are cut with a note. */
export const MAX_TEXT_CHARS = 60_000;
/** SVG source is included alongside the raster only up to this size. */
export const MAX_SVG_SOURCE_CHARS = 20_000;
const SVG_RASTER_WIDTH = { min: 512, max: 1600 };

export const acceptedTypes = {
  "text/markdown": [".md", ".markdown"],
  "text/plain": [".txt"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/svg+xml": [".svg"],
} as const;
export type AcceptedType = keyof typeof acceptedTypes;

export type StoredFile = { name: string; mediaType: string; data: Buffer };

const isAccepted = (type: string): type is AcceptedType => type in acceptedTypes;

/** The media type a file is stored as, from its declared type, else its extension. */
export function mediaTypeFor(name: string, declared: string | undefined): AcceptedType | undefined {
  const type = declared?.split(";")[0]?.trim().toLowerCase();
  if (type && isAccepted(type)) return type;
  const lower = name.toLowerCase();
  for (const [candidate, extensions] of Object.entries(acceptedTypes)) {
    if (extensions.some((ext) => lower.endsWith(ext))) return candidate as AcceptedType;
  }
  return undefined;
}

/** Checks that the bytes really are what the media type says. Returns a problem, or undefined. */
export function checkFile(mediaType: AcceptedType, data: Buffer): string | undefined {
  if (data.length === 0) return "The file is empty.";
  if (data.length > MAX_FILE_BYTES) return "The file is larger than 10 MB.";
  const starts = (...bytes: number[]) => bytes.every((b, i) => data[i] === b);
  switch (mediaType) {
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47) ? undefined : "This isn't a PNG image.";
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff) ? undefined : "This isn't a JPEG image.";
    case "image/webp":
      return data.subarray(0, 4).toString("latin1") === "RIFF" &&
        data.subarray(8, 12).toString("latin1") === "WEBP"
        ? undefined
        : "This isn't a WebP image.";
    case "image/svg+xml": {
      const text = decodeText(data);
      if (text === undefined || !/<svg[\s>]/i.test(text)) return "This isn't an SVG image.";
      try {
        rasterizeSvg(text);
      } catch (error) {
        return `The SVG couldn't be read: ${error instanceof Error ? error.message : error}`;
      }
      return undefined;
    }
    case "text/markdown":
    case "text/plain":
      return decodeText(data) === undefined ? "The file isn't UTF-8 text." : undefined;
  }
}

/** What the model sees for one file. */
export function fileParts(file: StoredFile): ContentPart[] {
  const header = `Attached file "${file.name}" (${file.mediaType}):`;
  switch (file.mediaType) {
    case "image/png":
    case "image/jpeg":
    case "image/webp":
      return [
        { type: "text", text: header },
        {
          type: "image",
          mediaType: file.mediaType as ImageMediaType,
          data: file.data.toString("base64"),
        },
      ];
    case "image/svg+xml": {
      const source = decodeText(file.data) ?? "";
      const parts: ContentPart[] = [
        { type: "text", text: `${header} rasterized to PNG.` },
        { type: "image", mediaType: "image/png", data: rasterizeSvg(source).toString("base64") },
      ];
      if (source.length <= MAX_SVG_SOURCE_CHARS) {
        parts.push({ type: "text", text: `SVG source of "${file.name}":\n${source}` });
      }
      return parts;
    }
    default: {
      const text = decodeText(file.data) ?? "";
      const cut = text.length > MAX_TEXT_CHARS;
      return [
        {
          type: "text",
          text: `${header}\n${cut ? text.slice(0, MAX_TEXT_CHARS) : text}${cut ? `\n[… cut after ${MAX_TEXT_CHARS} of ${text.length} characters]` : ""}`,
        },
      ];
    }
  }
}

export function rasterizeSvg(source: string): Buffer {
  const probe = new Resvg(source);
  const width = Math.min(
    SVG_RASTER_WIDTH.max,
    Math.max(SVG_RASTER_WIDTH.min, Math.round(probe.width)),
  );
  return new Resvg(source, { fitTo: { mode: "width", value: width }, background: "white" })
    .render()
    .asPng();
}

function decodeText(data: Buffer): string | undefined {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    return undefined;
  }
}

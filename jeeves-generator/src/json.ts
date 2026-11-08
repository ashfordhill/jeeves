import { createHash } from "node:crypto";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export class GeneratorRefusal extends Error {
  constructor(
    readonly code: string,
    readonly path: string,
    message: string,
  ) {
    super(`${code} at ${path}: ${message}`);
    this.name = "GeneratorRefusal";
  }
}
export function refuse(code: string, path: string, message: string): never {
  throw new GeneratorRefusal(code, path, message);
}
export const sha256 = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

/** Same canonical encoding as the frozen input: ASCII sorted keys; array order retained. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : item,
  );
}
export const jsonFile = (value: unknown) => `${canonicalJson(value)}\n`;
export const sameJson = (left: unknown, right: unknown) =>
  canonicalJson(left) === canonicalJson(right);
export const pointerPart = (part: string) => part.replaceAll("~", "~0").replaceAll("/", "~1");

export function atPointer(value: unknown, path: string): unknown {
  if (path === "") return value;
  if (!path.startsWith("/") || /~(?![01])/u.test(path))
    refuse("INVALID_SOURCE_PATH", path, "Use an exact JSON pointer.");
  let current = value;
  for (const part of path.slice(1).split("/")) {
    const key = part.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!current || typeof current !== "object" || !Object.hasOwn(current, key))
      refuse("INVALID_SOURCE_PATH", path, "The source path does not exist.");
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
export function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

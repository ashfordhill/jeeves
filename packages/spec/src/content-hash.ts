/** Canonical JSON v1: ASCII key order, compact UTF-8; array order is significant. */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export function canonicalJson(value: unknown): string {
  const sort = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(sort);
    if (item && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item)
          .filter(([, value]) => value !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, value]) => [key, sort(value)]),
      );
    return item;
  };
  return JSON.stringify(sort(value));
}
export const contentSha256 = (content: Uint8Array) => bytesToHex(sha256(content));
export const jsonBytes = (value: unknown) => utf8ToBytes(canonicalJson(value));
export const jsonSha256 = (value: unknown) => contentSha256(jsonBytes(value));
export const freezeRecord = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeRecord);
    Object.freeze(value);
  }
  return value;
};

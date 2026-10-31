import { createHash } from "node:crypto";

/** Refuse lossy/non-JSON values, cycles and getters before canonicalizing persisted payloads. */
export function canonicalPayload(value: unknown): { json: string; hash: string; value: unknown } {
  const ancestors = new Set<object>();
  let count = 0;
  let bytes = 0;
  const string = (text: string) => {
    bytes += Buffer.byteLength(text, "utf8");
    if (bytes > 65_536 || text.includes(String.fromCharCode(0)) || /[\uD800-\uDFFF]/u.test(text))
      throw new Error("Delivery JSON text exceeds bounds or cannot be stored in PostgreSQL");
    return text;
  };
  const visit = (item: unknown, depth: number): unknown => {
    if (++count > 4096 || depth > 12) throw new Error("Delivery payload exceeds structural bounds");
    if (typeof item === "string") return string(item);
    if (item === null || typeof item === "boolean") return item;
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (typeof item !== "object" || !item)
      throw new Error("Delivery payload must be lossless JSON");
    if (ancestors.has(item)) throw new Error("Delivery payload cannot contain cycles");
    const array = Array.isArray(item);
    if (
      !array &&
      Object.getPrototypeOf(item) !== Object.prototype &&
      Object.getPrototypeOf(item) !== null
    )
      throw new Error("Delivery payload must contain plain objects");
    if (Object.getOwnPropertySymbols(item).length)
      throw new Error("Delivery payload cannot contain symbol properties");
    const descriptors = Object.getOwnPropertyDescriptors(item);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (
        key === "__proto__" ||
        key === "constructor" ||
        key === "prototype" ||
        descriptor.get ||
        descriptor.set ||
        (!descriptor.enumerable && !(array && key === "length"))
      )
        throw new Error("Unsupported delivery payload property");
    }
    ancestors.add(item);
    let result: unknown;
    if (array) {
      if (
        item.length > 4096 ||
        Object.keys(item).length !== item.length ||
        Object.keys(item).some((key, index) => key !== String(index))
      )
        throw new Error("Delivery arrays must be dense without extra properties");
      result = item.map((entry) => visit(entry, depth + 1));
    } else {
      result = Object.fromEntries(
        Object.keys(item)
          .sort()
          .map((key) => [string(key), visit(descriptors[key]?.value, depth + 1)]),
      );
    }
    ancestors.delete(item);
    return result;
  };
  const normalized = visit(value, 0);
  const json = JSON.stringify(normalized);
  if (Buffer.byteLength(json, "utf8") > 65_536) throw new Error("Delivery payload exceeds 64 KiB");
  return { json, hash: createHash("sha256").update(json).digest("hex"), value: normalized };
}

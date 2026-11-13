/** Trusted compiled descriptors only. Saved source selects resources, never mappings/code. */
export type SearchField = {
  type: "keyword" | "text" | "integer" | "long" | "double" | "date";
  index?: boolean;
};
export type SearchMapping<Document> = {
  version: number;
  properties: { readonly [Key in keyof Document]: SearchField };
};
export type SearchIndex = SearchMapping<Record<string, unknown>> & { index: string };

export function validateSearchMapping(mapping: SearchMapping<Record<string, unknown>>): void {
  if (!Number.isSafeInteger(mapping.version) || mapping.version < 1)
    throw new Error("Invalid search mapping version");
  const fields = Object.entries(mapping.properties);
  if (!fields.length || fields.length > 100) throw new Error("Invalid search fields");
  for (const [name, field] of fields) {
    if (
      !/^[a-zA-Z][a-zA-Z0-9_]{0,127}$/.test(name) ||
      !["keyword", "text", "integer", "long", "double", "date"].includes(field.type) ||
      Object.keys(field).some((key) => key !== "type" && key !== "index") ||
      (field.index !== undefined && typeof field.index !== "boolean")
    )
      throw new Error("Invalid explicit search field");
  }
}
export function validateSearchIndex(binding: SearchIndex): void {
  if (!/^[a-z][a-z0-9-]{0,127}$/.test(binding.index)) throw new Error("Invalid search index");
  validateSearchMapping(binding);
}
export function searchIdentity(input: string): string {
  if (
    typeof input !== "string" ||
    !input.length ||
    Buffer.byteLength(input, "utf8") > 512 ||
    [...input].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new Error("Invalid search identity");
  return input;
}
export function searchVersion(input: number): number {
  if (!Number.isSafeInteger(input) || input < 1) throw new Error("Invalid search version");
  return input;
}
export interface SearchDocument<Document extends Record<string, unknown>> {
  mapping: SearchMapping<Document>;
  parse(input: unknown): Document;
  id(document: Document): string;
  version(document: Document): number;
}
/** Every field must be explicitly mapped and validated. Codec must reject private/extra fields,
 * rather than silently stripping them. ID/version/eligibility are compiled adapter policy. */
export function defineSearchDocument<Document extends Record<string, unknown>>(options: {
  mapping: SearchMapping<Document>;
  codec: { parse(input: unknown): Document };
  id(document: Document): string;
  version(document: Document): number;
}): SearchDocument<Document> {
  validateSearchMapping(options.mapping);
  const mapping = structuredClone(options.mapping);
  const keys = Object.keys(mapping.properties).sort();
  const exactFields = (value: unknown) => {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys)
    )
      throw new Error("Unexpected or missing public search field");
  };
  return {
    mapping,
    parse(input) {
      exactFields(input);
      const document = options.codec.parse(input);
      exactFields(document);
      searchIdentity(options.id(document));
      searchVersion(options.version(document));
      // Snapshot the public JSON value; later mutation cannot add an unvalidated field.
      return JSON.parse(JSON.stringify(document)) as Document;
    },
    id: (document) => searchIdentity(options.id(document)),
    version: (document) => searchVersion(options.version(document)),
  };
}

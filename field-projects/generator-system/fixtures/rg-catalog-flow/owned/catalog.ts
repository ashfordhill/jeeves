// @jeeves-extension: contract
export interface CatalogItem {
  readonly id: string;
  readonly title: string;
}
export function catalogItem(input: unknown): CatalogItem {
  const value = input as Partial<CatalogItem>;
  if (
    !value ||
    typeof value.id !== "string" ||
    !/^[a-z0-9-]{1,64}$/.test(value.id) ||
    typeof value.title !== "string" ||
    value.title.length < 1 ||
    value.title.length > 100
  )
    throw Error("Invalid catalog item");
  return { id: value.id, title: value.title };
}

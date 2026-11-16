/** Application-owned shared DTO validation, copied into src/contracts/item.ts. */
export interface ItemInput {
  readonly id: string;
}
export function itemInput(value: unknown): ItemInput {
  if (
    !value ||
    typeof value !== "object" ||
    Object.keys(value).join() !== "id" ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !/^[a-z0-9-]{1,64}$/.test(value.id)
  )
    throw new Error("Invalid item");
  return { id: value.id };
}

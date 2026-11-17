export type RecordValue = {
  key: string;
  public: boolean;
  version: string;
  validUntil: number;
  destination: string;
};
export function parseRecord(raw: unknown): RecordValue {
  const value = raw as RecordValue;
  if (
    !value ||
    typeof value.key !== "string" ||
    typeof value.public !== "boolean" ||
    typeof value.version !== "string" ||
    !Number.isSafeInteger(value.validUntil) ||
    typeof value.destination !== "string"
  )
    throw Error("Invalid record");
  return {
    key: value.key,
    public: value.public,
    version: value.version,
    validUntil: value.validUntil,
    destination: value.destination,
  };
}

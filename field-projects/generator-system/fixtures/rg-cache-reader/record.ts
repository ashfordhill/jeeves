export type PublicRecord = {
  key: string;
  public: boolean;
  destination: string;
  version: string;
  validUntil: number;
};
export function parseRecord(value: unknown): PublicRecord {
  const record = value as PublicRecord;
  if (
    !record ||
    typeof record.key !== "string" ||
    typeof record.public !== "boolean" ||
    typeof record.destination !== "string" ||
    typeof record.version !== "string" ||
    !Number.isSafeInteger(record.validUntil)
  )
    throw Error("Invalid public record");
  return {
    key: record.key,
    public: record.public,
    destination: record.destination,
    version: record.version,
    validUntil: record.validUntil,
  };
}

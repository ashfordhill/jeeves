/** Shared finite identity contract; usable without lifecycle persistence or transport. */
export interface AssetJobIdentity {
  assetId: string;
  jobId: string;
  attemptId: string;
}
export function assetUuid(value: string): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
    throw new Error("Invalid asset/job identity");
  return value.toLowerCase();
}

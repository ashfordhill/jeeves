// Generated scaffold: View count reader, a Data access in Watch API.
// Export rewrites this file; write the module in watch-api-view-count-reader.ts.
import type { DatabaseReadWriter } from "../dependencies.ts";

/** What the module uses: one property per connected slot. */
export type Dependencies = {
  // database: View counts (Database) through watch-api-database-2, read & write
  viewCounts: DatabaseReadWriter;
};

/** Each connected slot: the tile or module it uses, through which link, and how. */
export const slots = [
  {"slot":"database","property":"viewCounts","tile":"view-counts","kind":"database","connection":"watch-api-database-2","link":"watch-api-view-count-reader-view-counts","use":"read-write","access":"write"},
] as const;

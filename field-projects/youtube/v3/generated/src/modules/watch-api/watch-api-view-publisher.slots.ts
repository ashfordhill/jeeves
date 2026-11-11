// Generated scaffold: View publisher, a Custom in Watch API.
// Export rewrites this file; write the module in watch-api-view-publisher.ts.
import type { DatabaseReadWriter, QueuePublisher } from "../dependencies.ts";

/** What the module uses: one property per connected slot. */
export type Dependencies = {
  // uses: View events (Message channel) through watch-api-message-channel, publish
  viewEvents: QueuePublisher;
  // uses: Metadata (Database) through watch-api-database, read & write
  metadata: DatabaseReadWriter;
};

/** Each connected slot: the tile or module it uses, through which link, and how. */
export const slots = [
  {"slot":"uses","property":"viewEvents","tile":"view-events","kind":"queue","connection":"watch-api-message-channel","link":"watch-api-view-publisher-view-events","use":"publish"},
  {"slot":"uses","property":"metadata","tile":"metadata","kind":"database","connection":"watch-api-database","link":"watch-api-view-publisher-metadata","use":"read-write","access":"write"},
] as const;

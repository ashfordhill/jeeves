import { rm, writeFile } from "node:fs/promises";
import { connect } from "../clients/indexer-consumer.ts";
import { parseMessage, videoPublished } from "../contracts/v1.ts";
import { handle } from "../extensions/indexer-writer.ts";
import { NonRetryable } from "../lib/amqp.ts";
import { searchClient } from "../lib/search.ts";
import { assertSearch } from "../lib/search-schema.ts";
const client = searchClient();
let input: Awaited<ReturnType<typeof connect>> | undefined;
try {
  await rm("/tmp/shell-ready", { force: true });
  await assertSearch(client);
  input = await connect(async (body, delivery) => {
    let event;
    try {
      if (!delivery.messageId) throw new Error("Missing identity");
      event = videoPublished.parse(parseMessage("publication-events", body, delivery.messageId));
    } catch {
      throw new NonRetryable("MALFORMED_MESSAGE");
    }
    await handle(client, event);
    console.log(
      JSON.stringify({
        videoId: event.videoId,
        publicationVersion: event.publicationVersion,
        eventId: event.eventId,
        indexed: true,
      }),
    );
  });
  await writeFile("/tmp/shell-ready", "ready\n");
  if ((await input.closed).fatal) process.exitCode = 1;
} catch (error) {
  if (error instanceof Error && error.message.startsWith("Search videos"))
    console.error(error.message);
  console.error("Indexer failed; inspect mapping and publication queue readiness.");
  process.exitCode = 1;
} finally {
  await rm("/tmp/shell-ready", { force: true });
  await input?.close();
  await client.close();
}

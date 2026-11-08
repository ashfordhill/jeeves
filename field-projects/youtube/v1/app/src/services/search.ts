import { handle, searchInput } from "../extensions/search-query.ts";
import { createHttpService, HttpError } from "../lib/http.ts";
import { searchClient } from "../lib/search.ts";
import { assertSearch } from "../lib/search-schema.ts";
const client = searchClient(900);
const service = await createHttpService(
  "search",
  { concurrencyLimit: 1000, requestTimeoutMs: 1000 },
  (app) => {
    app.get("/videos", async (req) => {
      const input = searchInput.safeParse(req.query);
      if (!input.success)
        throw new HttpError(
          400,
          "SEARCH_QUERY",
          "Enter a query of 1–200 characters and a page from 1–100.",
        );
      return handle(client, input.data);
    });
  },
  () => assertSearch(client),
);
try {
  await service.start();
  await new Promise<void>((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
} catch (error) {
  if (error instanceof Error && error.message.startsWith("Search videos"))
    console.error(error.message);
  console.error("Search startup failed; inspect index mapping/settings and readiness.");
  process.exitCode = 1;
} finally {
  await service.close();
  await client.close();
}

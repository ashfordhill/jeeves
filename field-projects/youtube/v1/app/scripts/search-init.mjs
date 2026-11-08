import { searchClient } from "../dist/lib/search.js";
import { assertSearch } from "../dist/lib/search-schema.js";
const client = searchClient();
try {
  await assertSearch(client);
  console.log("Public search settings and strict versioned mapping asserted without data reset.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}

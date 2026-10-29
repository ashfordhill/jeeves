// drizzle-kit config for {{consumerName}}: `pnpm exec drizzle-kit generate` turns changes to
// src/db/schema.ts into SQL migrations. Project-owned.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./migrations",
});

#!/usr/bin/env node
// jeeves-rest-client-types: regenerates each generated client's types from its target's contract.
// Run in an element directory; `npm run typecheck` runs it first (the `pretypecheck` script).
import { generateClientTypes } from "./codegen.ts";

try {
  for (const result of generateClientTypes(process.cwd())) {
    const state = result.changed ? "updated" : "up to date";
    console.log(`${result.types} (${state}) from ${result.contract}`);
  }
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

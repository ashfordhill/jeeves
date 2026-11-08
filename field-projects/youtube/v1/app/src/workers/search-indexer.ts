import { workerShell } from "../lib/worker.ts";
await workerShell("search-indexer","search-indexer",4,5);

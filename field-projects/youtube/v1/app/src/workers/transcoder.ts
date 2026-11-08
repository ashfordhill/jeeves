import { workerShell } from "../lib/worker.ts";
await workerShell("transcoder","upload-jobs",1,3);

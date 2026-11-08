import { localV1Templates } from "../templates/local-v1/index.ts";
import { assembleExperimental } from "./assemble.ts";
import { exportNewDirectory } from "./export.ts";
import { loadYoutubeLocalInput } from "./local.ts";

const destination = process.argv[2];
if (!destination || process.argv.length !== 3)
  throw new Error("Usage: pnpm --filter @jeeves/generator export:new /absolute/new-directory");
const bundle = assembleExperimental(loadYoutubeLocalInput(), localV1Templates);
console.log(await exportNewDirectory(bundle.files, destination));

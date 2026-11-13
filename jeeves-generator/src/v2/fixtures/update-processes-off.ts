import { writeFileSync } from "node:fs";
import { loadLocalV2Registry } from "../../../templates/local-v2/index.ts";
import { offDesigns, offPin } from "./processes-off.ts";

const registry = loadLocalV2Registry();
const pins = Object.fromEntries(
  Object.entries(offDesigns(registry)).map(([name, designJson]) => [
    name,
    offPin(designJson, registry),
  ]),
);
writeFileSync(
  new URL("./processes-off.json", import.meta.url),
  `${JSON.stringify(pins, null, 2)}\n`,
);
console.log(Object.fromEntries(Object.entries(pins).map(([name, pin]) => [name, pin.files])));

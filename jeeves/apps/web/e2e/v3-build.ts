/**
 * YouTube v3 designed from a blank project by mouse (YouTube v3 plan, V3-11): the v3 reference's
 * rows (`fixtures/v3-modules.ts`, contract section 5) in the names the fan and the module menu
 * show, and the build that performs them with the v2 rebuild's mouse steps. Only pointer and UI
 * interactions write; API reads only wait for saves and check results.
 */

import { studioComponentDefinitions, studioDefinitions } from "@jeeves/spec";
import type { Page } from "@playwright/test";
import {
  V3_ACTIONS,
  V3_CONNECTIONS,
  V3_MODULES,
  V3_SYSTEM,
  V3_TILES,
  V3_VALUES,
} from "../../../packages/spec/src/fixtures/v3-modules.ts";
import {
  addModules,
  buildTiles,
  connectModules,
  type Gestures,
  type Module,
  setValues,
  type TilePlan,
} from "./v2-rebuild.ts";

/** The user's `+` items by lane. */
const actionItems = { download: "Consume", upload: "Produce" } as const;

/** v3's system, actions and 31 steps, each tile kind as the link fan names it. */
export const V3_PLAN: TilePlan = {
  system: V3_SYSTEM,
  actions: V3_ACTIONS.map(([lane, name]) => [actionItems[lane], name] as const),
  steps: V3_TILES.map((step) =>
    "link" in step ? step : { ...step, kind: studioDefinitions[step.kind].name },
  ),
};

/** v3's 26 modules by tile, each kind as the module menu names it. */
export const V3_MENU_MODULES: Readonly<Record<string, readonly Module[]>> = Object.fromEntries(
  Object.entries(V3_MODULES).map(([host, modules]) => [
    host,
    modules.map((item) => ({ ...item, kind: studioComponentDefinitions[item.kind].name })),
  ]),
);

/** The tiles whose modules come from the inspector's `+` rather than the container's. */
export const FROM_INSPECTOR: ReadonlySet<string> = new Set(["Account API"]);

/** v3's tiles, modules, module connections and useful values, by mouse, in a blank project. */
export async function buildV3(page: Page, id: string, log: Gestures) {
  await buildTiles(page, id, V3_PLAN, log);
  await addModules(page, id, V3_MENU_MODULES, log, FROM_INSPECTOR);
  await connectModules(page, id, V3_CONNECTIONS, log);
  await setValues(page, V3_VALUES, log);
}

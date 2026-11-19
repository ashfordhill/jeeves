import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { createStudioComponentSettings } from "../../../../jeeves/packages/spec/src/studio-components.ts";
import type { StudioCommand } from "../../../../jeeves/packages/spec/src/studio-operations.ts";
import { browserSessionDesign } from "../rg-browser-session/design.ts";

export function auth0Design() {
  const base = browserSessionDesign();
  const auth0 = base.architecture?.studio?.elements.find((row) => row.element === "identity");
  if (auth0?.settings.kind !== "identity") throw new Error("Identity fixture missing");
  const accountSettings = createStudioComponentSettings("auth-guard");
  return runStudioCommands(base, [
    { type: "edit", element: "identity", settings: { ...auth0.settings, provider: "auth0" } },
    {
      type: "editComponent",
      component: "sign-in",
      settings: {
        kind: "browser-session",
        signIn: "optional",
        guestContext: "enabled",
        idleSeconds: 3600,
        absoluteSeconds: 86400,
        offlineAccess: "enabled",
      },
    },
    ...(
      [
        ["browser-api", "account-api", "Account API", "account-data", "required"],
        ["account-api", "billing-api", "Billing API", "billing-data", "required"],
        ["browser-api", "link-api", "Link API", "link-data", "optional"],
      ] as const
    ).flatMap(([from, tile, name, id, signIn]): StudioCommand[] => [
      {
        type: "addTile",
        from: { tile: from },
        side: "after",
        tile: { id: tile, name, kind: "service" },
        linkId: `${from}-${tile}`,
      },
      { type: "linkTiles", from: { tile: tile }, to: "identity", linkId: `${tile}-identity` },
      { type: "addModule", host: tile, kind: "auth-guard", id: `${tile}-user` },
      {
        type: "editComponent",
        component: `${tile}-user`,
        settings: { ...accountSettings, signIn: signIn },
      },
      {
        type: "connectModule",
        module: `${tile}-user`,
        slot: "identity",
        target: { tile: "identity" },
      },
      { type: "addModule", host: tile, kind: "custom", id: id },
      { type: "connectModule", module: id, slot: "workload", target: { tile: "identity" } },
    ]),
    { type: "connectModule", module: "account", slot: "workload", target: { tile: "identity" } },
    { type: "connectModule", module: "account", slot: "uses", target: { tile: "account-api" } },
    { type: "connectModule", module: "account", slot: "uses", target: { tile: "link-api" } },
    {
      type: "connectModule",
      module: "account-data",
      slot: "uses",
      target: { tile: "billing-api" },
    },
  ]);
}

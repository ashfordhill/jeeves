import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { localOperationDesign } from "../rg-local-operation/design.ts";

/** One trusted principal policy, called from new-work admission of the RG10 local operation. */
export const rateLimiterDesign = () =>
  runStudioCommands(localOperationDesign(), [
    {
      type: "addTile",
      from: { tile: "items-api" },
      side: "after",
      tile: { id: "admission-cache", name: "Admission cache", kind: "cache" },
      linkId: "api-cache",
    },
    {
      type: "addTile",
      from: { tile: "items-api" },
      side: "after",
      tile: { id: "accounts", name: "Accounts", kind: "identity" },
      linkId: "api-accounts",
    },
    {
      type: "addModule",
      host: "items-api",
      id: "account-guard",
      name: "Account guard",
      kind: "auth-guard",
    },
    {
      type: "connectModule",
      module: "account-guard",
      slot: "identity",
      target: { tile: "accounts" },
    },
    {
      type: "addModule",
      host: "items-api",
      id: "create-limit",
      name: "Create limit",
      kind: "rate-limiter",
    },
    {
      type: "connectModule",
      module: "create-limit",
      slot: "store",
      target: { tile: "admission-cache" },
    },
    {
      type: "editComponent",
      component: "create-limit",
      settings: {
        kind: "rate-limiter",
        algorithm: "sliding-window",
        key: "policy",
        store: "redis",
        limit: 2,
        windowSeconds: 60,
      },
    },
    {
      type: "connectModule",
      module: "create-item",
      slot: "admission",
      target: { module: "create-limit" },
    },
  ]);

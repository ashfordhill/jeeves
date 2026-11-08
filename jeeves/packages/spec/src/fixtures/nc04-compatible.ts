/** Explicit test-only copy; never a product preset or migration. */
import { applyOperations } from "../apply.ts";
import { designSchema } from "../design.ts";
import { tinyurlDesignScope } from "../design-scope.ts";
import { ownershipSchema } from "../ownership.ts";
import legacy from "./nc01-schema2.json" with { type: "json" };
import owners from "./nc02-ownership-v1.json" with { type: "json" };

const required = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error();
  return value;
};
/** Explicitly compatible test copy, never a preset or saved-design migration. */
export const compatibleResolveDesign = () => {
  const design = designSchema.parse(legacy.design),
    studio = required(design.architecture?.studio);
  for (const item of studio.elements) {
    if (item.element === "shorten" && "requestTimeoutMs" in item.settings)
      item.settings.requestTimeoutMs = 10000;
    if (item.element === "redirect" && "requestTimeoutMs" in item.settings)
      item.settings.requestTimeoutMs = 1200;
    if (item.element === "url-cache" && item.settings.kind === "cache")
      item.settings.ttlSeconds = 300;
  }
  for (const item of studio.components ?? []) {
    if (item.id === "redirect-data" && item.settings.kind === "data-access")
      item.settings.readRouting = "primary";
    if (item.id === "redirect-cache-reader")
      item.settings = {
        kind: "cache-reader",
        pattern: "cache-aside",
        stampede: "none",
        l2TtlSeconds: 300,
      };
    if (item.id === "redirect-responder" && item.settings.kind === "redirect-responder")
      item.settings.status = "307";
  }
  const result = applyOperations(design, [
    { op: "upgradeDesign", scope: tinyurlDesignScope() },
    { op: "setOwnership", ownership: ownershipSchema.parse(owners) },
  ]);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  if (result.design.schemaVersion !== 3) throw new Error();
  return result.design;
};

/** Seed a new scratch project through real operations; no API/backend runtime is created. */
export function resolveFixtureSeedOps() {
  const copy = compatibleResolveDesign();
  if (copy.schemaVersion !== 3 || !copy.ownership) throw new Error();
  return [
    ...copy.elements.map((element) => ({ op: "addElement" as const, element })),
    ...copy.connections.map((connection) => ({ op: "connect" as const, connection })),
    { op: "setArchitecture" as const, architecture: copy.architecture },
    { op: "upgradeDesign" as const, scope: copy.scope },
    { op: "setOwnership" as const, ownership: copy.ownership },
  ];
}

import { buildOwnershipCommand, ownershipSchema } from "@jeeves/spec";
import type { Page } from "@playwright/test";
import fixture from "../../../packages/spec/src/fixtures/nc02-ownership-v1.json" with {
  type: "json",
};
import { commitSource } from "./source.ts";

/** Preserve the historical ownership fixture through explicit source setup. */
export async function declareLinks(page: Page) {
  const ownership = ownershipSchema.parse(fixture);
  ownership.owners = [{ id: "owner-1", name: "Links" }];
  for (const row of ownership.roles) row.owner = "owner-1";
  for (const row of ownership.resources) row.authority = "owner-1";
  await commitSource(page, (design) => buildOwnershipCommand(design, { ownership, upgrade: true }));
}

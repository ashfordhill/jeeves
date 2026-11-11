import {
  type generationPolicies,
  generationRuntime,
  type NormalizedGenerationSelection,
} from "@jeeves/spec";
import { qualifiedRelation } from "../../templates/local-v2/assets/src/runtime/durable-sql.ts";
import { quoteSqlIdentifier } from "../../templates/local-v2/assets/src/runtime/local.ts";
import { pointerPart, refuse } from "../json.ts";
import type { SqlRelation } from "./durability.ts";
import { mountedHooksGap } from "./module-stubs.ts";
import type { V2Emitter } from "./registry.ts";

type FavoritesPolicy = typeof generationPolicies.favorites.definition;

/** The bounds a Favorites selection runs, from its favorites policy (v3 contract, section 3). */
export function favoritesBounds(selection: NormalizedGenerationSelection) {
  const policy = selection.policies.find((item) => item.ref.id === "favorites-policy")
    ?.definition as FavoritesPolicy | undefined;
  if (!policy) refuse("INVALID_LOCAL_CONTRIBUTION", selection.id, "Bind the favorites policy.");
  const { item, account, perAccount, pageSize } = policy;
  if (
    !/^[A-Za-z0-9._:-]+$/.test(item.characters) ||
    !(Number.isSafeInteger(item.minCharacters) && item.minCharacters >= 1) ||
    !(Number.isSafeInteger(item.maxCharacters) && item.maxCharacters >= item.minCharacters)
  )
    refuse("INVALID_LOCAL_CONTRIBUTION", selection.id, "Use a finite favorites item ID rule.");
  return {
    itemPattern: `^[${item.characters}]{${item.minCharacters},${item.maxCharacters}}$`,
    accountCharacters: account.maxCharacters,
    perAccount,
    pageSize,
  };
}

/** The template-owned table: one row per account and item, with an index for newest first. */
export function favoritesSchema(
  table: SqlRelation,
  bounds: ReturnType<typeof favoritesBounds>,
): string {
  const relation = qualifiedRelation(table);
  const schema = quoteSqlIdentifier(table.schema);
  return `CREATE SCHEMA IF NOT EXISTS ${schema};
REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC;
CREATE TABLE ${relation} (
 account text NOT NULL CHECK(length(account) BETWEEN 1 AND ${bounds.accountCharacters}),
 item text NOT NULL CHECK(item ~ '${bounds.itemPattern}'),
 added_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(account, item)
);
CREATE INDEX ON ${relation}(account, added_at DESC, item);
`;
}

/**
 * The Favorites engine and its routes (`src/runtime/favorites.ts`). With Runnable processes on,
 * the tile process mounts it behind the tile's Required sign-in and contributes its table; the
 * product's `eligible` hook stays custom until written.
 */
export function createLocalFavorites(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.favorites",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description:
      "Each signed-in account's favorite items in one template-owned table, with bounded add, check, remove and paged list.",
    sourcePaths,
    dependencies: [generationRuntime.ref],
    render: ({ model, asset }) => {
      const selections = model.selections.filter((s) => s.binding.kind === "favorites");
      const paths = selections.map(
        (s) => `/${s.sourcePath.map((p) => pointerPart(String(p))).join("/")}`,
      );
      if (!paths.length) return { files: [] };
      return {
        files: [
          {
            path: "src/runtime/favorites.ts",
            content: asset(
              "jeeves-generator/templates/local-v2/assets/src/runtime/favorites.ts.template",
            ),
            ownership: "generated-scaffold" as const,
            sourcePaths: paths,
          },
        ],
        gaps: [
          mountedHooksGap(
            model,
            selections,
            {
              id: "favorites-application-bindings",
              required: true,
              status: "unfinished" as const,
              description:
                "Bind the eligibility hook, contribute the favorites table and its runtime access, and mount the routes behind the tile's Required sign-in in a compiled service. Dependency output alone installs no application.",
              sourcePaths: paths,
            },
            "adding an item answers 501",
          ),
        ],
      };
    },
  };
}

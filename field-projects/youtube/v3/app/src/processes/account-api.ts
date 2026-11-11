// Generated scaffold: Account API (Microservice) runs as app-account-api, an HTTP process.
// Export rewrites this file. Write modules in src/modules/; .jeeves/report.json lists what runs.
import { pool, selected } from "../features/service-resources.ts";
import { accountApiFavoriteVideosHooks } from "../modules/account-api/account-api-favorite-videos.hooks.ts";
import { createFavorites, mountFavorites } from "../runtime/favorites.ts";
import { createHttpService } from "../runtime/http.ts";
import { createPrincipalVerifier } from "../runtime/identity.ts";
import { runProcess } from "../runtime/process.ts";
import { createTileGuard } from "../runtime/tile-guard.ts";
import { notImplementedRoutes } from "../runtime/tile-http.ts";
import { createNotImplementedLog, logStarted } from "../runtime/tile-process.ts";

/** Compiled configuration: nothing is read from disk at runtime. */
export const config = {
  "tile": "account-api",
  "kind": "service",
  "shape": "http",
  "exposure": "public",
  "settings": {
    "requestTimeoutMs": 1000,
    "concurrencyLimit": 1000
  },
  "listen": {
    "host": "0.0.0.0",
    "port": 3000
  },
  "templates": {
    "account-api-account-check": {
      "template": "verified-identity",
      "lead": "account-api-account-check",
      "identity": "sign-in",
      "signIn": "required",
      "me": "/modules/account-api-account-check/me"
    },
    "account-api-favorite-videos": {
      "template": "favorites",
      "lead": "account-api-favorite-videos",
      "table": {
        "schema": "account_api_favorite_videos",
        "table": "favorites"
      },
      "bounds": {
        "itemPattern": "^[A-Za-z0-9._:-]{1,200}$",
        "accountCharacters": 255,
        "perAccount": 1000,
        "pageSize": 50
      },
      "routes": "/modules/account-api-favorite-videos/items"
    }
  }
} as const;

await runProcess(async (scope) => {
  // "Not implemented" answers 501 with one log line per module and hook a second.
  const log = createNotImplementedLog(config.tile);
  // Account check: the tile's sign-in, Required: every module route needs a valid token.
  const accountApiAccountCheck = (() => {
    const binding = config.templates["account-api-account-check"];
    return createTileGuard({
      signIn: binding.signIn,
      verify: createPrincipalVerifier({
        issuer: process.env.OIDC_ISSUER ?? "",
        audience: `${binding.identity}-web`,
        jwksUrl: process.env.OIDC_JWKS_URL ?? "",
        algorithms: ["RS256"],
        jwksTimeoutMs: 3000,
      }),
    });
  })();
  // Favorite videos: each signed-in account's favorite items, in the template's own table.
  const accountApiFavoriteVideos = (() => {
    const s = selected("favorites", "account-api-favorite-videos");
    const binding = config.templates["account-api-favorite-videos"];
    const db = pool(scope, s, "state");
    const items = pool(scope, s, "items");
    const favorites = createFavorites({
      db,
      table: binding.table,
      bounds: binding.bounds,
      hooks: accountApiFavoriteVideosHooks({ items }),
    });
    return { db, items, favorites };
  })();
  const service = await createHttpService({
    id: config.tile,
    settings: config.settings,
    configure: (open) => {
      // Every module route checks its caller first: the tile's sign-in.
      const routes = accountApiAccountCheck.routes(open);
      accountApiAccountCheck.me(routes, "/modules/account-api-account-check/me");
      mountFavorites(notImplementedRoutes(routes, log, "account-api-favorite-videos"), {
        base: config.templates["account-api-favorite-videos"].routes,
        favorites: accountApiFavoriteVideos.favorites,
        principal: (request) => accountApiAccountCheck.require(request),
      });
    },
    initialize: async () => {
      await accountApiFavoriteVideos.db.query("SELECT 1");
      await accountApiFavoriteVideos.items.query("SELECT 1");
    },
  });
  // Draining stops admission first, then waits for admitted requests.
  scope.own(() => service.close());
  await service.start(config.listen);
  logStarted(config.tile, {"module":"account-api-account-check","template":"verified-identity","wiring":"mounted","checks":["sign-in Required on every module route"]});
  logStarted(config.tile, {"module":"account-api-favorite-videos","template":"favorites","wiring":"mounted","checks":["SELECT 1 on its state login","SELECT 1 on its items login"]});
  scope.ready();
});

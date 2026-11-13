// Generated scaffold: the Favorites template (v3 contract, section 3). Export rewrites this file.
// Each signed-in account keeps its favorite items in one template-owned table, newest first.
// Adding asks the product's `eligible` hook first; checking, listing and removing never do.
import type { FastifyRequest } from "fastify";
import type pg from "pg";
import { HttpError } from "./admission.ts";
import { qualifiedRelation, type SqlRelation } from "./durable-sql.ts";
import type { HttpRoutes } from "./http.ts";
import type { VerifiedPrincipal } from "./identity.ts";
import { transaction } from "./transaction.ts";

/** The favorites policy's bounds, compiled into the process config. */
export type FavoritesBounds = {
  /** What an item ID may be: its characters and length. */
  itemPattern: string;
  /** An account is its verified subject, of at most this many characters. */
  accountCharacters: number;
  /** How many favorites one account may keep. */
  perAccount: number;
  /** Favorites to a page of the list. */
  pageSize: number;
};
/** The product's hooks: whether an item may be favorited. */
export interface FavoritesHooks {
  eligible(itemId: string): Promise<boolean>;
}
export type Favorite = { itemId: string; addedAt: string };
export type FavoritesPage = { items: Favorite[]; next: string | null };

const itemError = () => new HttpError(400, "ITEM_ID", "This item ID isn't valid.");
const cursorError = () => new HttpError(400, "CURSOR", "This page cursor isn't valid.");
const accountError = () => new HttpError(403, "ACCOUNT_ID", "This account can't keep favorites.");
const notFavorite = () => new HttpError(404, "NOT_FAVORITE", "This item isn't a favorite.");
const notEligible = () =>
  new HttpError(404, "NOT_ELIGIBLE", "This item can't be added to favorites.");
const full = () =>
  new HttpError(409, "FAVORITES_FULL", "This account has the most favorites it may keep.");
/** A time as the list's cursor and answers carry it: UTC, to the microsecond. */
const stamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const addedAt = `to_char(added_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
type Row = { item: string; added_at: string };
const favorite = (row: Row): Favorite => ({ itemId: row.item, addedAt: row.added_at });
type Query = {
  query<R extends pg.QueryResultRow>(sql: string, values?: unknown[]): Promise<pg.QueryResult<R>>;
};

/** One account's favorites in `table`, within `bounds`. */
export function createFavorites(options: {
  db: Pick<pg.Pool, "query" | "connect">;
  table: SqlRelation;
  bounds: FavoritesBounds;
  hooks: FavoritesHooks;
}) {
  const { bounds, db, hooks } = options;
  if (
    ![bounds.accountCharacters, bounds.perAccount, bounds.pageSize].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    )
  )
    throw new Error("Invalid favorites bounds");
  const table = qualifiedRelation(options.table);
  const pattern = new RegExp(bounds.itemPattern);
  // Adds by one account are serialized, so its count never passes the bound.
  const lock = `${options.table.schema}.${options.table.table}`;
  const account = (principal: VerifiedPrincipal) => {
    const subject = principal.subject;
    if (typeof subject !== "string" || !subject.length || subject.length > bounds.accountCharacters)
      throw accountError();
    return subject;
  };
  const item = (itemId: unknown) => {
    if (typeof itemId !== "string" || !pattern.test(itemId)) throw itemError();
    return itemId;
  };
  const find = async (query: Query, owner: string, itemId: string) => {
    const result = await query.query<Row>(
      `SELECT item, ${addedAt} AS added_at FROM ${table} WHERE account=$1 AND item=$2`,
      [owner, itemId],
    );
    const row = result.rows[0];
    return row ? favorite(row) : undefined;
  };
  const cursor = (after: unknown): [string, string] | undefined => {
    if (after === undefined) return undefined;
    if (typeof after !== "string" || !after.length || after.length > 1024) throw cursorError();
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(after, "base64url").toString("utf8"));
    } catch {
      throw cursorError();
    }
    if (!Array.isArray(parsed) || parsed.length !== 2) throw cursorError();
    const [time, itemId] = parsed;
    if (
      typeof time !== "string" ||
      !stamp.test(time) ||
      Number.isNaN(Date.parse(time)) ||
      new Date(time).toISOString().slice(0, 19) !== time.slice(0, 19) ||
      typeof itemId !== "string" ||
      !pattern.test(itemId)
    )
      throw cursorError();
    return [time, itemId];
  };
  const next = (last: Favorite) =>
    Buffer.from(JSON.stringify([last.addedAt, last.itemId]), "utf8").toString("base64url");
  return {
    /** Adds an eligible item, once: again answers the same favorite. */
    async add(principal: VerifiedPrincipal, itemId: unknown): Promise<Favorite> {
      const owner = account(principal);
      const id = item(itemId);
      const existing = await find(db, owner, id);
      if (existing) return existing;
      if (!(await hooks.eligible(id))) throw notEligible();
      return transaction(db, async (tx) => {
        await tx.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [lock, owner]);
        const again = await find(tx, owner, id);
        if (again) return again;
        const counted = await tx.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM ${table} WHERE account=$1`,
          [owner],
        );
        if (Number(counted.rows[0]?.count ?? "0") >= bounds.perAccount) throw full();
        const inserted = await tx.query<Row>(
          `INSERT INTO ${table}(account,item) VALUES($1,$2) RETURNING item, ${addedAt} AS added_at`,
          [owner, id],
        );
        const row = inserted.rows[0];
        if (!row) throw new Error("Favorite was not added");
        return favorite(row);
      });
    },
    /** Removes an item; removing one that isn't there is fine. */
    async remove(principal: VerifiedPrincipal, itemId: unknown): Promise<void> {
      await db.query(`DELETE FROM ${table} WHERE account=$1 AND item=$2`, [
        account(principal),
        item(itemId),
      ]);
    },
    /** One favorite, or 404 when the item isn't one. */
    async check(principal: VerifiedPrincipal, itemId: unknown): Promise<Favorite> {
      const found = await find(db, account(principal), item(itemId));
      if (!found) throw notFavorite();
      return found;
    },
    /** A page of the account's favorites, newest first; `next` continues it. */
    async list(principal: VerifiedPrincipal, after?: unknown): Promise<FavoritesPage> {
      const owner = account(principal);
      const from = cursor(after);
      const result = await db.query<Row>(
        `SELECT item, ${addedAt} AS added_at FROM ${table} WHERE account=$1${
          from ? " AND (added_at<$2::timestamptz OR (added_at=$2::timestamptz AND item>$3))" : ""
        } ORDER BY added_at DESC, item ASC LIMIT ${bounds.pageSize + 1}`,
        from ? [owner, ...from] : [owner],
      );
      const items = result.rows.slice(0, bounds.pageSize).map(favorite);
      const last = items.at(-1);
      return { items, next: result.rows.length > bounds.pageSize && last ? next(last) : null };
    },
  };
}
export type Favorites = ReturnType<typeof createFavorites>;

/**
 * Mounts the favorites routes under `base` (`/modules/<lead>/items`): PUT, DELETE and GET of one
 * item, and GET of the list. One item's path is a wildcard, so an ID may be longer than a route
 * parameter. `principal` is the tile's Required sign-in.
 */
export function mountFavorites(
  routes: HttpRoutes,
  options: {
    base: string;
    favorites: Favorites;
    principal(request: FastifyRequest): Promise<VerifiedPrincipal>;
  },
): void {
  const { base, favorites, principal } = options;
  if (!/^\/[A-Za-z0-9/_-]+$/.test(base) || base.endsWith("/"))
    throw new Error("Invalid favorites route");
  const itemOf = (request: FastifyRequest) => (request.params as { "*"?: string })["*"];
  routes.route({
    method: "PUT",
    url: `${base}/*`,
    handler: async (request) => favorites.add(await principal(request), itemOf(request)),
  });
  routes.route({
    method: "DELETE",
    url: `${base}/*`,
    handler: async (request, reply) => {
      await favorites.remove(await principal(request), itemOf(request));
      reply.code(204);
      return reply.send();
    },
  });
  routes.route({
    method: "GET",
    url: `${base}/*`,
    handler: async (request) => favorites.check(await principal(request), itemOf(request)),
  });
  routes.route({
    method: "GET",
    url: base,
    handler: async (request) =>
      favorites.list(await principal(request), (request.query as { after?: unknown }).after),
  });
}

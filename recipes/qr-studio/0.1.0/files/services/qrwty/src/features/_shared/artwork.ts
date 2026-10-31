import { withTransaction } from "@jeeves/postgres-runtime";
import {
  type ArtworkSettings,
  artworkSettingsSchema,
  RENDERER_VERSION,
  renderArtwork,
} from "@jeeves/qr-artwork";
import { publicOrigin, sessionPrincipal } from "@jeeves/rest-server";
import type {
  OperationHandler,
  OperationRequest,
  OperationResponse,
} from "@jeeves/service-runtime";
import artwork from "../../generated/resources/artwork.ts";
import qr from "../../generated/resources/qr.ts";
import { database } from "../../jeeves.generated.ts";

type Queryable = Pick<typeof database.pool, "query">;
type OwnedQr = { id: string; title: string | null; destination: string };
type Revision = {
  id: string;
  savedAt: string;
  canonicalUrl: string;
  rendererVersion: string;
  settings: ArtworkSettings;
  pngSha256: string;
  svgSha256: string;
};
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const field = (name: string) => {
  const found = artwork.fields.find((field) => field.name === name);
  if (!found) throw new Error(`Missing artwork descriptor field: ${name}`);
  return quote(found.column);
};
const parent = quote(artwork.belongsTo.find((relation) => relation.resource === qr.id)!.column);
const table = quote(artwork.table);
const settingsKeys = [
  "foreground",
  "background",
  "moduleStyle",
  "finderStyle",
  "size",
  "quietZone",
  "errorCorrection",
] as const;
const fields = [
  "rendererVersion",
  "canonicalUrl",
  ...settingsKeys,
  "pngSha256",
  "svgSha256",
] as const;
const select = `id, ${[...fields, "savedAt"].map((name) => `${field(name)} AS ${quote(name)}`).join(", ")}`;
const order = `${field("savedAt")} DESC, id DESC`;
const response = (status: number, body: unknown): OperationResponse => ({
  status,
  body,
  headers: { "cache-control": "no-store" },
});
const error = (status: number, code: string, message: string) =>
  response(status, { error: code, message });
const missing = () => error(404, "NOT_FOUND", "No such QR or artwork revision");
const conflict = () =>
  error(
    409,
    "REQUEST_ID_CONFLICT",
    "This save request identifies a different revision. Start a new save.",
  );

async function owned(
  db: Queryable,
  id: unknown,
  ownerId: string,
  lock = false,
): Promise<OwnedQr | undefined> {
  const title = qr.fields.find((field) => field.name === "title")!.column;
  const destination = qr.fields.find((field) => field.name === "destination")!.column;
  const result = await db.query<OwnedQr>(
    `SELECT id, ${quote(title)} AS title, ${quote(destination)} AS destination FROM ${quote(qr.table)} WHERE id=$1 AND owner_id=$2${lock ? " FOR UPDATE" : ""}`,
    [id, ownerId],
  );
  return result.rows[0];
}

function revision(row: Record<string, unknown>): Revision {
  return {
    id: String(row.id),
    savedAt: (row.savedAt as Date).toISOString(),
    canonicalUrl: String(row.canonicalUrl),
    rendererVersion: String(row.rendererVersion),
    settings: artworkSettingsSchema.parse(
      Object.fromEntries(settingsKeys.map((key) => [key, row[key]])),
    ),
    pngSha256: String(row.pngSha256),
    svgSha256: String(row.svgSha256),
  };
}

async function findRevision(
  db: Queryable,
  qrId: string,
  id: unknown,
): Promise<Revision | undefined> {
  const { rows } = await db.query(`SELECT ${select} FROM ${table} WHERE id=$1 AND ${parent}=$2`, [
    id,
    qrId,
  ]);
  return rows[0] && revision(rows[0]);
}

async function canonical(db: Queryable, id: string): Promise<string> {
  const { rows } = await db.query<{ url: string }>(
    `SELECT ${field("canonicalUrl")} AS url FROM ${table} WHERE ${parent}=$1 ORDER BY ${field("savedAt")}, id LIMIT 1`,
    [id],
  );
  return rows[0]?.url ?? `${publicOrigin()}/q/${id}`;
}

function envelope(
  qrId: string,
  canonicalUrl: string,
  settings: ArtworkSettings,
  format: "png" | "svg",
  revisionId?: string,
) {
  const rendered = renderArtwork(canonicalUrl, settings, format);
  const bytesBase64 = rendered.bytes.toString("base64");
  if (bytesBase64.length > 2_000_000)
    throw new Error("This export exceeds the supported artifact size.");
  return {
    bytesBase64,
    contentType: rendered.contentType,
    sha256: rendered.sha256,
    filename: `${qrId}${revisionId ? `-${revisionId}` : ""}.${format}`,
    canonicalUrl,
    rendererVersion: rendered.rendererVersion,
    checks: rendered.checks,
  };
}

/** The runtime already checks sessions/Origin/CSRF; each operation also scopes its resource. */
function owner(request: OperationRequest) {
  const principal = sessionPrincipal(request.request);
  if (!principal) throw new Error("Owner operation reached without an authenticated session");
  return principal.id;
}

export const readQrStudio: OperationHandler = async (request) => {
  const record = await owned(database.pool, request.params.id, owner(request));
  if (!record) return missing();
  const limit = Number(request.query.limit ?? 12);
  const cursor = request.query.cursor;
  // Cursor lookup is bounded to this already-authorized parent, including its precise DB timestamp.
  if (cursor && !(await findRevision(database.pool, record.id, cursor)))
    return error(400, "INVALID_CURSOR", "Choose a cursor from this QR's revision history.");
  const { rows } = await database.pool.query(
    `SELECT ${select} FROM ${table} WHERE ${parent}=$1${cursor ? ` AND (${field("savedAt")}, id) < (SELECT ${field("savedAt")}, id FROM ${table} WHERE id=$3 AND ${parent}=$1)` : ""} ORDER BY ${order} LIMIT $2`,
    cursor ? [record.id, limit + 1, cursor] : [record.id, limit + 1],
  );
  const items = rows.slice(0, limit).map(revision);
  return response(200, {
    qr: record,
    canonicalUrl: await canonical(database.pool, record.id),
    items,
    nextCursor: rows.length > limit ? items.at(-1)!.id : null,
  });
};

export const previewQrArtwork: OperationHandler = async (request) => {
  const record = await owned(database.pool, request.params.id, owner(request));
  if (!record) return missing();
  const parsed = artworkSettingsSchema.safeParse((request.body as { settings: unknown }).settings);
  if (!parsed.success)
    return error(400, "INVALID_ARTWORK", parsed.error.issues[0]?.message ?? "Invalid settings");
  const url = await canonical(database.pool, record.id);
  try {
    return response(200, envelope(record.id, url, parsed.data, "png"));
  } catch (cause) {
    return error(
      400,
      "INVALID_ARTWORK",
      cause instanceof Error ? cause.message : "Unable to render these settings",
    );
  }
};

export const saveQrArtwork: OperationHandler = async (request) => {
  const principal = owner(request);
  const body = request.body as { requestId: string; settings: unknown };
  return withTransaction(database.pool, async (db) => {
    // Serialize saves for a parent, including the first canonical-URL choice and retries.
    const record = await owned(db, request.params.id, principal, true);
    if (!record) return missing();
    const parsed = artworkSettingsSchema.safeParse(body.settings);
    if (!parsed.success)
      return error(400, "INVALID_ARTWORK", parsed.error.issues[0]?.message ?? "Invalid settings");
    const existing = await findRevision(db, record.id, body.requestId);
    if (existing)
      return JSON.stringify(existing.settings) === JSON.stringify(parsed.data)
        ? response(200, existing)
        : conflict();
    const canonicalUrl = await canonical(db, record.id);
    let png: ReturnType<typeof envelope>, svg: ReturnType<typeof envelope>;
    try {
      png = envelope(record.id, canonicalUrl, parsed.data, "png", body.requestId);
      svg = envelope(record.id, canonicalUrl, parsed.data, "svg", body.requestId);
    } catch (cause) {
      return error(
        400,
        "INVALID_ARTWORK",
        cause instanceof Error ? cause.message : "Unable to render these settings",
      );
    }
    const values = [
      body.requestId,
      record.id,
      RENDERER_VERSION,
      canonicalUrl,
      ...settingsKeys.map((key) => parsed.data[key]),
      png.sha256,
      svg.sha256,
    ];
    const inserted = await db.query(
      `INSERT INTO ${table} (id, ${parent}, ${fields.map(field).join(", ")}) VALUES (${values.map((_, i) => `$${i + 1}`).join(", ")}) ON CONFLICT (id) DO NOTHING RETURNING ${select}`,
      values,
    );
    if (!inserted.rows[0]) return conflict();
    return response(201, revision(inserted.rows[0]));
  });
};

export const exportQrArtwork: OperationHandler = async (request) => {
  const record = await owned(database.pool, request.params.id, owner(request));
  if (!record) return missing();
  const saved = await findRevision(database.pool, record.id, request.params.revision);
  if (!saved) return missing();
  if (saved.rendererVersion !== RENDERER_VERSION)
    throw new Error("The saved renderer is unavailable; retain pinned renderer versions.");
  const format = request.query.format as "png" | "svg";
  const artifact = envelope(record.id, saved.canonicalUrl, saved.settings, format, saved.id);
  if (artifact.sha256 !== saved[format === "png" ? "pngSha256" : "svgSha256"])
    throw new Error("Saved artwork hash does not match the pinned renderer output.");
  return response(200, artifact);
};

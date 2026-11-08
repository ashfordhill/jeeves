import type { FastifyRequest } from "fastify";
import { creatorToken } from "../clients/upload-auth.ts";
import { connect as jobs } from "../clients/upload-jobs.ts";
import { connect as state } from "../clients/upload-state-writer.ts";
import { uuid } from "../contracts/v1.ts";
import { UploadMultipart } from "../extensions/upload-multipart.ts";
import { createHttpService, HttpError } from "../lib/http.ts";
import { objects } from "../lib/objects.ts";
import { startRelay } from "../lib/outbox.ts";

async function principal(req: FastifyRequest) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ") || auth.length > 16384)
    throw new HttpError(401, "SIGN_IN_REQUIRED", "Sign in again to manage uploads.");
  let token;
  try {
    token = await creatorToken(auth.slice(7));
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 403)
      throw new HttpError(403, "CREATOR_REQUIRED", "A creator account is required.");
    throw new HttpError(
      401,
      "SIGN_IN_REQUIRED",
      "Your sign-in is invalid or expired. Sign in again.",
    );
  }
  if (!token.sub || token.sub.length > 255)
    throw new HttpError(401, "SIGN_IN_REQUIRED", "Sign in again.");
  const username =
    typeof token.preferred_username === "string" ? token.preferred_username.trim() : "";
  return { sub: token.sub, channel: (username || token.sub).slice(0, 200) };
}
function id(req: FastifyRequest) {
  const parsed = uuid.safeParse((req.params as { uploadId?: string }).uploadId);
  if (!parsed.success) throw new HttpError(400, "UPLOAD_ID", "Invalid upload identity.");
  return parsed.data;
}
const pool = state(),
  control = objects(),
  signing = objects(true);
pool.on("error", () => console.error("Upload database unavailable"));
const multipart = new UploadMultipart(pool, control, signing);
let publisher: Awaited<ReturnType<typeof jobs>> | undefined;
let stopRelay: (() => Promise<void>) | undefined;
let stopped = false,
  timer: ReturnType<typeof setTimeout> | undefined;
let sweeping: Promise<unknown> = Promise.resolve();
const sweep = () => {
  sweeping = multipart
    .sweep()
    .catch(() => console.error("Upload reconciliation deferred"))
    .finally(() => {
      if (!stopped) timer = setTimeout(sweep, 30000);
    });
};
const service = await createHttpService(
  "upload",
  { concurrencyLimit: 500, requestTimeoutMs: 5000 },
  (app) => {
    app.get("/me", async (req) => principal(req));
    app.post("/uploads", async (req, reply) => {
      const p = await principal(req);
      const r = await multipart.start(p, req.body);
      reply.code(201);
      return r;
    });
    app.get("/uploads", async (req) => multipart.list((await principal(req)).sub));
    app.get("/uploads/:uploadId", async (req) => {
      const p = await principal(req);
      return multipart.status(id(req), p.sub);
    });
    app.post("/uploads/:uploadId/parts/:partNumber", async (req) => {
      const p = await principal(req),
        raw = (req.params as { partNumber: string }).partNumber;
      if (!/^\d{1,3}$/.test(raw)) throw new HttpError(400, "PART_NUMBER", "Invalid part number.");
      return multipart.sign(id(req), p.sub, Number(raw));
    });
    app.post("/uploads/:uploadId/complete", async (req, reply) => {
      const p = await principal(req);
      const r = await multipart.complete(id(req), p.sub);
      reply.code(202);
      return r;
    });
    app.post("/uploads/:uploadId/abort", async (req) => {
      const p = await principal(req);
      return multipart.abort(id(req), p.sub);
    });
  },
  async () => {
    await pool.query("SELECT upload_id FROM video_private.uploads LIMIT 0");
    await control.send(
      new (await import("@aws-sdk/client-s3")).ListMultipartUploadsCommand({
        Bucket: "youtube-v1-originals",
        MaxUploads: 1,
      }),
      { abortSignal: AbortSignal.timeout(4000) },
    );
    await fetch("http://identity:8080/realms/youtube-v1/protocol/openid-connect/certs", {
      signal: AbortSignal.timeout(4000),
    }).then((r) => {
      if (!r.ok) throw new Error("Identity unavailable");
    });
    publisher = await jobs();
  },
);
let shutdown: Promise<void> | undefined;
function close() {
  return (shutdown ??= (async () => {
    stopped = true;
    clearTimeout(timer);
    await service.close();
    await sweeping;
    await stopRelay?.();
    await publisher?.close();
    await pool.end();
    control.destroy();
    signing.destroy();
  })());
}
try {
  await service.start();
  stopRelay = startRelay(pool, "upload-jobs", publisher!);
  sweep();
  let requestStop!: (value: { fatal: boolean }) => void;
  const requested = new Promise<{ fatal: boolean }>((resolve) => {
    requestStop = resolve;
  });
  const onSignal = () => requestStop({ fatal: false });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, onSignal);
  const { fatal } = await Promise.race([publisher!.closed, requested]);
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.removeListener(signal, onSignal);
  if (fatal) process.exitCode = 1;
  await close();
} catch {
  console.error("Upload startup failed; inspect provider readiness and migrations.");
  process.exitCode = 1;
  await close();
}

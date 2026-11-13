// Generated scaffold: Upload API (Uploads) runs as app-upload-api, an HTTP process.
// Export rewrites this file. Write modules in src/modules/; .jeeves/report.json lists what runs.
import { objects, pool, publisher, resource, selected } from "../features/service-resources.ts";
import { uploadApiMultipartUploadsHooks } from "../modules/upload-api/upload-api-multipart-uploads.hooks.ts";
import { videoLifecycleLifecycleWriterHooks } from "../modules/video-lifecycle/video-lifecycle-lifecycle-writer.hooks.ts";
import { createAssetLifecycle } from "../runtime/asset-lifecycle.ts";
import { createHttpService } from "../runtime/http.ts";
import { createPrincipalVerifier } from "../runtime/identity.ts";
import { createMultipartHttpHandlers } from "../runtime/multipart-http.ts";
import { createMultipartObjects } from "../runtime/multipart-objects.ts";
import { createOwnedMultipart } from "../runtime/multipart.ts";
import { createOutbox, startRelay } from "../runtime/outbox.ts";
import { createOwnedUploads } from "../runtime/owned-upload.ts";
import { periodic, runProcess } from "../runtime/process.ts";
import { createTileGuard } from "../runtime/tile-guard.ts";
import { notImplementedRoutes } from "../runtime/tile-http.ts";
import { createFailureLog, createNotImplementedLog, logStarted } from "../runtime/tile-process.ts";
import { type Tx, transaction } from "../runtime/transaction.ts";

/** Compiled configuration: nothing is read from disk at runtime. */
export const config = {
  "tile": "upload-api",
  "kind": "uploads",
  "shape": "http",
  "exposure": "public",
  "settings": {
    "requestTimeoutMs": 5000,
    "concurrencyLimit": 500
  },
  "listen": {
    "host": "0.0.0.0",
    "port": 3000
  },
  "templates": {
    "upload-api-creator-check": {
      "template": "verified-identity",
      "lead": "upload-api-creator-check",
      "identity": "sign-in",
      "signIn": "required",
      "me": "/modules/upload-api-creator-check/me"
    },
    "upload-api-multipart-uploads": {
      "template": "owned-multipart",
      "lead": "upload-api-multipart-uploads",
      "identity": "sign-in",
      "prefix": "upload-api-multipart-uploads/",
      "uploads": {
        "schema": "upload_api_multipart_uploads",
        "table": "uploads"
      },
      "outbox": {
        "schema": "upload_api_multipart_uploads",
        "table": "outbox",
        "destinations": [
          "jobs",
          "publication"
        ]
      },
      "metadata": {
        "assetId": "asset-id",
        "uploadId": "upload-id",
        "sha256": "sha256",
        "expectedSize": "expected-size"
      },
      "mounts": [
        {
          "operation": "start",
          "method": "POST",
          "url": "/modules/upload-api-multipart-uploads/uploads"
        },
        {
          "operation": "list",
          "method": "GET",
          "url": "/modules/upload-api-multipart-uploads/uploads"
        },
        {
          "operation": "status",
          "method": "GET",
          "url": "/modules/upload-api-multipart-uploads/uploads/:uploadId"
        },
        {
          "operation": "sign",
          "method": "POST",
          "url": "/modules/upload-api-multipart-uploads/uploads/:uploadId/parts/:partNumber"
        },
        {
          "operation": "complete",
          "method": "POST",
          "url": "/modules/upload-api-multipart-uploads/uploads/:uploadId/complete"
        },
        {
          "operation": "abort",
          "method": "POST",
          "url": "/modules/upload-api-multipart-uploads/uploads/:uploadId/abort"
        }
      ],
      "lifecycle": {
        "selection": "video-lifecycle-lifecycle-writer",
        "binding": {
          "relation": {
            "schema": "upload_api_multipart_uploads",
            "table": "assets"
          },
          "receipts": {
            "schema": "upload_api_multipart_uploads",
            "table": "receipts"
          },
          "receiptScope": "video-lifecycle-lifecycle-writer",
          "outbox": {
            "schema": "upload_api_multipart_uploads",
            "table": "outbox",
            "destinations": [
              "jobs",
              "publication"
            ]
          },
          "jobsDestination": "jobs"
        },
        "publication": "publication"
      }
    }
  }
} as const;

await runProcess(async (scope) => {
  // A failure the process survives writes one error line, at most once a second for each.
  const failure = createFailureLog(config.tile);
  // "Not implemented" answers 501 with one log line per module and hook a second.
  const log = createNotImplementedLog(config.tile);
  // Creator check: the tile's sign-in, Required: every module route needs a valid token.
  const uploadApiCreatorCheck = (() => {
    const binding = config.templates["upload-api-creator-check"];
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
  // Multipart uploads: the multipart engine on its tables, objects and jobs outbox.
  const uploadApiMultipartUploads = await (async () => {
    const s = selected("owned-multipart", "upload-api-multipart-uploads");
    const binding = config.templates["upload-api-multipart-uploads"];
    const db = pool(scope, s, "state");
    const control = objects(s);
    const signing = objects(s, process.env.OBJECT_PUBLIC_ENDPOINT);
    scope.own(() => {
      control.destroy();
      signing.destroy();
    });
    // The asset lifecycle that names this upload: its upload hooks run in this tile's
    // transactions on the tables it shares with the lifecycle's worker.
    const lifecycleHooks = videoLifecycleLifecycleWriterHooks();
    const lifecycle = createAssetLifecycle(
      { ...binding.lifecycle.binding, identities: lifecycleHooks.identities },
      {
        ...lifecycleHooks,
        publication: {
          ...lifecycleHooks.publication,
          destination: binding.lifecycle.publication,
        },
      },
    );
    const hooks = uploadApiMultipartUploadsHooks({
      prefix: binding.prefix,
      guard: uploadApiCreatorCheck,
      lifecycle: lifecycle.uploadHooks,
    });
    const multipart = createOwnedMultipart({
      repository: createOwnedUploads(
        { ...binding.uploads, originalKey: hooks.originalKey },
        hooks.upload,
      ),
      transaction: <T>(effect: (tx: Tx) => Promise<T>) => transaction(db, effect),
      objects: createMultipartObjects({
        control,
        signing,
        bucket: resource(s, "objects"),
        prefix: binding.prefix,
        ownsKey: () => true,
        metadata: binding.metadata,
      }),
      onFailure: (what, error, extra) => failure(`${what} upload-api-multipart-uploads`, error, extra),
    });
    const jobs = await publisher(s, "jobs", scope);
    scope.own(() => jobs.close());
    scope.transport(jobs);
    const relay = startRelay(createOutbox(binding.outbox, "jobs", hooks.job), db, jobs, {
      onError: (error) => failure("outbox relay jobs", error),
    });
    scope.own(() => relay.close());
    return {
      db,
      multipart,
      http: createMultipartHttpHandlers({ multipart, principal: hooks.principal }),
    };
  })();
  const service = await createHttpService({
    id: config.tile,
    settings: config.settings,
    onFailure: failure,
    configure: (open) => {
      // Every module route checks its caller first: the tile's sign-in.
      const routes = uploadApiCreatorCheck.routes(open);
      uploadApiCreatorCheck.me(routes, "/modules/upload-api-creator-check/me");
      uploadApiMultipartUploads.http.mount(
        notImplementedRoutes(routes, log, "upload-api-multipart-uploads"),
        config.templates["upload-api-multipart-uploads"].mounts,
      );
    },
    initialize: async () => {
      await uploadApiMultipartUploads.db.query("SELECT 1");
      for (const item of (await uploadApiMultipartUploads.multipart.sweep()).failed) failure("sweep upload-api-multipart-uploads", item.error, { upload: item.uploadId });
    },
  });
  // Draining stops admission first, then waits for admitted requests.
  scope.own(() => service.close());
  await service.start(config.listen);
  periodic(scope, async () => { for (const item of (await uploadApiMultipartUploads.multipart.sweep()).failed) failure("sweep upload-api-multipart-uploads", item.error, { upload: item.uploadId }); }, 30000, (error) => failure("sweep upload-api-multipart-uploads", error));
  logStarted(config.tile, {"module":"upload-api-creator-check","template":"verified-identity","wiring":"mounted","checks":["sign-in Required on every module route"]});
  logStarted(config.tile, {"module":"upload-api-multipart-uploads","template":"owned-multipart","wiring":"mounted","checks":["jobs publisher open","outbox relay started","SELECT 1 on its state login","sweep at start","sweep every 30 s"]});
  scope.ready();
});

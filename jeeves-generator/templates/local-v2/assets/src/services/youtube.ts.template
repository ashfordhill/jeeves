import { verifyVideoRuntime } from "../features/video-runtime.ts";
import { relations } from "../features/application-bindings.ts";
import {
	selected,
	input,
	resource,
	pool,
	publisher,
	consumer,
	objects,
	httpSettings,
} from "../features/service-resources.ts";
import { runProcess, periodic, type ProcessScope } from "../runtime/process.ts";
import { transaction, type Tx } from "../runtime/transaction.ts";
import { createHttpService, type HttpRoutes } from "../runtime/http.ts";
import { createPrincipalVerifier } from "../runtime/identity.ts";
import { startRelay } from "../runtime/outbox.ts";
import { startAssetLifecycleWorker } from "../runtime/asset-worker.ts";
import { startMediaWorker } from "../runtime/media-worker.ts";
import { createMediaObjects } from "../runtime/media-objects.ts";
import { startCounterWorker } from "../runtime/counter-worker.ts";
import { createValkeyCache } from "../runtime/valkey.ts";
import { createSearch } from "../runtime/search.ts";
import { assertSearchIndex } from "../runtime/search-schema.ts";
import { startSearchIndexer } from "../runtime/search-indexer.ts";
import { publicVideoMapping } from "../features/public-video.ts";
import { originalIdentity, resultPrefix } from "../features/video-paths.ts";
import { createYouTubeLifecycle } from "../adapters/youtube-lifecycle.ts";
import {
	createYouTubeUpload,
	createCreatorPrincipal,
	mountYouTubeUpload,
} from "../adapters/youtube-upload.ts";
import { createYouTubeMultipartObjects } from "../adapters/youtube-objects.ts";
import { youtubeMediaCodecs } from "../adapters/youtube-events.ts";
import {
	createYouTubeReadyReader,
	createYouTubeTotalReader,
	mountYouTubeWatch,
} from "../adapters/youtube-watch.ts";
import { createYouTubeViewCounter } from "../adapters/youtube-counter.ts";
import { createYouTubeSearchProjection } from "../adapters/youtube-projection.ts";
import {
	createYouTubeSearch,
	mountYouTubeSearch,
} from "../adapters/youtube-search.ts";

function lifecycle() {
	return createYouTubeLifecycle({
		binding: {
			relation: relations.assets,
			receipts: relations.receipts,
			receiptScope: "processing",
			outbox: {
				...relations.outbox,
				destinations: [...relations.outbox.destinations],
			},
			jobsDestination: "jobs",
		},
		publicationDestination: "publication",
	});
}
async function http(
	scope: ProcessScope,
	kind: string,
	configure: (routes: HttpRoutes) => void,
	initialize: () => Promise<void>,
) {
	const s = selected(kind);
	const server = await createHttpService({
		id: s.host,
		settings: httpSettings(s),
		configure,
		initialize,
	});
	scope.own(() => server.close());
	await server.start({ host: "0.0.0.0", port: 3000 });
}
await runProcess(async (scope) => {
	const role = process.argv[2];
	if (role === "upload") {
		const s = selected("owned-multipart"),
			db = pool(scope, s, "state"),
			life = lifecycle();
		const control = objects(s),
			signing = objects(s, process.env.OBJECT_PUBLIC_ENDPOINT);
		scope.own(() => {
			control.destroy();
			signing.destroy();
		});
		const multipart = createYouTubeUpload({
			binding: relations.uploads,
			lifecycle: life,
			transaction: <T>(effect: (tx: Tx) => Promise<T>) =>
				transaction(db, effect),
			objects: createYouTubeMultipartObjects({
				control,
				signing,
				bucket: resource(s, "objects"),
			}),
		});
		const pub = await publisher(s, "jobs", scope);
		scope.own(() => pub.close());
		scope.transport(pub);
		const relay = startRelay(life.jobs, db, pub);
		scope.own(() => relay.close());
		const identity = s.identity;
		if (!identity) throw Error("Verified identity binding required");
		const verify = createPrincipalVerifier({
			issuer: process.env.OIDC_ISSUER!,
			audience: `${identity}-web`,
			jwksUrl: process.env.OIDC_JWKS_URL!,
			algorithms: ["RS256"],
			jwksTimeoutMs: 3000,
		});
		await http(
			scope,
			"owned-multipart",
			(routes) =>
				mountYouTubeUpload(routes, {
					multipart,
					lifecycle: life,
					transaction: <T>(effect: (tx: Tx) => Promise<T>) =>
						transaction(db, effect),
					principal: createCreatorPrincipal(verify),
				}),
			async () => {
				await db.query("SELECT 1");
				await multipart.sweep();
			},
		);
		periodic(scope, () => multipart.sweep(), 30000);
	} else if (role === "lifecycle") {
		const s = selected("asset-lifecycle"),
			db = pool(scope, s, "state"),
			life = lifecycle();
		const worker = await startAssetLifecycleWorker({
			pool: db,
			lifecycle: life,
			openConsumer: (handle) =>
				consumer(s, "results", handle, { onFatal: scope.fail }),
			publication: {
				outbox: life.publications!,
				openPublisher: () => publisher(s, "publication", scope),
			},
		});
		scope.own(() => worker.close());
		scope.transport(worker);
	} else if (role === "media") {
		const s = selected("video-hls");
		await verifyVideoRuntime();
		const source = objects(s),
			results = objects(s);
		const worker = await startMediaWorker({
			codecs: youtubeMediaCodecs,
			objects: createMediaObjects({
				source: {
					client: source,
					bucket: resource(s, "originals"),
					owns: (job) => {
						const id = originalIdentity(job.source.key);
						return id.videoId === job.assetId;
					},
				},
				results: {
					client: results,
					bucket: resource(s, "outputs"),
					owns: (job) =>
						job.resultPrefix ===
						resultPrefix(job.assetId, job.jobId, job.attemptId),
				},
				sha256Metadata: "sha256",
			}),
			openPublisher: () => publisher(s, "results", scope),
			openConsumer: ({ handle, ...hooks }) =>
				consumer(s, "jobs", handle, hooks),
			onFatal: scope.fail,
		});
		scope.own(() => worker.close());
		scope.transport(worker);
	} else if (role === "watch") {
		const s = selected("positive-cache-read"),
			watch = selected("youtube-watch"),
			db = pool(scope, s, "source"),
			totals = pool(scope, watch, "counts"),
			cacheId = resource(s, "cache");
		const cache = await createValkeyCache({
			binding: {
				hostname: `cache-${cacheId}`,
				port: 6379,
				secret: `cache-${cacheId}`,
			},
		});
		scope.own(() => cache.close());
		const pub = await publisher(watch, "events", scope);
		scope.own(() => pub.close());
		scope.transport(pub);
		const read = createYouTubeReadyReader({
			pool: db,
			view: relations.ready,
			ttlSeconds: input(s, "cache.ttlSeconds"),
			cache,
		});
		const total = createYouTubeTotalReader({
			pool: totals,
			view: relations.totals,
		});
		await http(
			scope,
			"positive-cache-read",
			(routes) => mountYouTubeWatch(routes, { read, total, publisher: pub }),
			async () => {
				await db.query('SELECT * FROM "asset_public"."ready" LIMIT 0');
				await totals.query('SELECT * FROM "count_public"."totals" LIMIT 0');
			},
		);
	} else if (role === "counter") {
		const s = selected("event-counter"),
			db = pool(scope, s, "state");
		await db.query("SELECT 1");
		const worker = await startCounterWorker({
			pool: db,
			counter: createYouTubeViewCounter(relations.counts),
			openConsumer: (handle) =>
				consumer(s, "events", handle, { onFatal: scope.fail }),
		});
		scope.own(() => worker.close());
		scope.transport(worker);
	} else if (role === "indexer" || role === "search") {
		const s = selected(
				role === "indexer" ? "search-projection" : "search-query",
			),
			index = resource(s, "index");
		const client = createSearch({
			endpoint: `http://search-${index}:9200`,
			requestTimeoutMs:
				role === "search" ? input(s, "host.requestTimeoutMs") : 5000,
		});
		scope.own(() => client.close());
		const binding = { index, ...publicVideoMapping };
		await assertSearchIndex(client, binding);
		if (role === "indexer") {
			const worker = await startSearchIndexer({
				projection: createYouTubeSearchProjection({ client, binding }),
				openConsumer: (handle) =>
					consumer(s, "events", handle, { onFatal: scope.fail }),
			});
			scope.own(() => worker.close());
			scope.transport(worker);
		} else
			await http(
				scope,
				"search-query",
				(routes) =>
					mountYouTubeSearch(routes, createYouTubeSearch({ client, binding })),
				async () => {},
			);
	} else throw Error("Unknown explicit service role");
	scope.ready();
});

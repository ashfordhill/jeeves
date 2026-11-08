/**
 * The YouTube study, version 2: a video-sharing site with YouTube's core functionality (upload,
 * transcode, stream, search, view counts), designed as clean microservices from Alex Xu's "Design
 * YouTube" (ByteByteGo) and the other published designs, mapped to Jeeves tiles and templates.
 * Design intent only.
 *
 * In lanes: the user watches (download, the **Watch** action) through the Watch API (a video's
 * details from its own cache or the database, the view count, and each view), the Search API and
 * the Video CDN (segments, playlists and thumbnails), and publishes (upload, the **Publish**
 * action) through Identity (sign-in) and the Upload service (an Uploads service: it starts, signs
 * and completes a multipart upload into Original videos and queues a job).
 *
 * Xu's boxes and what each became:
 * - Original storage, transcoding servers, transcoded storage, completion queue, completion
 *   handler, metadata DB: Original videos, Transcoder, Transcoded videos, Completion events,
 *   Completion handler, Metadata database.
 * - API servers: one service per responsibility the reader should see (Watch API, Search API,
 *   Upload service).
 * - The upload with a pre-signed URL: the Upload service, an Uploads service whose Transfer is
 *   signed URLs. The client asks the service first (sign-in, checks), then sends the parts
 *   straight to storage with the URLs it signed, and the service completes the upload. A user
 *   never reaches storage on the canvas.
 * - The metadata cache: Metadata cache, owned and filled by the Watch API (below).
 * - The transcoding DAG (preprocessor, DAG scheduler, resource manager, task workers, temporary
 *   storage): the Transcoder's modules, not tiles.
 * - The load balancer: none; a service's replicas imply it. No gateway either (it would be each
 *   action's only entry and hide which services a viewer and a creator reach).
 * - The CDN: the Video CDN pulls from Transcoded videos (its origin); the pipeline doesn't push.
 *
 * What the other sources add, and what each tile traces to:
 * - All four: originals in object storage, uploaded in parts that can resume; ByteByteGo,
 *   HelloInterview and the crash course send them from the client with pre-signed URLs (AWS's
 *   multipart pattern: the backend starts the upload, signs a URL per part and completes it).
 * - All four: processing is asynchronous, behind a queue (Upload jobs), and encodes each video at
 *   several resolutions and bitrates. ByteByteGo, HelloInterview and the crash course split it
 *   into segments with HLS or DASH playlists, and a CDN serves them while the player picks each
 *   segment's bitrate (Video CDN). Grokking and ByteByteGo make thumbnails in the pipeline.
 * - HelloInterview: a metadata cache partitioned by video ID, least recently used evicted first
 *   (Metadata cache).
 * - Grokking and the crash course: metadata in MySQL, sharded by video ID, with replicas for
 *   reads; YouTube built Vitess to shard its MySQL.
 * - The crash course: a search service over an index filled when a video becomes playable
 *   (Search API, Search indexer, Search index); view counts in their own store, eventually
 *   consistent (View events, View counter, View counts; Reddit counts views from events too).
 *
 * Design decisions:
 * - One writer per store. Xu has two writers of the metadata (the API servers during the
 *   upload, the completion handler after). Here the title and description ride in the upload job
 *   and the completion event, and the Completion handler writes the video's record once, when it
 *   can be played. The Upload service keeps no database: the multipart upload is the upload's
 *   state.
 * - The Transcoder writes only its own output (Transcoded videos) and announces each video on
 *   Completion events, a topic. The Completion handler and the Search indexer both consume it, so
 *   the transcoder writes no record and no index; the event carries the title, description,
 *   channel, duration, playlist and thumbnails both need.
 * - The metadata cache is the Watch API's own (cache-aside, as TinyURL's URL cache): it reads
 *   the cache, reads a replica on a miss and fills the cache for an hour. Xu's completion handler
 *   writes the cache; here it writes only the database, because a video's record is written once
 *   and never edited (editing is left out), a write-through cache would never refill a video it
 *   evicted, and a reader that fills a cache another tile writes would be a second writer.
 * - Views: the Watch API publishes each view the player reports, and the View counter sums them
 *   per video and adds them in batches.
 * - Thumbnails are stored once, at full size, beside the segments; the Video CDN resizes them on
 *   request.
 * - Cloudflare R2 behind the Cloudflare CDN: R2 charges no egress, and ByteByteGo names CDN
 *   traffic the largest cost. Cloudflare's terms want video on its CDN served through a paid
 *   product such as its developer platform, of which R2 is part.
 * - Services verify Identity's signed tokens themselves (the Upload service's creator check), so
 *   no line runs to Identity.
 * - Left out: comments, likes, recommendations, subscriptions, monetisation and live streaming;
 *   editing a video after upload and custom thumbnails; telling the creator the video is ready
 *   (Xu's last step: no line runs to the user; the creator's app asks the Watch API).
 *
 * Where YouTube differs: it is far larger (its own pipeline stages, recommendations, ads) and grew
 * from one MySQL database to replicas, then shards behind Vitess, which it built.
 *
 * Sources:
 * - ByteByteGo (Alex Xu), Design YouTube:
 *   https://bytebytego.com/courses/system-design-interview/design-youtube
 * - HelloInterview, YouTube:
 *   https://www.hellointerview.com/learn/system-design/problem-breakdowns/youtube
 * - DesignGurus (Grokking), Designing YouTube or Netflix:
 *   https://www.designgurus.io/course-play/grokking-the-system-design-interview/doc/designing-youtube-or-netflix
 * - DesignGurus, System Design Interview Crash Course, Design YouTube:
 *   https://www.designgurus.io/course-play/system-design-interview-crash-course/doc/design-youtube
 * - Vitess, History: https://vitess.io/docs/overview/history/
 * - AWS, Uploading large objects to Amazon S3 using multipart upload and transfer acceleration:
 *   https://aws.amazon.com/blogs/compute/uploading-large-objects-to-amazon-s3-using-multipart-upload-and-transfer-acceleration/
 * - AWS, Uploading and copying objects using multipart upload:
 *   https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html
 * - tus, resumable upload protocol: https://tus.io/; tusd: https://tus.github.io/tusd/
 * - AWS, ElastiCache caching strategies (lazy loading, write-through):
 *   https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html
 * - Martin Kleppmann, Using logs to build a solid data infrastructure (or: why dual writes are a
 *   bad idea):
 *   https://www.confluent.io/blog/using-logs-to-build-a-solid-data-infrastructure-or-why-dual-writes-are-a-bad-idea/
 * - Reddit, View counting at Reddit: https://www.redditinc.com/blog/view-counting-at-reddit/
 * - Cloudflare, R2 pricing: https://developers.cloudflare.com/r2/pricing/
 * - Cloudflare, Service-specific terms (CDN):
 *   https://www.cloudflare.com/service-specific-terms-application-services/
 */
import type { StudioComponent, StudioComponentConnection } from "../studio-components.ts";
import type { StudioEntry, StudioLaneAction } from "../studio-model.ts";
import type { StudioConnectionCreation } from "../studio-operations.ts";
import { createStudioStudy } from "./study.ts";

const description =
  "A video-sharing site after Alex Xu's design: creators upload in parts with URLs an upload service signs; a transcoder writes streamable segments, playlists and thumbnails for a CDN and announces each video; a completion handler records it and an indexer adds it to search; views are counted in batches.";

export const YOUTUBE_STUDIO_EXAMPLE = {
  id: "studio-youtube",
  version: "2.1.0",
  name: "YouTube · studio study",
  description,
  /** SHA-256 of `description`, the study's goal. */
  goalManifestSha256: "4e8ea30c860ba3b1fa32e75ec6f293e2d65ba6646248425427012053785de312",
} as const;

const call = (
  label: string,
  protocol: "HTTPS" | "SQL" | "Redis",
): StudioConnectionCreation["planned"] => ({
  label,
  protocol,
  interaction: "Request / response",
  security: "Service identity",
});
const messaging = (label: string): StudioConnectionCreation["planned"] => ({
  label,
  protocol: "Messaging",
  interaction: "Asynchronous",
  security: "Service identity",
});
const dataAccess = (
  poolSize: number,
  statementTimeoutMs: number,
  readRouting: "primary" | "replica" = "primary",
) => ({ kind: "data-access", poolSize, readRouting, statementTimeoutMs }) as const;

const components: StudioComponent[] = [
  // Watch API: a video's details (its own cache, then a replica), its view count, and each view.
  {
    id: "watch-cache-reader",
    host: "watch",
    name: "Details cache",
    description:
      "Cache-aside: looks a video up in the Metadata cache; on a miss reads a replica and fills the cache for an hour.",
    settings: {
      kind: "cache-reader",
      pattern: "cache-aside",
      l2TtlSeconds: 3600,
      stampede: "single-flight",
    },
  },
  {
    id: "watch-details",
    host: "watch",
    name: "Details reader",
    description: "Reads a video's title, description, channel and playlist from a replica.",
    settings: dataAccess(50, 500, "replica"),
  },
  {
    id: "watch-counts",
    host: "watch",
    name: "View count reader",
    description: "Reads a video's view count.",
    settings: dataAccess(20, 500),
  },
  {
    id: "watch-views",
    host: "watch",
    name: "View publisher",
    description: "Publishes each view the player reports, in batches.",
    settings: { kind: "event-publisher", batchSize: 500, lingerMs: 50, outbox: "disabled" },
  },
  // View counter: View counts' only writer.
  {
    id: "counter-consumer",
    host: "view-counter",
    name: "View consumer",
    description: "Consumes views in batches with bounded retries.",
    settings: { kind: "event-consumer", concurrency: 8, batchSize: 1000, retryLimit: 5 },
  },
  {
    id: "counter-sum",
    host: "view-counter",
    name: "View summer",
    description: "Sums views per video for a few seconds before writing.",
    settings: { kind: "custom" },
  },
  {
    id: "counter-writer",
    host: "view-counter",
    name: "Count writer",
    description: "Adds each video's summed views to its count.",
    settings: dataAccess(10, 2000),
  },
  // Search API.
  {
    id: "search-query",
    host: "search",
    name: "Video search",
    description: "Queries the index by title, description and channel, a page at a time.",
    settings: { kind: "custom" },
  },
  // Upload service: Original videos' only writer, by signed URLs; no database.
  {
    id: "upload-auth",
    host: "upload",
    name: "Creator check",
    description: "Accepts only signed-in creators, by Identity's token.",
    settings: { kind: "auth-guard", credential: "jwt" },
  },
  {
    id: "upload-multipart",
    host: "upload",
    name: "Multipart uploads",
    description:
      "Starts a multipart upload, signs a URL for each part, lists the parts that arrived so the creator can resume, and completes it.",
    settings: { kind: "custom" },
  },
  {
    id: "upload-jobs",
    host: "upload",
    name: "Job publisher",
    description:
      "Publishes an upload job once the upload completes, with the video's ID, channel, title and description.",
    settings: { kind: "event-publisher", outbox: "disabled" },
  },
  // Transcoder: Transcoded videos' only writer; it announces each video and records nothing.
  {
    id: "transcoder-consumer",
    host: "transcoder",
    name: "Job consumer",
    description: "Takes one upload job at a time with bounded retries.",
    settings: { kind: "event-consumer", concurrency: 1, retryLimit: 3 },
  },
  {
    id: "transcoder-encoder",
    host: "transcoder",
    name: "Segmenter and encoder",
    description:
      "Reads the original and encodes it, in segments of a few seconds, at each resolution and bitrate (ffmpeg); Xu's task DAG runs here.",
    settings: { kind: "custom" },
  },
  {
    id: "transcoder-packager",
    host: "transcoder",
    name: "Packager",
    description: "Stores the segments with an HLS playlist per rendition and one master playlist.",
    settings: { kind: "custom" },
  },
  {
    id: "transcoder-thumbnails",
    host: "transcoder",
    name: "Thumbnailer",
    description: "Picks frames and stores them as the video's thumbnails, at full size.",
    settings: { kind: "custom" },
  },
  {
    id: "transcoder-done",
    host: "transcoder",
    name: "Completion publisher",
    description:
      "Announces the playable video with the job's title and description, its duration, playlist and thumbnails.",
    settings: { kind: "event-publisher", outbox: "disabled" },
  },
  // Completion handler: the Metadata database's only writer.
  {
    id: "handler-consumer",
    host: "completion-handler",
    name: "Completion consumer",
    description: "Consumes completed videos with bounded retries.",
    settings: { kind: "event-consumer", concurrency: 4, retryLimit: 10 },
  },
  {
    id: "handler-writer",
    host: "completion-handler",
    name: "Video writer",
    description:
      "Records the playable video once, by its ID: title, description, channel, duration, playlist and thumbnails.",
    settings: dataAccess(10, 2000),
  },
  // Search indexer: the Search index's only writer.
  {
    id: "indexer-consumer",
    host: "search-indexer",
    name: "Completion consumer",
    description: "Consumes completed videos with bounded retries.",
    settings: { kind: "event-consumer", concurrency: 4, batchSize: 100, retryLimit: 5 },
  },
  {
    id: "indexer-writer",
    host: "search-indexer",
    name: "Index writer",
    description: "Adds the playable video's title, description and channel to the search index.",
    settings: { kind: "custom" },
  },
];

const uses = (id: string, from: string, to: string, via: string): StudioComponentConnection => ({
  id,
  from,
  to: { kind: "element", id: to, via },
});
const inside = (
  id: string,
  from: string,
  to: string,
  label: string,
): StudioComponentConnection => ({ id, from, to: { kind: "component", id: to }, label });
const componentConnections: StudioComponentConnection[] = [
  uses("details-cache-redis", "watch-cache-reader", "metadata-cache", "watch-cache"),
  inside("details-cache-miss", "watch-cache-reader", "watch-details", "Loads on miss"),
  uses("details-reader-db", "watch-details", "metadata-db", "watch-metadata"),
  uses("count-reader-db", "watch-counts", "view-counts", "watch-counts-read"),
  uses("view-publisher-events", "watch-views", "view-events", "watch-views-publish"),
  uses("view-consumer-events", "counter-consumer", "view-events", "views-counter"),
  inside("view-consumer-sum", "counter-consumer", "counter-sum", "Hands batch"),
  inside("view-sum-writer", "counter-sum", "counter-writer", "Writes sums"),
  uses("count-writer-db", "counter-writer", "view-counts", "counter-write"),
  uses("video-search-index", "search-query", "search-index", "search-read"),
  inside("creator-check-multipart", "upload-auth", "upload-multipart", "Allows creator"),
  uses("multipart-originals", "upload-multipart", "originals", "upload-originals"),
  inside("multipart-jobs", "upload-multipart", "upload-jobs", "On completion"),
  uses("job-publisher-queue", "upload-jobs", "upload-queue", "upload-publish"),
  uses("job-consumer-queue", "transcoder-consumer", "upload-queue", "jobs-transcoder"),
  inside("job-consumer-encoder", "transcoder-consumer", "transcoder-encoder", "Hands job"),
  uses("encoder-originals", "transcoder-encoder", "originals", "transcoder-read"),
  inside("encoder-packager", "transcoder-encoder", "transcoder-packager", "Hands segments"),
  uses("packager-transcoded", "transcoder-packager", "transcoded", "transcoder-write"),
  inside("encoder-thumbnails", "transcoder-encoder", "transcoder-thumbnails", "Hands frames"),
  uses("thumbnails-transcoded", "transcoder-thumbnails", "transcoded", "transcoder-write"),
  inside("packager-done", "transcoder-packager", "transcoder-done", "Hands playlist"),
  inside("thumbnails-done", "transcoder-thumbnails", "transcoder-done", "Hands thumbnails"),
  uses("done-events", "transcoder-done", "completion-events", "transcoder-publish"),
  uses("handler-consumer-events", "handler-consumer", "completion-events", "completions-handler"),
  inside("handler-consumer-writer", "handler-consumer", "handler-writer", "Records video"),
  uses("video-writer-db", "handler-writer", "metadata-db", "handler-metadata"),
  uses("indexer-consumer-events", "indexer-consumer", "completion-events", "completions-indexer"),
  inside("indexer-consumer-writer", "indexer-consumer", "indexer-writer", "Hands video"),
  uses("index-writer-search", "indexer-writer", "search-index", "indexer-write"),
];

/** Viewers watch (download), and creators publish (upload). */
const actions: StudioLaneAction[] = [
  { lane: "download", name: "Watch" },
  { lane: "upload", name: "Publish" },
];
/**
 * Watch reaches the Watch API, the Search API and the Video CDN; Publish reaches Identity and the
 * Upload service. Of the 6,912 entry and link orders (entries, and the links of the Watch API, the
 * Transcoder, the Upload service and Completion events), laid out with real ELK with the stores
 * beside their users, half leave a bend shorter than the grid; of the rest every one crosses at
 * least once, and this order crosses once (the Watch API's read of the Metadata database passing
 * the Search API's) with the shortest lines (8,864px in all, the longest the Search API's read,
 * 1,056px) and 54 bends. The Upload service links to Upload jobs before Original videos (connections below), so
 * Original videos sit below Upload jobs and the Transcoder's read comes back under them. The Watch
 * API's, the Transcoder's and Completion events' link orders don't change the drawing.
 */
const entries: StudioEntry[] = [
  { id: "download-watch", lane: "download", element: "watch" },
  { id: "download-search", lane: "download", element: "search" },
  { id: "download-video-cdn", lane: "download", element: "video-cdn" },
  { id: "upload-identity", lane: "upload", element: "identity" },
  { id: "upload-service", lane: "upload", element: "upload" },
];

const scaling = (
  minReplicas: number,
  maxReplicas: number,
  requestTimeoutMs: number,
  concurrencyLimit: number,
) =>
  ({
    execution: "docker",
    language: "typescript",
    exposure: "public",
    minReplicas,
    maxReplicas,
    autoscaleOn: "requests-per-second",
    requestTimeoutMs,
    concurrencyLimit,
  }) as const;
const service = (...args: Parameters<typeof scaling>) =>
  ({ kind: "service", ...scaling(...args) }) as const;
const worker = (concurrency: number, maxReplicas: number) =>
  ({
    kind: "worker",
    execution: "docker",
    language: "typescript",
    concurrency,
    minReplicas: 1,
    maxReplicas,
    autoscaleOn: "queue-lag",
  }) as const;
const mysql = {
  kind: "database",
  engine: "mysql",
  provider: "self-hosted",
  partitionKey: "video_id",
} as const;
const topic = (partitions: number, retentionSeconds: number) =>
  ({
    kind: "queue",
    mode: "topic",
    provider: "self-hosted",
    partitions,
    retentionSeconds,
  }) as const;

export function youtubeStudioExample() {
  return createStudioStudy(
    YOUTUBE_STUDIO_EXAMPLE,
    [
      // Watch: the Watch API and what it reads and publishes.
      {
        id: "watch",
        name: "Watch API",
        description:
          "Gives the player a video's details, playlist and view count, and records each view.",
        settings: service(3, 50, 1000, 2000),
      },
      {
        id: "metadata-cache",
        name: "Metadata cache",
        description:
          "Videos' details by video ID, filled by the Watch API on a miss and kept an hour.",
        settings: {
          kind: "cache",
          engine: "redis-compatible",
          provider: "self-hosted",
          ttlSeconds: 3600,
          topology: "cluster",
          eviction: "lru",
        },
        owner: { kind: "element", id: "watch" },
      },
      {
        id: "metadata-db",
        name: "Metadata database",
        description:
          "Playable videos: title, description, channel, duration, playlist and thumbnails.",
        settings: { ...mysql, readReplicas: 3 },
        owner: { kind: "element", id: "completion-handler" },
      },
      {
        id: "view-counts",
        name: "View counts",
        description: "Each video's view count, added to in batches.",
        settings: { ...mysql, readReplicas: 2 },
        owner: { kind: "element", id: "view-counter" },
      },
      {
        id: "view-events",
        name: "View events",
        description: "Views, from the Watch API to the View counter, keyed by video.",
        settings: topic(12, 86400),
        owner: { kind: "element", id: "watch" },
      },
      {
        id: "view-counter",
        name: "View counter",
        description: "Sums views per video and adds them to View counts.",
        settings: worker(8, 8),
      },
      // Search.
      {
        id: "search",
        name: "Search API",
        description: "Finds videos by title, description and channel.",
        settings: service(2, 20, 1000, 1000),
      },
      {
        id: "search-index",
        name: "Search index",
        description: "Playable videos by title, description and channel.",
        settings: { kind: "search", engine: "opensearch", provider: "self-hosted" },
        owner: { kind: "element", id: "search-indexer" },
      },
      // Streaming.
      {
        id: "video-cdn",
        name: "Video CDN",
        description:
          "Serves video segments, playlists and thumbnails from the edge; resizes thumbnails on request.",
        settings: {
          kind: "cdn",
          provider: "cloudflare",
          origin: "transcoded",
          imageResizing: "on-request",
        },
      },
      {
        id: "transcoded",
        name: "Transcoded videos",
        description:
          "Each video's segments at every resolution, its HLS playlists and its thumbnails.",
        settings: { kind: "object-store", provider: "cloudflare-r2", access: "public" },
        owner: { kind: "element", id: "transcoder" },
      },
      // Publish: sign-in, the upload and the pipeline after it.
      {
        id: "identity",
        name: "Identity",
        description: "Signs creators and viewers in and issues the tokens the services verify.",
        settings: {
          kind: "identity",
          execution: "docker",
          language: "typescript",
          exposure: "public",
          provider: "oidc",
          minReplicas: 2,
          maxReplicas: 4,
          autoscaleOn: "cpu",
        },
      },
      {
        id: "upload",
        name: "Upload service",
        description:
          "Lets a creator upload a video in resumable parts, with URLs it signs, into Original videos, then queues it for transcoding.",
        settings: { kind: "uploads", ...scaling(2, 10, 5000, 500), transfer: "signed-url" },
      },
      {
        id: "originals",
        name: "Original videos",
        description: "Each video as the creator uploaded it, kept to transcode again.",
        settings: { kind: "object-store", provider: "cloudflare-r2", access: "private" },
        owner: { kind: "element", id: "upload" },
      },
      {
        id: "upload-queue",
        name: "Upload jobs",
        description:
          "Uploaded videos waiting to be transcoded, one job each, with title and description.",
        settings: {
          kind: "queue",
          mode: "work-queue",
          provider: "self-hosted",
          retentionSeconds: 604800,
        },
        owner: { kind: "element", id: "upload" },
      },
      {
        id: "transcoder",
        name: "Transcoder",
        description:
          "Encodes each upload into streamable segments at several bitrates, with playlists and thumbnails, then announces the video.",
        settings: worker(1, 50),
      },
      {
        id: "completion-events",
        name: "Completion events",
        description:
          "Each playable video's details, from the Transcoder to the Completion handler and the Search indexer.",
        settings: topic(6, 604800),
        owner: { kind: "element", id: "transcoder" },
      },
      {
        id: "completion-handler",
        name: "Completion handler",
        description: "Records each playable video in the Metadata database, once.",
        settings: worker(4, 4),
      },
      {
        id: "search-indexer",
        name: "Search indexer",
        description: "Adds each playable video to the Search index.",
        settings: worker(4, 4),
      },
    ],
    [
      // Watch API: its own cache, then a replica on a miss; view counts; each view.
      {
        id: "watch-cache",
        from: "watch",
        to: "metadata-cache",
        kind: "uses-database",
        planned: call("Reads video details, fills on miss", "Redis"),
        settings: {},
      },
      {
        id: "watch-metadata",
        from: "watch",
        to: "metadata-db",
        kind: "uses-database",
        planned: call("Reads video details on a miss", "SQL"),
        settings: {},
      },
      {
        id: "watch-counts-read",
        from: "watch",
        to: "view-counts",
        kind: "uses-database",
        planned: call("Reads view counts", "SQL"),
        settings: {},
      },
      {
        id: "watch-views-publish",
        from: "watch",
        to: "view-events",
        kind: "depends-on",
        planned: messaging("Publishes views"),
        settings: { channelUse: "publish" },
      },
      {
        id: "views-counter",
        from: "view-events",
        to: "view-counter",
        kind: "depends-on",
        planned: messaging("Delivers views"),
        settings: { channelUse: "consume" },
      },
      {
        id: "counter-write",
        from: "view-counter",
        to: "view-counts",
        kind: "uses-database",
        planned: call("Adds summed views", "SQL"),
        settings: {},
      },
      {
        id: "search-read",
        from: "search",
        to: "search-index",
        kind: "depends-on",
        planned: call("Searches videos", "HTTPS"),
        settings: {},
      },
      {
        id: "cdn-transcoded",
        from: "video-cdn",
        to: "transcoded",
        kind: "depends-on",
        planned: call("Reads segments and thumbnails", "HTTPS"),
        settings: {},
      },
      // Upload service: the original, then the job.
      {
        id: "upload-publish",
        from: "upload",
        to: "upload-queue",
        kind: "depends-on",
        planned: messaging("Publishes upload jobs"),
        settings: { channelUse: "publish" },
      },
      {
        id: "upload-originals",
        from: "upload",
        to: "originals",
        kind: "depends-on",
        planned: call("Starts, signs and completes uploads", "HTTPS"),
        settings: {},
      },
      {
        id: "jobs-transcoder",
        from: "upload-queue",
        to: "transcoder",
        kind: "depends-on",
        planned: messaging("Delivers upload jobs"),
        settings: { channelUse: "consume" },
      },
      // Transcoder: reads the original, writes its output, announces the video.
      {
        id: "transcoder-read",
        from: "transcoder",
        to: "originals",
        kind: "depends-on",
        planned: call("Reads originals", "HTTPS"),
        settings: {},
      },
      {
        id: "transcoder-write",
        from: "transcoder",
        to: "transcoded",
        kind: "depends-on",
        planned: call("Stores segments, playlists and thumbnails", "HTTPS"),
        settings: {},
      },
      {
        id: "transcoder-publish",
        from: "transcoder",
        to: "completion-events",
        kind: "depends-on",
        planned: messaging("Publishes completed videos"),
        settings: { channelUse: "publish" },
      },
      // Completion events: the record and the index, each by its own writer.
      {
        id: "completions-handler",
        from: "completion-events",
        to: "completion-handler",
        kind: "depends-on",
        planned: messaging("Delivers completed videos"),
        settings: { channelUse: "consume" },
      },
      {
        id: "completions-indexer",
        from: "completion-events",
        to: "search-indexer",
        kind: "depends-on",
        planned: messaging("Delivers completed videos"),
        settings: { channelUse: "consume" },
      },
      {
        id: "handler-metadata",
        from: "completion-handler",
        to: "metadata-db",
        kind: "uses-database",
        planned: call("Records playable videos", "SQL"),
        settings: {},
      },
      {
        id: "indexer-write",
        from: "search-indexer",
        to: "search-index",
        kind: "depends-on",
        planned: call("Indexes playable videos", "HTTPS"),
        settings: {},
      },
    ],
    {
      system: {
        name: "YouTube",
        description:
          "Creators upload videos that are transcoded for streaming; viewers find them by search, watch them at a bitrate that suits their connection and see how many times each was viewed.",
      },
    },
    { actions, entries, components, componentConnections },
  );
}

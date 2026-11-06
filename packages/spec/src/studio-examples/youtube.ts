/**
 * The YouTube study: a video-sharing site with YouTube's core functionality (upload, transcode,
 * stream, search, view counts), designed as clean microservices from published designs. Design
 * intent only.
 *
 * In lanes: the user watches (download, the **Watch** action) through the Search API, the Watch
 * API (a video's details and view count; it also records each view) and the Video CDN (segments,
 * playlists and thumbnails), and publishes (upload, the **Publish** action) through the Upload
 * service (it starts, signs and completes a multipart upload, and writes Original videos) and
 * Identity (sign-in).
 *
 * What the sources agree on, and what each tile traces to:
 * - All four: originals in object storage (Original videos), uploaded in parts that can resume;
 *   ByteByteGo, HelloInterview and the DesignGurus crash course send them straight from the
 *   client with pre-signed URLs. AWS's multipart pattern: the backend starts the upload, signs a
 *   URL per part and completes it (Upload service, its Multipart upload module). On the canvas
 *   the Upload service writes Original videos: a user reaches storage only through a service.
 * - All four: processing is asynchronous, behind a queue (Upload jobs; HelloInterview's
 *   orchestrator has its own), and encodes each video at several resolutions and bitrates
 *   (Video processor, Encoded videos). ByteByteGo, HelloInterview and the crash course split it
 *   into segments with HLS or DASH playlists, and a CDN serves them while the player picks each
 *   segment's bitrate (Video CDN). Grokking and ByteByteGo generate thumbnails in the pipeline.
 * - HelloInterview: the processing service writes the playlist's address back into the video's
 *   metadata (the Video processor writes the Metadata database).
 * - Grokking and the crash course: metadata in MySQL, sharded by video ID, with replicas for
 *   reads (Metadata database); YouTube built Vitess to shard its MySQL.
 * - The crash course: a separate search service over an index of titles and tags (Search API,
 *   Search index), filled when a video becomes playable; view counts in their own store,
 *   eventually consistent (View counts).
 *
 * Design decisions:
 * - One writer per store. The designs write a video's metadata twice (the API on upload, the
 *   pipeline when done). Here the Video processor writes it once, when the video can be played,
 *   from the title and description the upload job carries; it also indexes it. The Upload service
 *   keeps no database: the multipart upload is the upload's state, and resuming asks storage
 *   which parts arrived.
 * - One Video processor with modules (segmenting and encoding, packaging, thumbnails, the record
 *   and the index), not ByteByteGo's DAG of task workers and separate completion handler: the
 *   DAG is the developer's, inside the worker.
 * - Views: the Watch API publishes each view the player reports, and the View counter sums them
 *   per video and adds them in batches, so a popular video's row is not written on every view.
 * - Thumbnails are stored once, at full size, beside the segments; the Video CDN resizes them on
 *   request (the CDN's Image resizing, added for the marketplace study).
 * - Cloudflare R2 behind the Cloudflare CDN: R2 charges no egress, and ByteByteGo names CDN
 *   traffic the largest cost. Cloudflare's terms want video on its CDN served through a paid
 *   product such as its developer platform, of which R2 is part.
 * - Services verify Identity's signed tokens themselves (the Upload service's creator check), so
 *   no line runs to Identity.
 * - Left out: comments, likes, recommendations, subscriptions, monetisation and live streaming;
 *   editing a video after upload and custom thumbnails; a metadata cache (the database's replicas
 *   serve reads); a gateway (it would hide which services a viewer and a creator reach).
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
 * - Cloudflare, R2 pricing: https://developers.cloudflare.com/r2/pricing/
 * - Cloudflare, Service-specific terms (CDN):
 *   https://www.cloudflare.com/service-specific-terms-application-services/
 */
import type { StudioComponent, StudioComponentConnection } from "../studio-components.ts";
import type { StudioEntry, StudioLaneAction } from "../studio-model.ts";
import type { StudioConnectionCreation } from "../studio-operations.ts";
import { createStudioStudy } from "./study.ts";

const description =
  "A video-sharing site from published designs: creators upload in resumable parts through an upload service that signs each part; a queue feeds a video processor that writes streamable segments, playlists and thumbnails for a CDN, then records and indexes each video; views are counted in batches.";

export const YOUTUBE_STUDIO_EXAMPLE = {
  id: "studio-youtube",
  version: "1.1.0",
  name: "YouTube · studio study",
  description,
  /** SHA-256 of `description`, the study's goal. */
  goalManifestSha256: "8c1d2e0de25ecd135e8c7f8380886f96614abbcdeac11460f3cd13ff1534d87a",
} as const;

const call = (label: string, protocol: "HTTPS" | "SQL"): StudioConnectionCreation["planned"] => ({
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
  // Watch API: a video's details and view count, and each view.
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
  // Upload service: the original's only writer; no database.
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
      "Publishes an upload job, with the title and description, once the upload completes.",
    settings: { kind: "event-publisher", outbox: "disabled" },
  },
  // Video processor: the only writer of Encoded videos, the Metadata database and the Search index.
  {
    id: "processor-consumer",
    host: "processor",
    name: "Job consumer",
    description: "Takes one upload job at a time with bounded retries.",
    settings: { kind: "event-consumer", concurrency: 1, retryLimit: 3 },
  },
  {
    id: "processor-encoder",
    host: "processor",
    name: "Segmenter and encoder",
    description:
      "Reads the original and encodes it, in segments of a few seconds, at each resolution and bitrate (ffmpeg).",
    settings: { kind: "custom" },
  },
  {
    id: "processor-packager",
    host: "processor",
    name: "Packager",
    description: "Stores the segments with an HLS playlist per rendition and one master playlist.",
    settings: { kind: "custom" },
  },
  {
    id: "processor-thumbnails",
    host: "processor",
    name: "Thumbnailer",
    description: "Picks frames and stores them as the video's thumbnails, at full size.",
    settings: { kind: "custom" },
  },
  {
    id: "processor-record",
    host: "processor",
    name: "Video writer",
    description:
      "Records the playable video once, by its ID: title, description, channel, duration, playlist and thumbnails.",
    settings: dataAccess(10, 2000),
  },
  {
    id: "processor-index",
    host: "processor",
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
  uses("job-consumer-queue", "processor-consumer", "upload-queue", "jobs-processor"),
  inside("job-consumer-encoder", "processor-consumer", "processor-encoder", "Hands job"),
  uses("encoder-originals", "processor-encoder", "originals", "processor-read"),
  inside("encoder-packager", "processor-encoder", "processor-packager", "Hands segments"),
  uses("packager-encoded", "processor-packager", "encoded", "processor-write"),
  inside("encoder-thumbnails", "processor-encoder", "processor-thumbnails", "Hands frames"),
  uses("thumbnails-encoded", "processor-thumbnails", "encoded", "processor-write"),
  inside("packager-record", "processor-packager", "processor-record", "Records video"),
  inside("record-index", "processor-record", "processor-index", "Indexes video"),
  uses("video-writer-db", "processor-record", "metadata-db", "processor-metadata"),
  uses("index-writer-search", "processor-index", "search-index", "processor-index-write"),
];

/** Viewers watch (download), and creators publish (upload). */
const actions: StudioLaneAction[] = [
  { lane: "download", name: "Watch" },
  { lane: "upload", name: "Publish" },
];
/**
 * Watch reaches the Search API, the Watch API and the Video CDN; Publish reaches the Upload
 * service and Identity. Of the 36 orders that kept download above upload before the action
 * tiles, this one drew no crossing lines and was the shortest: the Search API's read runs along
 * the top row and the view path sits under it. Layout tuning for the action tiles waits for the
 * lane bands (LA03).
 */
const entries: StudioEntry[] = [
  { id: "download-search", lane: "download", element: "search" },
  { id: "download-watch", lane: "download", element: "watch" },
  { id: "download-video-cdn", lane: "download", element: "video-cdn" },
  { id: "upload-service", lane: "upload", element: "upload" },
  { id: "upload-identity", lane: "upload", element: "identity" },
];

const service = (
  minReplicas: number,
  maxReplicas: number,
  requestTimeoutMs: number,
  concurrencyLimit: number,
) =>
  ({
    kind: "service",
    execution: "docker",
    language: "typescript",
    exposure: "public",
    minReplicas,
    maxReplicas,
    autoscaleOn: "requests-per-second",
    requestTimeoutMs,
    concurrencyLimit,
  }) as const;
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

export function youtubeStudioExample() {
  return createStudioStudy(
    YOUTUBE_STUDIO_EXAMPLE,
    [
      {
        id: "video-cdn",
        name: "Video CDN",
        description:
          "Serves video segments, playlists and thumbnails from the edge; resizes thumbnails on request.",
        settings: {
          kind: "cdn",
          provider: "cloudflare",
          origin: "encoded",
          imageResizing: "on-request",
        },
      },
      {
        id: "encoded",
        name: "Encoded videos",
        description:
          "Each video's segments at every resolution, its HLS playlists and its thumbnails.",
        settings: { kind: "object-store", provider: "cloudflare-r2", access: "public" },
        owner: { kind: "element", id: "processor" },
      },
      {
        id: "watch",
        name: "Watch API",
        description:
          "Gives the player a video's details, playlist and view count, and records each view.",
        settings: service(3, 50, 1000, 2000),
      },
      {
        id: "metadata-db",
        name: "Metadata database",
        description:
          "Playable videos: title, description, channel, duration, playlist and thumbnails.",
        settings: { ...mysql, readReplicas: 3 },
        owner: { kind: "element", id: "processor" },
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
        settings: {
          kind: "queue",
          mode: "topic",
          provider: "self-hosted",
          partitions: 12,
          retentionSeconds: 86400,
        },
        owner: { kind: "element", id: "watch" },
      },
      {
        id: "view-counter",
        name: "View counter",
        description: "Sums views per video and adds them to View counts.",
        settings: worker(8, 8),
      },
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
        owner: { kind: "element", id: "processor" },
      },
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
          "Lets a creator upload a video in resumable, signed parts into Original videos, then queues it for transcoding.",
        settings: service(2, 10, 5000, 500),
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
        description: "Uploaded videos waiting to be transcoded, one job each.",
        settings: {
          kind: "queue",
          mode: "work-queue",
          provider: "self-hosted",
          retentionSeconds: 604800,
        },
        owner: { kind: "element", id: "upload" },
      },
      {
        id: "processor",
        name: "Video processor",
        description:
          "Encodes each upload into streamable segments at several bitrates, with playlists and thumbnails, then records and indexes the playable video.",
        settings: worker(1, 50),
      },
    ],
    [
      {
        id: "cdn-encoded",
        from: "video-cdn",
        to: "encoded",
        kind: "depends-on",
        planned: call("Reads segments and thumbnails", "HTTPS"),
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
        id: "watch-metadata",
        from: "watch",
        to: "metadata-db",
        kind: "uses-database",
        planned: call("Reads video details", "SQL"),
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
        id: "upload-originals",
        from: "upload",
        to: "originals",
        kind: "depends-on",
        planned: call("Starts, signs and completes uploads", "HTTPS"),
        settings: {},
      },
      {
        id: "upload-publish",
        from: "upload",
        to: "upload-queue",
        kind: "depends-on",
        planned: messaging("Publishes upload jobs"),
        settings: { channelUse: "publish" },
      },
      {
        id: "jobs-processor",
        from: "upload-queue",
        to: "processor",
        kind: "depends-on",
        planned: messaging("Delivers upload jobs"),
        settings: { channelUse: "consume" },
      },
      {
        id: "processor-read",
        from: "processor",
        to: "originals",
        kind: "depends-on",
        planned: call("Reads originals", "HTTPS"),
        settings: {},
      },
      {
        id: "processor-write",
        from: "processor",
        to: "encoded",
        kind: "depends-on",
        planned: call("Stores segments, playlists and thumbnails", "HTTPS"),
        settings: {},
      },
      {
        id: "processor-metadata",
        from: "processor",
        to: "metadata-db",
        kind: "uses-database",
        planned: call("Records playable videos", "SQL"),
        settings: {},
      },
      {
        id: "processor-index-write",
        from: "processor",
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

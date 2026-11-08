import { freeze } from "./json.ts";

/** Deliberately one frozen local experiment, not a general provider or workflow registry. */
export const generatorIdentity = freeze({
  id: "jeeves-generator",
  version: "0.1.0-experimental.1",
} as const);

export const youtubeLocalProfile = freeze({
  id: "youtube-local-v1",
  version: "1.0.0",
  baselineCommit: "acbc716c90245aeb398391f30f7800f988294cb4",
  projectId: "293b4a2d-e25b-4a5b-83da-b27de7876f02",
  revision: 3,
  sourceSchemaVersion: 2,
  blueprintVersion: 3,
  sourceSnapshot: "field-projects/youtube/v1/diagrams/005-local-intent-aligned",
  sourceCanonicalSha256: "7d1874a1e74c6bf53df9058a9b2f826b4d83def2aaddb328022747355979cc93",
  diagram: {
    sha256: "23c06f6dd8a4533456f962016bc9da1cd2d2ae57e4a56391643ade236dc5bdb9",
    rendererCommit: "a98bf708d4f70083e7ed4293eaa561561c67694d",
  },
  artifacts: {
    "manifest.json": { sha256: "c82bc4f77ba138fdb4fd4d5d3778a76a873bbfc960d52f074c7b2846907783af" },
    "design.json": {
      sha256: "7ea79f431f89352814320d385591ae1e84cf8e63129e93d8fb649c6b2716045c",
      bytes: 35922,
    },
    "blueprint.json": {
      sha256: "041facff14d88c045e788f75fa6a7868f872cc37e0e9d9d5641c6fcce81d7e64",
      bytes: 61453,
    },
    "local-bindings.json": {
      sha256: "4e91a9a4edfce4385e67d4e696af8a61ac127c9682a22b0e691b0464c7d0e5d2",
      bytes: 48968,
    },
    "runtime-pins.json": {
      sha256: "66c5474e9e93d81dc5eb8dcb63289559491d57c80383c941e41c239e97f894fb",
      bytes: 11451,
    },
  },
} as const);

export const templateIds = freeze([
  "local.project",
  "typescript.http-shell",
  "typescript.worker-shell",
  "typescript.signed-multipart-shell",
  "typescript.ffmpeg-worker-shell",
  "typescript.cache-client-config",
  "typescript.pg-client-config",
  "typescript.amqp-publisher-config",
  "typescript.amqp-consumer-config",
  "typescript.jwt-guard-config",
  "explicit-custom-extension",
  "local.redis-compatible",
  "local.postgresql",
  "local.amqp-fanout",
  "local.amqp-work-queue",
  "local.opensearch",
  "local.edge-proxy",
  "local.s3-bucket",
  "local.oidc",
] as const);
export type TemplateId = (typeof templateIds)[number];

/** Named missing behavior, not an inferred implementation plan or contract. */
export const customGaps = freeze(
  [
    { id: "G01", task: "Durable upload/processing lifecycle, status, cleanup and state ownership" },
    { id: "G02", task: "Committed public metadata before searchable/watchable publication" },
    { id: "G03", task: "Stable identities and idempotent processing/publication side effects" },
    { id: "G04", task: "Browser sign-in/upload/status/search/watch and real PKCE/JWT integration" },
    { id: "G05", task: "Playback-event policy, receipts and transactional count increments" },
    { id: "G06", task: "Owned multipart/resume/abort, signing endpoints and CORS" },
    { id: "G07", task: "Real CPU encoding, HLS, thumbnails and finite failures" },
    { id: "G08", task: "Explicit local provider/protocol/language and scale limitations" },
  ].map((gap) => ({
    ...gap,
    reference: "field-projects/youtube/v1/notes/mapping-and-gaps.md",
    status: "unimplemented" as const,
  })),
);

import { z } from "zod";
import { defineSearchDocument, type SearchMapping } from "../runtime/search-contract.ts";
import { publicPaths, videoUuid } from "./video-paths.ts";

// Shared public metadata: canonical UUID and exact paired asset/job/attempt paths.
// Wire-event identity and HTTP URLs remain product-adapter concerns.
export const publicVideoRecord = z
  .strictObject({
    videoId: videoUuid,
    publicationVersion: z.literal(1),
    title: z.string().min(1).max(200),
    description: z.string().max(5000),
    channel: z.string().min(1).max(200),
    durationSeconds: z.number().finite().min(1).max(600),
    manifest: z.string().min(1).max(250),
    thumbnail: z.string().min(1).max(250),
    publishedAt: z.iso.datetime({ offset: true }),
  })
  .superRefine((video, ctx) => {
    try {
      publicPaths(video);
    } catch {
      ctx.addIssue({ code: "custom", message: "Unbound public video paths" });
    }
  });
export const publicVideoDocumentSchema = publicVideoRecord.safeExtend({
  visibility: z.literal("public"),
  state: z.literal("ready"),
});
export type PublicVideoRecord = z.infer<typeof publicVideoRecord>;
export type PublicVideoDocument = z.infer<typeof publicVideoDocumentSchema>;
export const publicVideoMapping = {
  version: 1,
  properties: {
    videoId: { type: "keyword" },
    publicationVersion: { type: "integer" },
    visibility: { type: "keyword" },
    state: { type: "keyword" },
    title: { type: "text" },
    description: { type: "text" },
    channel: { type: "text" },
    durationSeconds: { type: "double" },
    manifest: { type: "keyword", index: false },
    thumbnail: { type: "keyword", index: false },
    publishedAt: { type: "date" },
  },
} as const satisfies SearchMapping<PublicVideoDocument>;
export const publicVideoDocument = defineSearchDocument({
  mapping: publicVideoMapping,
  codec: publicVideoDocumentSchema,
  id: (document) => document.videoId,
  version: (document) => document.publicationVersion,
});

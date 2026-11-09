import { createMultipartObjects } from "../runtime/multipart-objects.ts";
import { originalIdentity } from "../features/video-paths.ts";
import type { VideoMetadata, CompletionResponse } from "./youtube-contract.ts";

export function createYouTubeMultipartObjects(
  options: Pick<Parameters<typeof createMultipartObjects>[0], "control" | "signing" | "bucket">,
) {
  return createMultipartObjects<VideoMetadata, CompletionResponse>({
    ...options,
    prefix: "originals/",
    ownsKey(key) {
      try {
        originalIdentity(key);
        return true;
      } catch {
        return false;
      }
    },
    metadata: {
      assetId: "video-id",
      uploadId: "upload-id",
      sha256: "sha256",
      expectedSize: "expected-size",
    },
  });
}

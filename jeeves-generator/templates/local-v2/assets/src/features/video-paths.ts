import { z } from "zod";

export const videoUuid = z.uuid().transform((value) => value.toLowerCase());
export const originalKey = (videoId: string, uploadId: string) =>
  `originals/${videoUuid.parse(videoId)}/${videoUuid.parse(uploadId)}/source.mp4`;
export const resultPrefix = (videoId: string, jobId: string, attemptId: string) =>
  `videos/${videoUuid.parse(videoId)}/${videoUuid.parse(jobId)}/${videoUuid.parse(attemptId)}/`;
export function originalIdentity(key: string) {
  const parts = key.split("/");
  const videoId = videoUuid.parse(parts[1]),
    uploadId = videoUuid.parse(parts[2]);
  if (key !== originalKey(videoId, uploadId)) throw new Error("Unbound original path");
  return { videoId, uploadId };
}
export function publicPaths(video: { videoId: string; manifest: string; thumbnail: string }) {
  const parts = video.manifest.split("/");
  const prefix = resultPrefix(video.videoId, parts[2] ?? "", parts[3] ?? "");
  if (video.manifest !== `${prefix}master.m3u8` || video.thumbnail !== `${prefix}thumbnail.jpg`)
    throw new Error("Unbound public video paths");
}

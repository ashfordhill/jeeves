import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { designSchema } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import {
  generationSelectionsFixture,
  generationSourceFixture,
} from "../../../jeeves/packages/spec/src/fixtures/yv2-selections.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";

// Execute exact template code; no FFmpeg, providers, Docker or network in unit tests.
const urls = new Map<string, string>();
function moduleUrl(name: string): string {
  const previous = urls.get(name);
  if (previous) return previous;
  const js = stripTypeScriptTypes(
    readFileSync(
      new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts.template`, import.meta.url),
      "utf8",
    ),
  )
    .replace(/from "\.\/(.+)\.ts"/g, (_match, dep: string) => `from "${moduleUrl(dep)}"`)
    .replace('from "zod"', `from "${import.meta.resolve("zod")}"`);
  const url = `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  urls.set(name, url);
  return url;
}
const { validateVideoOriginal, localMediaPath } = await import(moduleUrl("media-process"));
const { bindVideoMarker, videoCompletionMarker, videoHlsJob } = await import(
  moduleUrl("video-result")
);
const { videoPlaylistReferences } = await import(moduleUrl("video-hls"));
const identity = {
  assetId: "12345678-1234-5678-9012-345678901234",
  jobId: "22345678-1234-5678-9012-345678901234",
  attemptId: "32345678-1234-5678-9012-345678901234",
};
const job = {
  ...identity,
  source: { key: "lessons/raw/source.mp4", size: 12, sha256: "a".repeat(64) },
  resultPrefix: "courses/lesson-assets/fixed-attempt/",
};
const marker = () => ({
  schemaVersion: 1,
  ...identity,
  source: job.source,
  result: {
    prefix: job.resultPrefix,
    manifest: `${job.resultPrefix}master.m3u8`,
    thumbnail: `${job.resultPrefix}thumbnail.jpg`,
    marker: `${job.resultPrefix}_complete.json`,
    durationSeconds: 20,
    renditions: [360, 720].map((height) => ({
      height,
      width: height === 360 ? 640 : 1280,
      playlist: `${job.resultPrefix}${height}/index.m3u8`,
      videoCodec: "h264",
      audioCodec: "aac",
    })),
  },
  inventory: [
    "360/segment00000.ts",
    "360/index.m3u8",
    "720/segment00000.ts",
    "720/index.m3u8",
    "thumbnail.jpg",
    "master.m3u8",
  ].map((path) => ({
    path,
    size: 1,
    sha256: "b".repeat(64),
    contentType: path.endsWith(".ts")
      ? "video/mp2t"
      : path.endsWith(".jpg")
        ? "image/jpeg"
        : "application/vnd.apple.mpegurl",
  })),
});

describe("fixed reusable video engine", () => {
  it("keeps the finite source bounds and refuses nonlocal paths", () => {
    const probe = {
      streams: [
        { codec_type: "video", codec_name: "h264", width: 1280, height: 720 },
        { codec_type: "audio", codec_name: "aac" },
      ],
      format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "20" },
    };
    expect(validateVideoOriginal(probe)).toEqual({ width: 1280, height: 720, duration: 20 });
    for (const override of [
      { height: 360 },
      { width: 719 },
      { width: 1922 },
      { codec_name: "hevc" },
      { tags: { rotate: "90" } },
    ])
      expect(() =>
        validateVideoOriginal({
          ...probe,
          streams: [{ ...probe.streams[0], ...override }, probe.streams[1]],
        }),
      ).toThrow("INVALID_MEDIA");
    expect(() =>
      validateVideoOriginal({ ...probe, format: { ...probe.format, duration: "601" } }),
    ).toThrow("INVALID_MEDIA");
    for (const path of ["relative/source.mp4", "https://example.invalid/media.mp4", "/tmp/a\0b"])
      expect(() => localMediaPath(path)).toThrow();
  });

  it("binds every marker identity, source field, prefix and finite inventory", () => {
    expect(bindVideoMarker(marker(), job).result.prefix).toBe(job.resultPrefix);
    for (const field of ["assetId", "jobId", "attemptId"])
      expect(() =>
        bindVideoMarker({ ...marker(), [field]: "42345678-1234-5678-9012-345678901234" }, job),
      ).toThrow();
    for (const change of [{ key: "foreign/source.mp4" }, { size: 13 }, { sha256: "c".repeat(64) }])
      expect(() =>
        bindVideoMarker({ ...marker(), source: { ...job.source, ...change } }, job),
      ).toThrow("fingerprint");
    expect(() => bindVideoMarker(marker(), { ...job, resultPrefix: "other/assets/" })).toThrow(
      "prefix",
    );
    const missing = marker();
    missing.inventory.pop();
    expect(videoCompletionMarker.safeParse(missing).success).toBe(false);
    const duplicate = marker();
    duplicate.inventory.push({
      path: "360/index.m3u8",
      size: 1,
      sha256: "b".repeat(64),
      contentType: "application/vnd.apple.mpegurl",
    });
    expect(videoCompletionMarker.safeParse(duplicate).success).toBe(false);
    expect(videoHlsJob.safeParse({ ...job, resultPrefix: "../escape/" }).success).toBe(false);
    expect(videoHlsJob.safeParse({ ...job, resultPrefix: "https://foreign/" }).success).toBe(false);
  });

  it("refuses unsafe or incomplete playlists and emits an honest engine-only dependency", () => {
    const playlist =
      "#EXTM3U\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXTINF:4,\nsegment00000.ts\n#EXT-X-ENDLIST\n";
    const files = ["index.m3u8", "segment00000.ts"];
    expect(videoPlaylistReferences(playlist, files)).toEqual(["segment00000.ts"]);
    for (const bad of [
      playlist.replace("segment00000.ts", "../source.mp4"),
      playlist.replace("#EXT-X-ENDLIST", "#EXT-X-KEY:URI=foreign"),
      playlist.replace("#EXT-X-ENDLIST", "segment00000.ts\n#EXT-X-ENDLIST"),
    ])
      expect(() => videoPlaylistReferences(bad, files)).toThrow("inventory");
    expect(() => videoPlaylistReferences(playlist, [...files, "unexpected.ts"])).toThrow(
      "inventory",
    );
    const generation = generationSelectionsFixture();
    const design = designSchema.parse({
      ...generationSourceFixture(),
      generation: {
        version: 1,
        runtime: generation.runtime,
        selections: generation.selections.filter((s) => s.binding.kind === "video-hls"),
      },
    });
    const registry = loadLocalV2Registry(),
      bundle = assembleV2({ designJson: JSON.stringify(design) }, registry);
    const paths = bundle.files.map((f) => f.path);
    expect(paths).toContain("src/runtime/video-hls.ts");
    expect(paths).toContain("src/runtime/asset-identity.ts");
    expect(paths).not.toContain("src/runtime/asset-lifecycle.ts");
    expect(paths).not.toContain("src/runtime/postgres.ts");
    expect(paths).not.toContain("src/runtime/search.ts");
    expect(registry.installed.templates).toEqual([]);
    expect(bundle.report.applicationComplete).toBe(false);
    expect(bundle.report.gaps.some((g) => g.id === "video-hls-worker-bindings" && g.required)).toBe(
      true,
    );
    for (const file of bundle.files.filter((f) =>
      /(?:video-hls|video-result|media-process|asset-identity)\.ts$/.test(f.path),
    ))
      expect(new TextDecoder().decode(file.bytes)).not.toMatch(
        /videoId|youtube|publication|channel|search|counter/i,
      );
  });
});

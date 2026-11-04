/** Static local provenance only. Paths are documentation references, never file/network inputs. */
import { z } from "zod";
import { contractCanonical } from "./architecture-contracts.ts";
import { idSchema } from "./ids.ts";
import communityGoal from "./studio-examples/community.goal.json" with { type: "json" };
import discourseFoundationGoal from "./studio-examples/discourse-foundation.goal.json" with {
  type: "json",
};
import enterpriseGoal from "./studio-examples/enterprise.goal.json" with { type: "json" };
import linksGoal from "./studio-examples/links.goal.json" with { type: "json" };
import mattermostGoal from "./studio-examples/mattermost.goal.json" with { type: "json" };
import qrwtytargetGoal from "./studio-examples/qrwty-target.goal.json" with { type: "json" };
import socialGoal from "./studio-examples/social.goal.json" with { type: "json" };
import streamlyGoal from "./studio-examples/streamly.goal.json" with { type: "json" };
import vendureFoundationGoal from "./studio-examples/vendure-foundation.goal.json" with {
  type: "json",
};
import zammadFoundationGoal from "./studio-examples/zammad-foundation.goal.json" with {
  type: "json",
};
import { definitionRefSchema, type StudioModel } from "./studio-model.ts";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const studioGoalManifestSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    example: definitionRefSchema,
    sources: z
      .array(
        z.strictObject({
          id: idSchema,
          path: z
            .string()
            .min(1)
            .max(500)
            .refine(
              (path) =>
                !path.startsWith("/") &&
                !path.includes("\\") &&
                !/^[a-z][a-z0-9+.-]*:/i.test(path) &&
                path.split("/").every((part) => !!part),
              "Use a repository-relative documentation reference.",
            ),
          commit: z.string().min(1).max(120).optional(),
          sha256,
        }),
      )
      .min(1)
      .max(30),
    requirements: z
      .array(
        z.strictObject({
          requirementId: z.string().trim().min(1).max(120),
          source: z.strictObject({
            sourceId: idSchema,
            location: z.string().trim().min(1).max(240),
          }),
          summary: z.string().trim().min(1).max(1200),
          disposition: z.enum(["represented-design", "fixed-template-candidate", "c4b", "unknown"]),
          nodeIds: z.array(idSchema).max(100),
          connectionIds: z.array(idSchema).max(100),
          remainingWork: z.string().trim().max(1200),
        }),
      )
      .min(1)
      .max(500),
  })
  .superRefine((manifest, ctx) => {
    for (const [key, ids] of [
      ["sources", manifest.sources.map((item) => item.id)],
      ["requirements", manifest.requirements.map((item) => item.requirementId)],
    ] as const) {
      const seen = new Set<string>();
      ids.forEach((id, index) => {
        if (seen.has(id))
          ctx.addIssue({
            code: "custom",
            path: [key, index],
            message: `Duplicate identity ${id}.`,
          });
        seen.add(id);
      });
    }
    const sources = new Set(manifest.sources.map((item) => item.id));
    manifest.requirements.forEach((item, index) => {
      if (!sources.has(item.source.sourceId))
        ctx.addIssue({
          code: "custom",
          path: ["requirements", index, "source", "sourceId"],
          message: "Requirement must reference a declared source.",
        });
    });
  });
export type StudioGoalManifest = z.infer<typeof studioGoalManifestSchema>;
const originSchema = z.strictObject({ example: definitionRefSchema, goalManifestSha256: sha256 });
export const studioSourceSchema = z.discriminatedUnion("status", [
  z.strictObject({
    ...originSchema.shape,
    status: z.literal("resolved"),
    manifest: studioGoalManifestSchema,
  }),
  z.strictObject({ ...originSchema.shape, status: z.enum(["unavailable", "hash-mismatch"]) }),
]);
export type StudioSource = z.infer<typeof studioSourceSchema>;

/** Exact local source corpus; later example batches register only after their assigned review. */
function freezeSource<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeSource);
    Object.freeze(value);
  }
  return value;
}
export const studioGoalManifests: readonly StudioGoalManifest[] = freezeSource(
  [
    mattermostGoal,
    enterpriseGoal,
    streamlyGoal,
    qrwtytargetGoal,
    linksGoal,
    communityGoal,
    socialGoal,
    discourseFoundationGoal,
    vendureFoundationGoal,
    zammadFoundationGoal,
  ].map((manifest) => studioGoalManifestSchema.parse(manifest)),
);

export async function studioGoalManifestHash(manifest: StudioGoalManifest): Promise<string> {
  const bytes = new TextEncoder().encode(
    contractCanonical(studioGoalManifestSchema.parse(manifest)),
  );
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function resolveStudioSources(
  origin: StudioModel["origin"],
  registry: readonly StudioGoalManifest[] = studioGoalManifests,
): Promise<StudioSource[] | undefined> {
  if (!origin) return undefined;
  const candidates = registry.filter(
    (item) =>
      item.example.id === origin.example.id && item.example.version === origin.example.version,
  );
  if (candidates.length > 1) throw new Error("Duplicate immutable studio source version.");
  const manifest = candidates[0];
  if (!manifest) return [{ ...structuredClone(origin), status: "unavailable" }];
  const parsed = studioGoalManifestSchema.parse(manifest);
  if ((await studioGoalManifestHash(parsed)) !== origin.goalManifestSha256)
    return [{ ...structuredClone(origin), status: "hash-mismatch" }];
  return [{ ...structuredClone(origin), status: "resolved", manifest: parsed }];
}

/** A portable resolved bundle must prove its own exact identity/hash; never trust a status label. */
export async function verifyStudioSources(
  origin: StudioModel["origin"],
  sources: StudioSource[] | undefined,
) {
  if (!sources?.length) return;
  const source = sources[0];
  if (
    !origin ||
    !source ||
    sources.length !== 1 ||
    contractCanonical({
      example: source.example,
      goalManifestSha256: source.goalManifestSha256,
    }) !== contractCanonical(origin)
  )
    throw new Error("Studio source bundle does not match the saved origin.");
  if (
    source.status === "resolved" &&
    (contractCanonical(source.manifest.example) !== contractCanonical(origin.example) ||
      (await studioGoalManifestHash(source.manifest)) !== origin.goalManifestSha256)
  )
    throw new Error("Studio source manifest identity/hash mismatch.");
}

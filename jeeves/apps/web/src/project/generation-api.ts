import { ApiError } from "./api.ts";

export type GenerationSource = { profileId: string; baseRevision: number; sourceSha256: string };
export type GenerationPreview = {
  status: "experimental-partial";
  selectedSource: {
    projectId: string;
    revision: number;
    canonicalSha256: string;
    matchesFrozenProfile: true;
  };
  profile: {
    id: string;
    version: string;
    projectId: string;
    revision: number;
    sourceSnapshot: string;
  };
  generator: { id: string; version: string };
  archive: {
    filename: string;
    format: string;
    bytes: number;
    sha256: string;
    manifestSha256: string;
    files: number;
    payloadBytes: number;
  };
  templates: { id: string; version: string; sourceSha256: string }[];
  settings: Record<string, number>;
  report: {
    strictReadiness: { generationEligible: boolean };
    gaps: { id: string; task: string; status: string }[];
    settings: { artifact: string; sourcePath: string; note: string; status: string }[];
    extensionTasks: { id: string }[];
    scenarios: { id: string; status: string }[];
  };
};

async function call(
  id: string,
  action: "preview" | "download",
  body: GenerationSource & { archiveSha256?: string },
  signal: AbortSignal,
) {
  const response = await fetch(`/api/projects/${id}/experimental-generation/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new ApiError(
      response.status,
      `${error.code ? `${error.code}: ` : ""}${error.message ?? "Experimental generation failed. Retry preview."}`,
    );
  }
  return response;
}
export const previewGeneration = async (
  id: string,
  source: GenerationSource,
  signal: AbortSignal,
) => (await (await call(id, "preview", source, signal)).json()) as GenerationPreview;
export const downloadGeneration = (
  id: string,
  source: GenerationSource,
  archiveSha256: string,
  signal: AbortSignal,
) => call(id, "download", { ...source, archiveSha256 }, signal);

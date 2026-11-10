import { ApiError } from "./api.ts";

export type GenerationSource = { profileId: string; baseRevision: number; sourceSha256: string };
export type LegacyGenerationPreview = {
  mode: "legacy-exact-v1";
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

type ContractRef = { id: string; version: string; sha256: string };
export type V2GenerationPreview = {
  mode: "selected-source-v2";
  status: "experimental-complete" | "experimental-partial";
  selectedSource: Omit<LegacyGenerationPreview["selectedSource"], "matchesFrozenProfile"> & {
    matchesFrozenProfile: false;
  };
  generator: LegacyGenerationPreview["generator"];
  archive: LegacyGenerationPreview["archive"];
  runtime: ContractRef;
  preset?: ContractRef;
  registry: { sha256: string };
  input: { sourceSha256: string; sourceCanonicalSha256: string; normalizedInputSha256: string };
  templates: { selection: string; ref: ContractRef }[];
  report: {
    semanticComplete: boolean;
    applicationComplete: boolean;
    runtimeVerification: "none";
    strictReadiness: "not-assessed";
    selections: {
      selection: string;
      status: "implemented" | "unfinished" | "unsupported";
      consumers: { input: string; consumer: string; outputPaths: string[] }[];
    }[];
    gaps: { emitter: string; id: string; status: string; description: string; required: boolean }[];
    findings: { code: string; message: string }[];
    settings: { input: string; implementationStatus: string }[];
    localAdapterTreatments: { sourcePath: (string | number)[]; actual: string; reason: string }[];
    /** Only with Runnable processes on: each application tile's process. */
    processes?: {
      runnable: boolean;
      tiles: {
        tile: string;
        name: string;
        service: string;
        shape: "http" | "worker";
        exposure?: "public" | "internal";
        routes: { method: string; path: string }[];
        loops: { queue: string; module: string }[];
      }[];
    };
  };
};
export type GenerationPreview = LegacyGenerationPreview | V2GenerationPreview;

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

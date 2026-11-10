import { type DesignDocument, designGeneration, resolveGeneration } from "@jeeves/spec";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { api } from "../project/api.ts";
import { formDrafts } from "../project/form-drafts.ts";
import {
  downloadGeneration,
  type GenerationPreview,
  type GenerationSource,
  previewGeneration,
} from "../project/generation-api.ts";
import { useProject } from "../project/store.ts";
import { useGenerationSupport } from "../studio/generation-support.ts";
import { captureJson, sha256 } from "./diagramCapture.ts";
import { GenerationModules } from "./GenerationModules.tsx";
import { LegacyGenerationDetails } from "./LegacyGenerationDetails.tsx";
import { V2GenerationDetails } from "./V2GenerationDetails.tsx";
import "./generation.css";

export function GenerateProject({ onClose }: { onClose: () => void }) {
  const installed = useGenerationSupport();
  const loaded = useProject((state) => state.loaded);
  const historyBusy = useProject((state) => state.historyBusy);
  useSyncExternalStore(formDrafts.subscribe, formDrafts.snapshot);
  const [preview, setPreview] = useState<{
    data: GenerationPreview;
    source: GenerationSource;
    design: DesignDocument;
  }>();
  const [busy, setBusy] = useState<"preview" | "download">();
  const [error, setError] = useState<string>();
  const [downloaded, setDownloaded] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  if (!loaded) return null;
  const hasDrafts = formDrafts
    .forProject(loaded.project.id)
    .some((draft) => draft.flight || draft.paths.size);
  const settled = !historyBusy && !hasDrafts;
  const validPreview = preview?.design === loaded.design && settled ? preview : undefined;
  const run = async (action: "preview" | "download") => {
    const controller = new AbortController();
    active.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]);
    const { project, design } = loaded;
    const canonical = captureJson(design);
    setBusy(action);
    setError(undefined);
    setDownloaded(false);
    const assertCurrent = () => {
      signal.throwIfAborted();
      const state = useProject.getState();
      if (
        state.status !== "ready" ||
        state.loaded?.project.id !== project.id ||
        state.loaded.design !== design ||
        state.historyBusy ||
        formDrafts.forProject(project.id).some((draft) => draft.flight || draft.paths.size)
      )
        throw new Error(
          "The project changed or has unsaved edits. Finish saving, then preview again.",
        );
    };
    const assertSaved = async () => {
      assertCurrent();
      const saved = await api.getDesign(project.id, signal);
      assertCurrent();
      if (captureJson(saved.design) !== canonical)
        throw new Error(
          "The saved revision differs from this canvas. Reload the project, then preview again.",
        );
    };
    try {
      await assertSaved();
      const source = {
        profileId: designGeneration(design) ? "selected-source-v2" : "youtube-local-v1",
        baseRevision: design.revision,
        sourceSha256: await sha256(new TextEncoder().encode(canonical)),
      };
      assertCurrent();
      if (action === "preview") {
        setPreview(undefined);
        const data = await previewGeneration(project.id, source, signal);
        await assertSaved();
        setPreview({ data, source, design });
      } else {
        if (!validPreview) throw new Error("Preview this saved source before downloading.");
        const response = await downloadGeneration(
          project.id,
          source,
          validPreview.data.archive.sha256,
          signal,
        );
        const bytes = new Uint8Array(await response.arrayBuffer());
        const hash = await sha256(bytes);
        if (
          hash !== validPreview.data.archive.sha256 ||
          response.headers.get("X-Archive-Sha256") !== hash ||
          bytes.length !== validPreview.data.archive.bytes
        )
          throw new Error("The archive differs from preview. Preview again before downloading.");
        await assertSaved();
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = validPreview.data.archive.filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        setDownloaded(true);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setPreview(undefined);
        setError(
          signal.aborted
            ? "Generation timed out. Check the server and preview again."
            : error instanceof Error
              ? error.message
              : "Generation failed. Preview again.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setBusy(undefined);
      if (active.current === controller) active.current = null;
    }
  };
  const data = validPreview?.data;
  const v2 = !!designGeneration(loaded.design);
  const support = v2 ? resolveGeneration(loaded.design, installed) : undefined;
  return (
    <ConfigurationDialog
      title="Generate experimental project"
      size="lg"
      onClose={onClose}
      footer={
        <div className="generation-actions">
          <button type="button" disabled={!!busy || !settled} onClick={() => void run("preview")}>
            {busy === "preview" ? "Preparing preview…" : "Preview scaffold"}
          </button>
          <button
            type="button"
            disabled={!!busy || !validPreview}
            onClick={() => void run("download")}
          >
            {busy === "download" ? "Preparing ZIP…" : "Download project ZIP"}
          </button>
        </div>
      }
    >
      <div className="generation-preview">
        <p>
          <strong>Experimental project export</strong> ·{" "}
          {v2 ? "Selected source · local v2" : "Exact frozen local v1"}
        </p>
        <p>
          {v2
            ? "Generate the selected saved design using installed templates. Preview lists actual support and required custom hooks."
            : "Legacy export requires the exact frozen snapshot005 source (revision 3). Other designs need explicit supported generation selections."}
        </p>
        <p className="studio-field-help">
          Preview checks this canvas against the saved source. No project edits are made.
          Experimental export does not certify strict TinyURL readiness or runtime behavior.
        </p>
        <GenerationModules design={loaded.design} />
        {support ? (
          <p>
            {support.complete
              ? "Selected bindings and settings are supported by the installed registry. Preview checks emitted consumers and custom gaps."
              : `Generation support needs attention: ${support.findings.length} findings. No older baseline will be substituted.`}
          </p>
        ) : null}
        {support?.findings.length ? (
          <details>
            <summary>Generation support findings</summary>
            <ul>
              {support.findings.map((finding) => (
                <li key={JSON.stringify([finding.code, finding.target])}>{finding.message}</li>
              ))}
            </ul>
          </details>
        ) : null}
        {!settled ? (
          <p role="alert">Finish saving edits and history actions before previewing.</p>
        ) : null}
        {preview && !validPreview ? (
          <p role="alert">The source changed. Preview the settled saved source again.</p>
        ) : null}
        {busy ? <p role="status">Checking the saved source and trusted template assets…</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {data ? (
          <>
            <p role="status">
              Ready: {data.archive.files} files · {(data.archive.bytes / 1024).toFixed(0)} KiB ZIP ·{" "}
              {data.templates.length} selected template entries.
            </p>
            {data.mode === "legacy-exact-v1" ? (
              <LegacyGenerationDetails data={data} />
            ) : (
              <V2GenerationDetails data={data} />
            )}
            <p className="studio-field-help">
              Extract into a new directory and follow README. Existing work is not merged; provision
              runtime secrets separately.
            </p>
          </>
        ) : null}
        {downloaded ? (
          <p role="status">
            Project ZIP downloaded. Review README and .jeeves/report.json before running.
          </p>
        ) : null}
      </div>
    </ConfigurationDialog>
  );
}

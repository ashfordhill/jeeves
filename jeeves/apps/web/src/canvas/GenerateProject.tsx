import type { DesignDocument } from "@jeeves/spec";
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
import { captureJson, sha256 } from "./diagramCapture.ts";
import "./generation.css";

export function GenerateProject({ onClose }: { onClose: () => void }) {
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
        profileId: "youtube-local-v1",
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
          <strong>Experimental partial scaffold</strong> · YouTube local v1
        </p>
        <p>
          Standalone service/worker shells, local resources and extension points. Upload, encoding,
          playback, search and counts still need custom work. This is not a working YouTube app or
          certified output.
        </p>
        <p className="studio-field-help">
          Only frozen snapshot005 (saved revision 3) is supported. Preview checks this canvas
          against the saved source. No project edits are made.
        </p>
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
              {data.templates.length} experimental template families.
            </p>
            <details open>
              <summary>Included foundations</summary>
              <p>
                TypeScript HTTP/worker shells, signed multipart and FFmpeg integration points,
                PostgreSQL/Redis/AMQP clients, S3 storage, OIDC identity, search and edge
                configuration, Docker Compose, exact dependency locks, setup scripts and README.
              </p>
              <p>
                Includes the frozen diagram PNG, five source inputs, per-file hashes and provenance,
                and the full <code>.jeeves/report.json</code>.
              </p>
            </details>
            <details>
              <summary>
                Missing behavior · G01–G08 · {data.report.extensionTasks.length} custom extensions
              </summary>
              <ul>
                {data.report.gaps.map((gap) => (
                  <li key={gap.id}>
                    <strong>{gap.id}</strong> {gap.task}
                  </li>
                ))}
              </ul>
              <p>
                S01–S08 business scenarios remain unrun; functional coverage is unmeasured.
                Incomplete endpoints/workers fail explicitly.
              </p>
            </details>
            <details>
              <summary>Local substitutions & {data.settings.unsupported} unsupported paths</summary>
              <p>
                The frozen design already normalizes storage and edge providers for local use.
                Remaining unsupported intent: Java Keycloak replaces the identity tile’s declared
                TypeScript runtime; six HTTPS links use local HTTP; eighteen service-identity
                declarations have no mTLS/workload-identity implementation. Dedicated resource
                credentials do not establish service identity or production-security equivalence.
              </p>
              <ul>
                {data.report.settings
                  .filter((item) => item.status === "unsupported")
                  .map((item) => (
                    <li key={`${item.artifact}:${item.sourcePath}`}>
                      <code>{item.sourcePath}</code>
                      <p>{item.note}</p>
                    </li>
                  ))}
              </ul>
            </details>
            <details>
              <summary>Source, versions & strict compatibility</summary>
              <p>
                Selected project: <code>{data.selectedSource.projectId}</code>, saved revision{" "}
                {data.selectedSource.revision}. Its complete canonical source exactly matches the
                frozen profile.
              </p>
              <p>
                Archive inputs retain frozen origin <code>{data.profile.projectId}</code>, revision{" "}
                {data.profile.revision}, snapshot005. An identical copy does not rewrite that
                historical provenance.
              </p>
              <p>
                {data.generator.id} {data.generator.version} · profile {data.profile.id}@
                {data.profile.version}
              </p>
              <p>
                Strict generation eligible:{" "}
                <strong>{data.report.strictReadiness.generationEligible ? "yes" : "no"}</strong>.
                Strict template availability and runtime evidence remain none. Partial export does
                not change the compatibility contract.
              </p>
              <p>
                Settings: {data.settings.emitted} emitted, {data.settings["configuration-only"]}{" "}
                configuration only, {data.settings.custom} custom, {data.settings.unsupported}{" "}
                unsupported, {data.settings.unimplemented} untreated.
              </p>
              <p>
                Source SHA256 <code>{data.selectedSource.canonicalSha256}</code>
              </p>
              <p>
                ZIP SHA256 <code>{data.archive.sha256}</code>
              </p>
              <p>
                Manifest SHA256 <code>{data.archive.manifestSha256}</code>
              </p>
              <ul>
                {data.templates.map((template) => (
                  <li key={template.id}>
                    {template.id}@{template.version}
                  </li>
                ))}
              </ul>
            </details>
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

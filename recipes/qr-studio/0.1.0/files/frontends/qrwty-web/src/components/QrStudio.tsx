import { ConfigurationEditor, Feedback } from "@jeeves/product-ui";
import {
  type ArtworkSettings,
  artworkPresets,
  artworkSettingsSchema,
  defaultSettings,
} from "@jeeves/qr-artwork/settings";
import { useApis } from "@jeeves/web-runtime";
import { useEffect, useRef, useState } from "react";
import type { paths } from "../clients/qrwty.openapi.ts";
import type { app } from "../jeeves.generated.ts";
import { message } from "./apiMessage.ts";
import { CopyLink } from "./CopyLink.tsx";

type History = paths["/api/qr/{id}/studio"]["get"]["responses"][200]["content"]["application/json"];
type Revision = History["items"][number];
type Artifact =
  paths["/api/qr/{id}/artwork/preview"]["post"]["responses"][200]["content"]["application/json"];
export type StudioDraft = {
  settings: ArtworkSettings;
  base: Revision | null;
  requestId: string;
  edited: boolean;
};
const same = (left: ArtworkSettings, right: ArtworkSettings) =>
  JSON.stringify(left) === JSON.stringify(right);
export const hasDraftChanges = (draft: StudioDraft) =>
  !same(draft.settings, draft.base?.settings ?? defaultSettings);
const fresh = (base: Revision | null): StudioDraft => ({
  settings: { ...(base?.settings ?? defaultSettings) },
  base,
  requestId: crypto.randomUUID(),
  edited: false,
});

async function downloadArtifact(artifact: Artifact) {
  const bytes = Uint8Array.from(atob(artifact.bytesBase64), (character) => character.charCodeAt(0));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== artifact.sha256)
    throw new Error("The download could not be verified. Please retry.");
  const url = URL.createObjectURL(new Blob([bytes], { type: artifact.contentType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = artifact.filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function QrStudio({
  id,
  csrfToken,
  drafts,
  onUnauthorized,
}: {
  id: string;
  csrfToken: string;
  drafts: Map<string, StudioDraft>;
  onUnauthorized: () => void;
}) {
  const { qrwty: client } = useApis<typeof app.apis>();
  const [draft, setDraft] = useState<StudioDraft | undefined>(() => drafts.get(id));
  const [history, setHistory] = useState<History | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState<{ key: string; artifact: Artifact } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const mounted = useRef(true);
  const generation = useRef(0);
  const historyGeneration = useRef(0);
  const unauthorized = useRef(onUnauthorized);
  unauthorized.current = onUnauthorized;
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  const store = (next: StudioDraft) => {
    drafts.set(id, next);
    currentDraft.current = next;
    setDraft(next);
  };

  async function load(cursor?: string) {
    const version = ++historyGeneration.current;
    setLoading(true);
    setLoadError("");
    try {
      const { data, error, response } = await client.GET("/api/qr/{id}/studio", {
        params: { path: { id }, query: { limit: 12, ...(cursor ? { cursor } : {}) } },
      });
      if (!mounted.current || version !== historyGeneration.current) return;
      if (response.status === 401) return unauthorized.current();
      if (!data) {
        setLoadError(message(error));
        return;
      }
      setHistory((previous) =>
        cursor && previous
          ? {
              ...data,
              items: [
                ...new Map(
                  [...previous.items, ...data.items].map((item) => [item.id, item]),
                ).values(),
              ],
            }
          : data,
      );
      if (!cursor) {
        const cached = drafts.get(id);
        const recovered =
          cached &&
          data.items.find(
            (item) => item.id === cached.requestId && same(item.settings, cached.settings),
          );
        store(recovered ? fresh(recovered) : (cached ?? fresh(data.items[0] ?? null)));
      }
    } catch {
      if (mounted.current && version === historyGeneration.current)
        setLoadError("We couldn’t load this Studio. Please retry.");
    } finally {
      if (mounted.current && version === historyGeneration.current) setLoading(false);
    }
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset on client or QR identity changes; the load closure reads current identity and draft refs.
  useEffect(() => {
    mounted.current = true;
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
      mounted.current = false;
      generation.current++;
      historyGeneration.current++;
    };
  }, [client, id]);

  const parsed = draft && artworkSettingsSchema.safeParse(draft.settings);
  const valid = parsed?.success === true;
  const key = draft ? JSON.stringify(draft.settings) : "";
  const dirty = draft ? hasDraftChanges(draft) : false;
  const saved = Boolean(draft?.base && !dirty);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Canonical settings key, history readiness and explicit retry trigger previews; saving the same draft must not re-preview.
  useEffect(() => {
    const version = ++generation.current;
    setPreviewError("");
    if (!draft || !valid || !history) return;
    const settings = artworkSettingsSchema.parse(draft.settings);
    const timer = setTimeout(() => {
      void client
        .POST("/api/qr/{id}/artwork/preview", {
          params: { path: { id } },
          body: { settings },
          headers: { "x-csrf-token": csrfToken },
        })
        .then(({ data, error, response }) => {
          if (!mounted.current || version !== generation.current) return;
          if (response.status === 401) return unauthorized.current();
          if (!data) {
            setPreviewError(message(error));
            return;
          }
          setPreview({ key, artifact: data });
        })
        .catch(() => {
          if (mounted.current && version === generation.current)
            setPreviewError("We couldn’t update the preview. Your changes are still here.");
        });
    }, 350);
    // Do not abort a dispatched HTTP request; stale results simply cannot replace a newer preview.
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [client, id, csrfToken, key, valid, Boolean(history), previewAttempt]);

  function change(settings: ArtworkSettings) {
    if (!draft || saving) return;
    store({ ...draft, settings, edited: true, requestId: crypto.randomUUID() });
    setError("");
  }
  async function save() {
    const current = currentDraft.current;
    if (!current || saving) return;
    const parsed = artworkSettingsSchema.safeParse(current.settings);
    if (!parsed.success) return;
    setSaving(true);
    setError("");
    try {
      const { data, error, response } = await client.POST("/api/qr/{id}/artwork", {
        params: { path: { id } },
        body: { requestId: current.requestId, settings: parsed.data },
        headers: { "x-csrf-token": csrfToken },
      });
      if (!mounted.current) return;
      if (response.status === 401) return unauthorized.current();
      if (!data) {
        setError(message(error));
        return;
      }
      store(fresh(data));
      setHistory((previous) =>
        previous
          ? { ...previous, items: [data, ...previous.items.filter((item) => item.id !== data.id)] }
          : previous,
      );
    } catch {
      if (mounted.current)
        setError("We couldn’t confirm this save. Retry to check the same save request.");
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
  async function exportSaved(format: "png" | "svg") {
    if (!draft?.base || dirty || exporting || saving) return;
    setExporting(true);
    setError("");
    try {
      const { data, error, response } = await client.GET("/api/qr/{id}/artwork/{revision}/export", {
        params: { path: { id, revision: draft.base.id }, query: { format } },
      });
      if (!mounted.current) return;
      if (response.status === 401) return unauthorized.current();
      if (!data) {
        setError(message(error));
        return;
      }
      await downloadArtifact(data);
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "We couldn’t download this design. Please retry.",
        );
    } finally {
      if (mounted.current) setExporting(false);
    }
  }

  if (!history || !draft)
    return (
      <section className="panel studio-loading">
        {loadError ? (
          <Feedback kind="error">
            {loadError}{" "}
            <button type="button" onClick={() => void load()}>
              Retry Studio
            </button>
          </Feedback>
        ) : (
          <Feedback>Opening your Studio…</Feedback>
        )}
        <a href="#library">Back to QR library</a>
      </section>
    );
  const selectedPreset = artworkPresets.find((preset) => same(preset.settings, draft.settings))?.id;
  const previewCurrent = preview?.key === key;
  const presets = artworkPresets.map((preset) => ({
    id: preset.id,
    name: preset.name,
    value: { ...preset.settings },
    sample: (
      <span
        className="studio-preset-swatch"
        style={{ background: preset.settings.background, color: preset.settings.foreground }}
      >
        <span />
        <span />
        <span />
        <i />
      </span>
    ),
  }));
  const historyItems =
    draft.base && !history.items.some((item) => item.id === draft.base?.id)
      ? [...history.items, draft.base]
      : history.items;
  return (
    <div className="studio-workspace">
      <div className="studio-context">
        <div>
          <p className="eyebrow">YOUR PERMANENT LINK</p>
          <h2>{history.qr.title || "Untitled QR"}</h2>
          <a href={history.canonicalUrl}>{history.canonicalUrl}</a>
        </div>
        <CopyLink value={history.canonicalUrl} />
      </div>
      {error && <Feedback kind="error">{error}</Feedback>}
      <ConfigurationEditor
        presets={presets}
        selectedPreset={selectedPreset}
        onPreset={change}
        guardChanges={dirty}
        status={saving ? "saving" : saved ? "saved" : draft.edited ? "draft" : "new"}
        canSave={valid && !saved}
        canReset={dirty}
        onSave={() => void save()}
        onReset={() => {
          store(fresh(draft.base));
          setError("");
        }}
        saveLabel="Save design"
        testIdPrefix="studio"
        actions={
          <>
            <button
              type="button"
              data-testid="studio-export-png"
              disabled={!saved || saving || exporting}
              onClick={() => void exportSaved("png")}
            >
              PNG <span aria-hidden="true">↓</span>
            </button>
            <button
              type="button"
              data-testid="studio-export-svg"
              disabled={!saved || saving || exporting}
              onClick={() => void exportSaved("svg")}
            >
              SVG <span aria-hidden="true">↓</span>
            </button>
          </>
        }
        preview={
          <div className="studio-preview-content">
            <div className={`studio-preview-stage ${!previewCurrent ? "is-updating" : ""}`}>
              {preview ? (
                <img
                  data-testid="studio-preview"
                  src={`data:image/png;base64,${preview.artifact.bytesBase64}`}
                  alt={`QR design for ${history.qr.title || "your permanent link"}`}
                  width={preview.artifact.checks.modulePixels * preview.artifact.checks.modules}
                />
              ) : (
                <div className="studio-preview-placeholder">Preparing your preview…</div>
              )}
            </div>
            <div className="studio-preview-caption" role="status">
              {!valid
                ? "Check your settings to update the preview."
                : previewError
                  ? "Preview needs a retry."
                  : !previewCurrent
                    ? "Updating preview…"
                    : "Your permanent link, in your style."}
            </div>
            {previewError && (
              <Feedback kind="error">
                {previewError}{" "}
                <button type="button" onClick={() => setPreviewAttempt((n) => n + 1)}>
                  Retry preview
                </button>
              </Feedback>
            )}
            {previewCurrent && preview && (
              <div className="studio-checks">
                <span>
                  <b>{preview.artifact.checks.contrastRatio.toFixed(1)}:1</b> contrast
                </span>
                <span>
                  <b>{preview.artifact.checks.quietZone} modules</b> quiet zone
                </span>
                <span>
                  <b>Decode checked</b> PNG preview
                </span>
              </div>
            )}
            <p className="studio-reassurance">
              The destination can change. Your saved design stays the same.
            </p>
          </div>
        }
      >
        <fieldset className="studio-controls" disabled={saving}>
          <legend>Make it yours</legend>
          {(["foreground", "background"] as const).map((name) => (
            <label key={name} className="studio-color-label">
              {name === "foreground" ? "Ink color" : "Paper color"}
              <span className="studio-color-input">
                <input
                  type="color"
                  aria-label={`${name} color picker`}
                  value={
                    /^#[0-9a-f]{6}$/i.test(draft.settings[name]) ? draft.settings[name] : "#FFFFFF"
                  }
                  onChange={(e) =>
                    change({ ...draft.settings, [name]: e.target.value.toUpperCase() })
                  }
                />
                <input
                  data-testid={`studio-${name}`}
                  aria-label={`${name} hex color`}
                  value={draft.settings[name]}
                  maxLength={7}
                  spellCheck={false}
                  onChange={(e) =>
                    change({ ...draft.settings, [name]: e.target.value.toUpperCase() })
                  }
                />
              </span>
            </label>
          ))}
          {(["moduleStyle", "finderStyle"] as const).map((name) => (
            <fieldset className="studio-shape" key={name}>
              <legend>{name === "moduleStyle" ? "Pattern" : "Corner style"}</legend>
              <div>
                {(["square", "rounded"] as const).map((value) => (
                  <button
                    type="button"
                    aria-pressed={draft.settings[name] === value}
                    onClick={() => change({ ...draft.settings, [name]: value })}
                    key={value}
                  >
                    <i aria-hidden="true" className={`studio-shape-icon ${value}`} />
                    {value === "square" ? "Square" : "Rounded"}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <label>
            Export size
            <select
              value={draft.settings.size}
              onChange={(e) =>
                change({
                  ...draft.settings,
                  size: Number(e.target.value) as ArtworkSettings["size"],
                })
              }
            >
              <option value={256}>256 × 256 px</option>
              <option value={512}>512 × 512 px</option>
              <option value={1024}>1024 × 1024 px</option>
            </select>
          </label>
          <details className="studio-advanced">
            <summary>Advanced settings</summary>
            <label>
              Quiet zone
              <select
                value={draft.settings.quietZone}
                onChange={(e) => change({ ...draft.settings, quietZone: Number(e.target.value) })}
              >
                {[4, 5, 6, 7, 8].map((n) => (
                  <option value={n} key={n}>
                    {n} modules
                  </option>
                ))}
              </select>
            </label>
            <label>
              Error correction
              <select
                value={draft.settings.errorCorrection}
                onChange={(e) =>
                  change({
                    ...draft.settings,
                    errorCorrection: e.target.value as ArtworkSettings["errorCorrection"],
                  })
                }
              >
                <option value="M">M · Balanced</option>
                <option value="Q">Q · More recovery</option>
                <option value="H">H · Most recovery</option>
              </select>
            </label>
            <p>
              Keep a clear border around the code. Test a printed sample before a large print run.
            </p>
          </details>
          {!valid && parsed && !parsed.success && (
            <Feedback kind="error">{parsed.error.issues[0]?.message}</Feedback>
          )}
        </fieldset>
      </ConfigurationEditor>
      <section className="studio-history" aria-labelledby="studio-history-heading">
        <div>
          <h2 id="studio-history-heading">Saved designs</h2>
          <p>
            Each save keeps its own exports. Your printed QR link always points to the latest
            destination.
          </p>
        </div>
        {historyItems.length ? (
          <div className="studio-history-picker">
            <label>
              Design history
              <select
                aria-label="Design history"
                disabled={dirty || saving}
                value={draft.base?.id ?? ""}
                onChange={(e) => {
                  const selected = historyItems.find((item) => item.id === e.target.value);
                  if (selected) store(fresh(selected));
                }}
              >
                <option value="" disabled>
                  Unsaved design
                </option>
                {historyItems.map((item) => (
                  <option value={item.id} key={item.id}>
                    {new Date(item.savedAt).toLocaleString()} · {item.settings.size}px ·{" "}
                    {item.settings.moduleStyle}
                  </option>
                ))}
              </select>
            </label>
            {dirty && <small>Save or reset your changes before switching designs.</small>}
            {history.nextCursor && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void load(history.nextCursor!)}
              >
                {loading ? "Loading…" : "Load older designs"}
              </button>
            )}
          </div>
        ) : (
          <p className="muted">Save your first design to enable PNG and SVG downloads.</p>
        )}
        {loadError && (
          <Feedback kind="error">
            {loadError}{" "}
            <button type="button" onClick={() => void load(history.nextCursor ?? undefined)}>
              Retry history
            </button>
          </Feedback>
        )}
      </section>
    </div>
  );
}

import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

export type ConfigurationPreset<T> = {
  id: string;
  name: string;
  value: T;
  sample?: ReactNode;
};
export type ConfigurationEditorProps<T> = {
  presets: readonly ConfigurationPreset<T>[];
  selectedPreset?: string;
  onPreset: (value: T) => void;
  guardChanges: boolean;
  status: "new" | "draft" | "saving" | "saved";
  canSave: boolean;
  canReset: boolean;
  onSave: () => void;
  onReset: () => void;
  saveLabel?: string;
  preview: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  testIdPrefix?: string;
};

/** Controlled editor chrome; the consumer owns schemas, persistence, validation and requests. */
export function ConfigurationEditor<T>({
  presets,
  selectedPreset,
  onPreset,
  guardChanges,
  status,
  canSave,
  canReset,
  onSave,
  onReset,
  saveLabel = "Save configuration",
  preview,
  children,
  actions,
  testIdPrefix = "configuration",
}: ConfigurationEditorProps<T>) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<
    { kind: "reset" } | { kind: "preset"; preset: ConfigurationPreset<T> } | null
  >(null);
  const busy = status === "saving";
  useEffect(() => {
    if (pending && !dialog.current?.open) dialog.current?.showModal();
    if (!pending && dialog.current?.open) dialog.current.close();
  }, [pending]);
  const applyPreset = (preset: ConfigurationPreset<T>) => {
    if (guardChanges) setPending({ kind: "preset", preset });
    else onPreset(preset.value);
  };
  const reset = () => {
    if (guardChanges) setPending({ kind: "reset" });
    else onReset();
  };
  const confirm = () => {
    if (busy) return;
    if (pending?.kind === "preset") onPreset(pending.preset.value);
    else if (pending?.kind === "reset") onReset();
    setPending(null);
  };
  return (
    <section className="jui-configuration" aria-label="Configuration editor">
      <div className="jui-config-toolbar">
        <span className={`jui-config-state jui-config-${status}`} role="status">
          {status === "new"
            ? "Not saved yet"
            : status === "draft"
              ? "Unsaved changes"
              : status === "saving"
                ? "Saving…"
                : "Saved revision"}
        </span>
        <div className="jui-config-actions">
          <button
            type="button"
            data-testid={`${testIdPrefix}-reset`}
            disabled={!canReset || busy}
            onClick={reset}
          >
            Reset changes
          </button>
          <button
            type="button"
            className="jui-config-save"
            data-testid={`${testIdPrefix}-save`}
            disabled={!canSave || busy}
            onClick={onSave}
          >
            {busy ? "Saving…" : saveLabel}
          </button>
          {actions}
        </div>
      </div>
      <div className="jui-config-grid">
        <aside className="jui-config-presets" aria-labelledby={`${id}-presets`}>
          <h2 id={`${id}-presets`}>Start with a preset</h2>
          <div className="jui-config-preset-list">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-label={preset.name}
                aria-pressed={selectedPreset === preset.id}
                disabled={busy}
                onClick={() => applyPreset(preset)}
              >
                {preset.sample && (
                  <span className="jui-config-sample" aria-hidden="true">
                    {preset.sample}
                  </span>
                )}
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </aside>
        <div className="jui-config-preview">{preview}</div>
        <div className="jui-config-controls">{children}</div>
      </div>
      <dialog
        ref={dialog}
        className="jui-config-dialog"
        aria-labelledby={`${id}-confirm`}
        onCancel={() => setPending(null)}
        onClose={() => setPending(null)}
      >
        <h2 id={`${id}-confirm`}>Replace unsaved changes?</h2>
        <p>
          {pending?.kind === "preset"
            ? `Apply ${pending.preset.name} in place of your current changes.`
            : "Return to the configuration you started with."}
        </p>
        <div className="jui-config-actions">
          <button type="button" onClick={() => setPending(null)}>
            Keep editing
          </button>
          <button type="button" onClick={confirm} disabled={busy}>
            {pending?.kind === "preset" ? "Use preset" : "Discard changes"}
          </button>
        </div>
      </dialog>
    </section>
  );
}

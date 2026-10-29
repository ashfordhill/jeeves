/**
 * Schema-driven config form: one Mantine input per field of the template's config JSON Schema.
 * Fields show the effective value (what's stored, else the default), so steppers and selects
 * start from what the template would use; a reset button clears a stored value back to the
 * default. A value is checked with the template's Zod schema before it's sent, so a malformed
 * value shows an error at the field instead of being rejected by the server. Readiness findings
 * for a field (a required value that isn't set) show at the field too.
 */
import type { ConfigValues, Finding, TemplateManifest } from "@jeeves/spec";
import { NativeSelect, Switch } from "@mantine/core";
import { IconRestore } from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import {
  type ConfigField,
  configErrors,
  configFields,
  formatFieldValue,
  parseFieldInput,
  withValue,
} from "./configFields.ts";
import { DraftNumberInput, DraftTextarea, DraftTextInput } from "./fields.tsx";

const NOT_SET = "";

/** A stored value that the default would give anyway, or no change at all, isn't worth an edit. */
function isNoop(field: ConfigField, stored: unknown, value: unknown): boolean {
  const effective = (v: unknown) => JSON.stringify(v === undefined ? field.default : v);
  return stored === undefined
    ? effective(value) === effective(undefined)
    : effective(stored) === effective(value);
}

export function ConfigForm({
  schema,
  manifest,
  config,
  findings,
  onCommit,
}: {
  schema: Record<string, unknown>;
  manifest: TemplateManifest | undefined;
  config: ConfigValues;
  findings: readonly Finding[];
  onCommit: (config: ConfigValues) => void;
}) {
  const fields = configFields(schema);
  // Errors for values that were typed but not sent, by key.
  const [local, setLocal] = useState<Record<string, string>>({});
  if (fields.length === 0) return <p className="inspector-empty">This template has no settings.</p>;

  const setLocalError = (key: string, message: string | undefined) =>
    setLocal((prev) => {
      const { [key]: _, ...rest } = prev;
      return message ? { ...rest, [key]: message } : rest;
    });

  /** Sends the field's new value. Returns `true` when nothing was sent and nothing is wrong. */
  const commit = (field: ConfigField, value: unknown): boolean => {
    if (isNoop(field, config[field.key], value)) {
      setLocalError(field.key, undefined);
      return true;
    }
    const next = withValue(config, field.key, value);
    const problem = manifest ? configErrors(manifest.config, next)[field.key] : undefined;
    setLocalError(field.key, problem);
    if (!problem) onCommit(next);
    return false;
  };

  const commitText = (field: ConfigField, text: string): boolean => {
    const parsed = parseFieldInput(field, text);
    if (parsed.ok) return commit(field, parsed.value);
    setLocalError(field.key, parsed.message);
    return false;
  };

  return (
    <div className="inspector-fields">
      {fields.map((field) => {
        const stored = config[field.key];
        const shown = stored ?? field.default;
        const finding = findings.find((f) => f.target.path?.[0] === field.key);
        const error =
          local[field.key] ?? (finding?.code === "CONFIG_REQUIRED" ? "Required" : finding?.message);
        const resettable = stored !== undefined && field.default !== undefined;
        const withReset = (input: ReactNode) => (
          <div className="inspector-input-row">
            {input}
            {resettable ? (
              <button
                type="button"
                className="inspector-icon-btn"
                aria-label={`Reset ${field.title} to default (${String(field.default)})`}
                title={`Reset to default (${String(field.default)})`}
                onClick={() => commit(field, undefined)}
              >
                <IconRestore size={14} aria-hidden />
              </button>
            ) : null}
          </div>
        );
        const common = {
          label: field.title,
          description: field.description,
          required: field.required,
          error,
          inputContainer: withReset,
        };
        switch (field.type) {
          case "enum": {
            const data = [
              ...(field.default === undefined ? [{ value: NOT_SET, label: "Not set" }] : []),
              ...field.options.map((o) => ({
                value: o,
                label: o === field.default ? `${o} (default)` : o,
              })),
            ];
            return (
              <NativeSelect
                key={field.key}
                {...common}
                data={data}
                value={String(shown ?? NOT_SET)}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  commit(field, value === NOT_SET ? undefined : value);
                }}
              />
            );
          }
          case "boolean":
            return (
              <Switch
                key={field.key}
                label={field.title}
                description={field.description}
                error={error}
                checked={Boolean(shown ?? false)}
                onChange={(e) => commit(field, e.currentTarget.checked)}
              />
            );
          case "integer":
          case "number":
            return (
              <DraftNumberInput
                key={field.key}
                {...common}
                integer={field.type === "integer"}
                min={field.min}
                max={field.max}
                value={formatFieldValue(field, shown)}
                onCommit={(text) => commitText(field, text)}
              />
            );
          case "string":
            return (
              <DraftTextInput
                key={field.key}
                {...common}
                value={formatFieldValue(field, shown)}
                onCommit={(text) => commitText(field, text)}
              />
            );
          default:
            return (
              <DraftTextarea
                key={field.key}
                {...common}
                monospace
                minRows={2}
                placeholder="JSON"
                value={formatFieldValue(field, shown)}
                onCommit={(text) => commitText(field, text)}
              />
            );
        }
      })}
    </div>
  );
}

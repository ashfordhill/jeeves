/**
 * Inspector inputs that keep a local draft and commit once, when the field loses focus (or on
 * Enter for single-line fields), so each finished edit is one operation and one undo step.
 * The draft follows the stored value whenever it changes underneath (undo, chat, another tab).
 */
import { NumberInput, Textarea, TextInput } from "@mantine/core";
import { type ReactNode, useEffect, useState } from "react";

function useDraft(value: string, onCommit: DraftProps["onCommit"]) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value && onCommit(draft) === true) setDraft(value);
  };
  return [draft, setDraft, commit] as const;
}

type DraftProps = {
  label: ReactNode;
  value: string;
  /**
   * Called with the new text when it differs from `value`. Returning `true` means nothing will
   * change, so the field goes back to `value`.
   */
  onCommit: (text: string) => unknown;
  description?: ReactNode;
  placeholder?: string;
  error?: ReactNode;
  required?: boolean;
  /** Wraps the input, e.g. to put a button beside it (Mantine's `inputContainer`). */
  inputContainer?: (children: ReactNode) => ReactNode;
};

export function DraftTextInput(props: DraftProps) {
  const { value, onCommit, ...rest } = props;
  const [draft, setDraft, commit] = useDraft(value, onCommit);
  return (
    <TextInput
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function DraftTextarea(props: DraftProps & { minRows?: number; monospace?: boolean }) {
  const { value, onCommit, minRows = 3, monospace, ...rest } = props;
  const [draft, setDraft, commit] = useDraft(value, onCommit);
  return (
    <Textarea
      {...rest}
      autosize
      minRows={minRows}
      maxRows={16}
      classNames={monospace ? { input: "inspector-mono" } : undefined}
      value={draft}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.blur();
        else if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/**
 * Number field with Mantine's stepper buttons, so it can be changed by mouse alone. Clamping is
 * off: an out-of-range value gets an error message instead of being silently changed.
 */
export function DraftNumberInput(
  props: DraftProps & { min?: number; max?: number; integer?: boolean },
) {
  const { value, onCommit, min, max, integer, ...rest } = props;
  const [draft, setDraft, commit] = useDraft(value, onCommit);
  return (
    <NumberInput
      {...rest}
      min={min}
      max={max}
      allowDecimal={!integer}
      clampBehavior="none"
      value={draft}
      onChange={(next) => setDraft(String(next))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

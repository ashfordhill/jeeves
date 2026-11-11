// The Design tab's optional keyboard shortcuts; every one mirrors a button, so the mouse remains
// sufficient. They never act while focus is in a field, where the browser's own keys (typing, its
// text undo) belong, and history keys never act while a dialog is open.

type Keys = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

/** Focus is in an input, textarea, select or contenteditable. */
export function inField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** A dialog is open: a modal, the removal's confirmation or Choose relationship. */
export function dialogOpen(root: ParentNode = document): boolean {
  return root.querySelector('[role="dialog"], [role="alertdialog"], dialog[open]') !== null;
}

/** The history step a key press asks for: Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z and Ctrl+Y redo. */
export function historyKey(event: Keys): "undo" | "redo" | undefined {
  if (event.altKey || !(event.ctrlKey || event.metaKey)) return undefined;
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey) return "redo";
  return undefined;
}

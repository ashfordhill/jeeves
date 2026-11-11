// The Design tab's optional keys: which presses ask for Undo or Redo, and where none act.
import { describe, expect, it } from "vitest";
import { dialogOpen, historyKey, inField } from "./shortcuts.ts";

const press = (key: string, mods: Partial<Record<"ctrl" | "meta" | "shift" | "alt", boolean>>) =>
  historyKey({
    key,
    ctrlKey: !!mods.ctrl,
    metaKey: !!mods.meta,
    shiftKey: !!mods.shift,
    altKey: !!mods.alt,
  });

describe("historyKey", () => {
  it("undoes on Ctrl/Cmd+Z and redoes on Ctrl/Cmd+Shift+Z and Ctrl+Y", () => {
    expect(press("z", { ctrl: true })).toBe("undo");
    expect(press("z", { meta: true })).toBe("undo");
    // With Shift held the browser reports the capital letter.
    expect(press("Z", { ctrl: true, shift: true })).toBe("redo");
    expect(press("Z", { meta: true, shift: true })).toBe("redo");
    expect(press("y", { ctrl: true })).toBe("redo");
    // Caps Lock: the same keys.
    expect(press("Z", { ctrl: true })).toBe("undo");
    expect(press("Y", { ctrl: true })).toBe("redo");
  });

  it("ignores every other press", () => {
    expect(press("z", {})).toBeUndefined();
    expect(press("Z", { shift: true })).toBeUndefined();
    expect(press("y", {})).toBeUndefined();
    expect(press("y", { meta: true })).toBeUndefined();
    expect(press("Y", { ctrl: true, shift: true })).toBeUndefined();
    expect(press("z", { ctrl: true, alt: true })).toBeUndefined();
    expect(press("x", { ctrl: true })).toBeUndefined();
    expect(press("Control", { ctrl: true })).toBeUndefined();
  });
});

describe("inField", () => {
  it("is true in inputs, textareas, selects and contenteditables only", () => {
    const make = (html: string) => {
      const host = document.createElement("div");
      host.innerHTML = html;
      return host.firstElementChild;
    };
    expect(inField(make('<input id="name" />'))).toBe(true);
    expect(inField(make("<textarea></textarea>"))).toBe(true);
    expect(inField(make("<select></select>"))).toBe(true);
    const editable = make('<div contenteditable="true"></div>') as HTMLElement;
    // jsdom doesn't compute isContentEditable; the browser does.
    Object.defineProperty(editable, "isContentEditable", { value: true });
    expect(inField(editable)).toBe(true);
    expect(inField(make("<button>Undo</button>"))).toBe(false);
    expect(inField(document.body)).toBe(false);
    expect(inField(null)).toBe(false);
  });
});

describe("dialogOpen", () => {
  it("sees a modal, the removal's confirmation or Choose relationship", () => {
    const root = document.createElement("div");
    expect(dialogOpen(root)).toBe(false);
    root.innerHTML = '<section role="dialog" aria-label="Export diagram"></section>';
    expect(dialogOpen(root)).toBe(true);
    root.innerHTML = "<dialog open></dialog>";
    expect(dialogOpen(root)).toBe(true);
    root.innerHTML = "<dialog></dialog>";
    expect(dialogOpen(root)).toBe(false);
  });
});

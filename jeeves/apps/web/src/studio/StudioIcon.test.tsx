// Every kind's and module kind's icon is one of the studio's glyphs, never the unknown-name box.
import {
  studioComponentKinds,
  studioComponentVisuals,
  studioDefinitions,
  studioKinds,
} from "@jeeves/spec";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { StudioIcon } from "./StudioIcon.tsx";
import { STUDIO_GLYPHS } from "./studio-glyphs.ts";

afterEach(cleanup);

it("names a glyph for every kind and every module kind", () => {
  for (const kind of studioKinds)
    expect(Object.keys(STUDIO_GLYPHS)).toContain(studioDefinitions[kind].visual.icon);
  for (const kind of studioComponentKinds)
    expect(Object.keys(STUDIO_GLYPHS)).toContain(studioComponentVisuals[kind].icon);
});

it("draws a known name as its glyph", () => {
  const { container } = render(<StudioIcon name="cylinder" size={22} />);
  const svg = container.querySelector("svg");
  expect(svg?.getAttribute("class")).toBe("studio-icon");
  expect(svg?.getAttribute("width")).toBe("22");
  expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
  expect(svg?.querySelector("g")?.innerHTML).toContain("ellipse");
});

it("falls back to a box for an unknown name and a question mark for none", () => {
  const unknown = render(<StudioIcon name="no-such-glyph" />);
  expect(unknown.container.querySelector("svg")?.getAttribute("class")).toContain(
    "tabler-icon-box",
  );
  expect(unknown.container.querySelector(".studio-icon")).toBeNull();
  cleanup();
  const none = render(<StudioIcon name={undefined} />);
  expect(none.container.querySelector("svg")?.getAttribute("class")).toContain(
    "tabler-icon-question-mark",
  );
});

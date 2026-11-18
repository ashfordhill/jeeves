// The line legend (D7, contract question 12): only the beaded Async sample, with nothing to open.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { LineLegend } from "./LineLegend.tsx";

afterEach(cleanup);

it("shows only the beaded Async sample, with no help text", () => {
  const { container } = render(<LineLegend />);
  const guide = screen.getByRole("note", { name: "Line guide" });
  expect(guide.textContent).toBe("Async");
  expect(guide.querySelectorAll("path[stroke-dasharray]")).toHaveLength(1);
  const beads = guide.querySelector("path[stroke-dasharray]");
  expect(beads?.getAttribute("stroke-dasharray")).toBe("0.01 5");
  expect(beads?.getAttribute("stroke-linecap")).toBe("round");
  expect(beads?.getAttribute("stroke-width")).toBe("3");
  expect(guide.querySelector('path[fill="currentColor"]')?.getAttribute("d")).toBe(
    "M 27 7 L 21 3.6 V 10.4 Z",
  );
  expect(container.querySelector("details, summary, p")).toBeNull();
  expect(guide.textContent).not.toMatch(/Solid|Request|queue/);
});

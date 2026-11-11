// The line legend (D7, contract question 12): only the dashed Async sample, with nothing to open.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { LineLegend } from "./LineLegend.tsx";

afterEach(cleanup);

it("shows only the dashed Async sample, with no help text", () => {
  const { container } = render(<LineLegend />);
  const guide = screen.getByRole("note", { name: "Line guide" });
  expect(guide.textContent).toBe("Async");
  expect(guide.querySelectorAll("path[stroke-dasharray]")).toHaveLength(1);
  expect(container.querySelector("details, summary, p")).toBeNull();
  expect(guide.textContent).not.toMatch(/Solid|Request|queue/);
});

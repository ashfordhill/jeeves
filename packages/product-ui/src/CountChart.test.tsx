import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CountChart, Metrics } from "./CountChart.tsx";

afterEach(cleanup);
it("presents non-QR inventory metrics and the complete zero-filled table with an SVG title", () => {
  render(
    <>
      <Metrics items={[{ label: "Movements", value: 3, detail: "Recorded warehouse events" }]} />
      <CountChart
        title="Inventory movement"
        unit="Movements"
        points={[
          { date: "2026-10-01", count: 0 },
          { date: "2026-10-02", count: 3 },
        ]}
      />
    </>,
  );
  expect(screen.getByRole("img", { name: /Inventory movement/ })).toBeTruthy();
  const summary = screen.getByText("View daily counts");
  summary.click();
  expect(screen.getByRole("table")).toBeTruthy();
  expect(screen.getByRole("rowheader", { name: "2026-10-01" })).toBeTruthy();
  expect(screen.getByRole("cell", { name: "0" })).toBeTruthy();
});

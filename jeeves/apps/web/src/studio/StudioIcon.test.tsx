// Every kind's and module kind's icon is drawn, never the unknown-name box.
import { studioComponentKinds, studioComponentVisuals } from "@jeeves/spec";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { StudioIcon } from "./StudioIcon.tsx";

afterEach(cleanup);

it("draws each module kind's own icon", () => {
  for (const kind of studioComponentKinds) {
    const { icon } = studioComponentVisuals[kind];
    const { container } = render(<StudioIcon name={icon} />);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(`tabler-icon-${icon}`);
    cleanup();
  }
});

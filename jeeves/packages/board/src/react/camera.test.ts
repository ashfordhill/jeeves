import { describe, expect, it } from "vitest";
import {
  cameraOriginAfterMove,
  viewportOnResize,
  viewportToFitRect,
  viewportToReveal,
} from "./camera.ts";

describe("the camera follows the canvas", () => {
  it("refits a fitted camera on resize, leaves the user's alone and pans a new tile into view", () => {
    const at = { x: 0, y: 0, zoom: 1 };
    // Only a user's move that changes the view makes the camera theirs.
    expect(cameraOriginAfterMove("fit", true, at, { ...at, x: 40 })).toBe("user");
    expect(cameraOriginAfterMove("fit", true, at, at)).toBe("fit");
    expect(cameraOriginAfterMove("fit", false, at, { ...at, zoom: 0.5 })).toBe("fit");
    expect(cameraOriginAfterMove("user", false, at, { ...at, x: 40 })).toBe("user");

    // A rail opened: a fitted camera refits the tiles in the narrower pane; the user's stays.
    const tiles = { x: 0, y: 0, w: 1000, h: 400 };
    const narrow = { width: 700, height: 800 };
    expect(viewportOnResize("fit", narrow, tiles)).toEqual(viewportToFitRect(narrow, tiles));
    expect(viewportOnResize("user", narrow, tiles)).toBeUndefined();

    // A tile past the right edge pans in by just enough (48px margin), keeping the zoom.
    const pane = { width: 800, height: 600 };
    const view = { x: 0, y: 0, zoom: 0.5 };
    expect(viewportToReveal(view, pane, { x: 1400, y: 100, w: 128, h: 128 })).toEqual({
      x: 800 - 48 - (1400 + 128) * 0.5,
      y: 0,
      zoom: 0.5,
    });
    expect(viewportToReveal(view, pane, { x: 200, y: 100, w: 128, h: 128 })).toBeUndefined();
  });
});

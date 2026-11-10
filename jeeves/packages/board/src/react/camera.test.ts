import { describe, expect, it } from "vitest";
import {
  cameraOriginAfterMove,
  EDGE_PAN_MARGIN,
  EDGE_PAN_SPEED,
  EDGE_PAN_ZONE,
  edgePanStep,
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

describe("a connect drag held near the edge pans the canvas", () => {
  // The board at (100, 50), 800×600; the tiles reach well past it on every side.
  const pane = { x: 100, y: 50, w: 800, h: 600 };
  const wide = { x: -900, y: -700, w: 2800, h: 2000 };
  const frame = 1000 / 60;
  const top = frame * (EDGE_PAN_SPEED / 1000);

  it("pans towards the near edge, faster the nearer, at its top speed past it", () => {
    // Away from the edges: still.
    expect(edgePanStep({ x: 500, y: 350 }, pane, frame, wide)).toEqual({ x: 0, y: 0 });
    expect(edgePanStep({ x: 100 + EDGE_PAN_ZONE, y: 350 }, pane, frame, wide)).toEqual({
      x: 0,
      y: 0,
    });
    // Near the right edge the view moves left (the tiles beyond it come in); halfway into the
    // zone at half speed, on the edge and past it (over a rail) at the top speed. A frame's step
    // is 8px: a modest 480px a second.
    expect(top).toBe(8);
    expect(edgePanStep({ x: 900 - EDGE_PAN_ZONE / 2, y: 350 }, pane, frame, wide)).toEqual({
      x: -top / 2,
      y: 0,
    });
    expect(edgePanStep({ x: 900, y: 350 }, pane, frame, wide)).toEqual({ x: -top, y: 0 });
    expect(edgePanStep({ x: 1200, y: 350 }, pane, frame, wide)).toEqual({ x: -top, y: 0 });
    // The left and top edges move it the other way; a corner pans both ways.
    expect(edgePanStep({ x: 90, y: 350 }, pane, frame, wide)).toEqual({ x: top, y: 0 });
    expect(edgePanStep({ x: 500, y: 40 }, pane, frame, wide)).toEqual({ x: 0, y: top });
    expect(edgePanStep({ x: 905, y: 655 }, pane, frame, wide)).toEqual({ x: -top, y: -top });
    // The step follows the time since the last frame, so a slow frame doesn't slow the pan, but a
    // late one never jumps more than 50ms' worth.
    expect(edgePanStep({ x: 900, y: 350 }, pane, 2 * frame, wide).x).toBeCloseTo(-2 * top);
    expect(edgePanStep({ x: 900, y: 350 }, pane, 5000, wide).x).toBeCloseTo(-24);
  });

  it("stops once the tiles' far edge is inside the board", () => {
    // The tiles end 50px past the right edge: it pans only until their end is 48px inside.
    const near = { x: 300, y: 100, w: 650, h: 400 };
    const room = 50 + EDGE_PAN_MARGIN;
    expect(edgePanStep({ x: 900, y: 350 }, pane, frame, near).x).toBe(-top);
    expect(edgePanStep({ x: 900, y: 350 }, pane, 50, { ...near, x: 300 - room + 3 }).x).toBe(-3);
    expect(edgePanStep({ x: 900, y: 350 }, pane, frame, { ...near, x: 300 - room })).toEqual({
      x: 0,
      y: 0,
    });
    // Tiles that already fit (the fit) never pan, at any edge; with no tiles nothing does.
    const fitted = { x: 250, y: 150, w: 500, h: 400 };
    for (const at of [
      { x: 95, y: 350 },
      { x: 905, y: 350 },
      { x: 500, y: 45 },
      { x: 500, y: 655 },
    ])
      expect(edgePanStep(at, pane, frame, fitted)).toEqual({ x: 0, y: 0 });
    expect(edgePanStep({ x: 900, y: 350 }, pane, frame, undefined)).toEqual({ x: 0, y: 0 });
  });
});

import { expect, it } from "vitest";
import { placeRelationshipLabel, relationshipLabelSize } from "./label-position.ts";

it("keeps labels in open space and moves crowded labels clear of authored cards", () => {
  const size = relationshipLabelSize("Reads and writes application records", "SQL", false);
  const point = { x: 320, y: 120, ...size };
  expect(placeRelationshipLabel(point, [])).toEqual({ x: 320, y: 120 });
  const cards = [
    { x: 0, y: 80, width: 280, height: 200 },
    { x: 360, y: 80, width: 280, height: 200 },
  ];
  const before = structuredClone(cards);
  const position = placeRelationshipLabel(point, cards);
  expect(position.y + size.height / 2).toBeLessThan(cards[0]!.y);
  expect(cards).toEqual(before);
  expect(relationshipLabelSize("Reads stock", "SQL", true).height).toBeGreaterThan(
    relationshipLabelSize("Reads stock", "SQL", false).height,
  );
});

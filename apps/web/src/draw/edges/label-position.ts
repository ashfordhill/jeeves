/** Keep derived relationship labels clear of authored cards without moving saved objects. */
export interface LabelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface LabelBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
export function relationshipLabelSize(description: string, protocol: string, planned: boolean) {
  const width = Math.min(
    240,
    Math.max(110, description.length * 6.6 + 20, protocol.length * 6 + 20),
  );
  const lines = Math.max(1, Math.ceil((description.length * 6.6) / (width - 20)));
  return { width, height: 12 + lines * 15 + 15 + (planned ? 15 : 0) };
}
export function placeRelationshipLabel(
  label: LabelBox,
  obstacles: readonly LabelBox[],
  bounds?: LabelBounds,
) {
  const gap = 10;
  const collides = (point: { x: number; y: number }) =>
    obstacles.some(
      (box) =>
        point.x + label.width / 2 + gap > box.x &&
        point.x - label.width / 2 - gap < box.x + box.width &&
        point.y + label.height / 2 + gap > box.y &&
        point.y - label.height / 2 - gap < box.y + box.height,
    );
  const xs = [
    label.x,
    ...obstacles.flatMap((box) => [
      box.x - label.width / 2 - gap,
      box.x + box.width + label.width / 2 + gap,
    ]),
  ];
  const ys = [
    label.y,
    ...obstacles.flatMap((box) => [
      box.y - label.height / 2 - gap,
      box.y + box.height + label.height / 2 + gap,
    ]),
  ];
  if (bounds) {
    xs.push(bounds.minX + label.width / 2, bounds.maxX - label.width / 2);
    ys.push(bounds.minY + label.height / 2, bounds.maxY - label.height / 2);
  }
  let best: { x: number; y: number } | undefined;
  let distance = Infinity;
  for (const x of xs)
    for (const y of ys) {
      if (
        bounds &&
        (x - label.width / 2 < bounds.minX ||
          x + label.width / 2 > bounds.maxX ||
          y - label.height / 2 < bounds.minY ||
          y + label.height / 2 > bounds.maxY)
      )
        continue;
      const next = Math.hypot(x - label.x, y - label.y);
      if (next >= distance || collides({ x, y })) continue;
      best = { x, y };
      distance = next;
    }
  return best ?? { x: label.x, y: label.y };
}

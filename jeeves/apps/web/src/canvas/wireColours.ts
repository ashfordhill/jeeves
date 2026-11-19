// The wires' colours. A tile that sends lines holds a colour slot for life; the slot gives a hue,
// and each of the tile's lines takes its own shade of it. The user and the actions are slate.
// A wire's outline is its own colour, darker (`EDGE`).
// Twelve hues sit evenly round the OKLCH wheel without the 50 degrees round sky blue, which the
// studio keeps for service tiles and selection. Slot 12 starts a second round halfway between
// the first twelve hues, slot 24 a third a quarter step off, and so on: it never runs out.
import type { WireTone } from "@jeeves/board";

const STEP = 310 / 12;
const SLATE = { hue: 245, chroma: 0.035 };
const CHROMA = 0.17;
/** The outline: this much darker than the wire (never below `floor`), a little less vivid. */
const EDGE = { darker: 0.27, floor: 0.24, chroma: 0.9 };

/** 0, 1/2, 1/4, 3/4, 1/8 ...: how far each later round sits from the first. */
function roundOffset(round: number): number {
  let [fraction, offset] = [0.5, 0];
  for (let n = round; n > 0; n >>= 1, fraction /= 2) if (n & 1) offset += fraction;
  return offset;
}

/** The hue of colour slot `slot` (0, 1, 2 ...). */
export function wireHue(slot: number): number {
  const place = ((slot * 5) % 12) + roundOffset(Math.floor(slot / 12));
  return (265 + ((123 + place * STEP) % 310)) % 360;
}

function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  const angle = (h * Math.PI) / 180;
  const [a, b] = [c * Math.cos(angle), c * Math.sin(angle)];
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

/** The sRGB hex of an OKLCH colour, its chroma lowered until it fits, and the chroma it kept. */
function inGamut(l: number, chroma: number, h: number): { hex: string; c: number } {
  let c = chroma;
  let rgb = oklchToRgb(l, c, h);
  for (let i = 0; i < 80 && !rgb.every((v) => v >= -0.0005 && v <= 1.0005); i++) {
    c *= 0.96;
    rgb = oklchToRgb(l, c, h);
  }
  const hex = (v: number) => {
    const linear = Math.min(1, Math.max(0, v));
    const srgb = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return { hex: `#${rgb.map(hex).join("")}`, c };
}

/** A shade and its outline. */
function shade(
  hue: number,
  chroma: number,
  t: number,
  dark: boolean,
  drift: boolean,
): { fill: string; edge: string } {
  const l = dark ? 0.9 - 0.3 * t : 0.82 - 0.34 * t;
  const h = drift ? hue + (t - 0.5) * 16 : hue;
  const fill = inGamut(l, chroma * (0.62 + 0.38 * (1 - Math.min(1, Math.abs(l - 0.66) / 0.34))), h);
  const edge = inGamut(Math.max(EDGE.floor, l - EDGE.darker), fill.c * EDGE.chroma, h);
  return { fill: fill.hex, edge: edge.hex };
}

/** Shade `t` (0 lightest, 1 deepest) of the tile in `slot`; slate when it has none. */
export function wireTone(slot: number | undefined, t: number): WireTone {
  const [hue, chroma, drift] =
    slot === undefined ? [SLATE.hue, SLATE.chroma, false] : [wireHue(slot), CHROMA, true];
  const [light, dark] = [shade(hue, chroma, t, false, drift), shade(hue, chroma, t, true, drift)];
  return { light: light.fill, dark: dark.fill, edge: { light: light.edge, dark: dark.edge } };
}

/** The shade step of the `rank`-th of `of` lines: light and deep by turns down the tile. */
export function wireStep(rank: number, of: number): number {
  return rank % 2 === 0 ? rank / 2 : Math.ceil(of / 2) + (rank - 1) / 2;
}

/**
 * Every sending tile's slot: `saved` ones kept while their tile exists, then each of `senders`
 * without one takes the lowest free slot, in order. A removed tile's slot becomes free.
 */
export function assignWireSlots(
  saved: Readonly<Record<string, number>>,
  senders: readonly string[],
  tiles: ReadonlySet<string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  const taken = new Set<number>();
  for (const [tile, slot] of Object.entries(saved)) {
    if (!tiles.has(tile) || !Number.isInteger(slot) || slot < 0 || taken.has(slot)) continue;
    out[tile] = slot;
    taken.add(slot);
  }
  for (const tile of senders) {
    if (out[tile] !== undefined) continue;
    let slot = 0;
    while (taken.has(slot)) slot++;
    out[tile] = slot;
    taken.add(slot);
  }
  return out;
}

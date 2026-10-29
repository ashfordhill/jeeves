/**
 * A tinted status badge with readable text in both color schemes. Mantine's light badge with a
 * shade (`color="teal.9"`) paints the shade as the background and the text alike, so the text
 * disappears; this uses the base color for the tint and a darker ink for the text in light mode.
 */
import { Badge } from "@mantine/core";
import type { CSSProperties, ReactNode } from "react";

export type StatusColor = "blue" | "cyan" | "yellow" | "orange" | "grape" | "gray" | "red" | "teal";

/**
 * Text colors at least 6.5:1 on each color's light tint (Mantine's shade 1). Shade 9 itself is
 * below 4.5:1 for teal, yellow, and orange, and borderline for red.
 */
const INK: Record<StatusColor, string> = {
  blue: "#124a80",
  cyan: "#085463",
  yellow: "#6b4100",
  orange: "#8a330a",
  grape: "#6a2479",
  gray: "#212529",
  red: "#9e1f1f",
  teal: "#05553d",
};

export function StatusBadge({
  color,
  className,
  children,
}: {
  color: StatusColor;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Badge
      color={color}
      variant="light"
      className={className ? `status-badge ${className}` : "status-badge"}
      style={{ "--status-ink": INK[color] } as CSSProperties}
    >
      {children}
    </Badge>
  );
}

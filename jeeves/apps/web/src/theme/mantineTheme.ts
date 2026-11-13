/**
 * Mantine theme from automation-pitch's App.tsx: Nunito, rounded, cyan primary. Its dark palette
 * is the dark surface ramp of tokens.css (text, soft text, lines, edges, rails, canvas, bars), so
 * Mantine's controls, menus and dialogs are steel rather than Mantine's neutral grey.
 */
import { createTheme } from "@mantine/core";

export const FONT_FAMILY = '"Nunito Variable", Nunito, system-ui, sans-serif';

export const mantineTheme = createTheme({
  fontFamily: FONT_FAMILY,
  headings: { fontFamily: FONT_FAMILY },
  defaultRadius: "md",
  primaryColor: "cyan",
  cursorType: "pointer",
  colors: {
    dark: [
      "#eaf5fa",
      "#c9dde7",
      "#a8c5d2",
      "#7ea8bc",
      "#3d5d6d",
      "#2a4554",
      "#172a35",
      "#0f1d26",
      "#0b161d",
      "#071219",
    ],
  },
  components: {
    Button: {
      styles: {
        root: { fontFamily: FONT_FAMILY },
        label: { fontFamily: FONT_FAMILY },
      },
    },
  },
});

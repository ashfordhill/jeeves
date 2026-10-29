/** Mantine theme from automation-pitch's App.tsx: Nunito, rounded, cyan primary. */
import { createTheme } from "@mantine/core";

export const FONT_FAMILY = '"Nunito Variable", Nunito, system-ui, sans-serif';

export const mantineTheme = createTheme({
  fontFamily: FONT_FAMILY,
  headings: { fontFamily: FONT_FAMILY },
  defaultRadius: "md",
  primaryColor: "cyan",
  cursorType: "pointer",
  components: {
    Button: {
      styles: {
        root: { fontFamily: FONT_FAMILY },
        label: { fontFamily: FONT_FAMILY },
      },
    },
  },
});

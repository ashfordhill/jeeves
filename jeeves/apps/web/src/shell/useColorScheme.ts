import { useEffect, useState } from "react";

export type ColorScheme = "light" | "dark";

const STORAGE_KEY = "jeeves.colorScheme";

function readStored(): ColorScheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Light/dark preference; sets `data-theme` on <html> for tokens.css. */
export function useColorScheme(): [ColorScheme, (next: ColorScheme) => void] {
  const [scheme, setScheme] = useState<ColorScheme>(readStored);

  useEffect(() => {
    document.documentElement.dataset.theme = scheme;
    try {
      localStorage.setItem(STORAGE_KEY, scheme);
    } catch {
      // Storage can be unavailable (private mode); the preference just won't persist.
    }
  }, [scheme]);

  return [scheme, setScheme];
}

import { z } from "zod";
import type { ConfigValues } from "./design.ts";

export interface ConfigCheck {
  /** Values that are present but wrong, and unknown keys. */
  invalid: { path: (string | number)[]; message: string }[];
  /** Top-level keys with no value and no default. */
  missing: string[];
}

/**
 * Splits config problems into malformed values (structural) and missing required values
 * (readiness), so a half-filled form is saveable but a wrong value is not.
 */
export function checkConfig(schema: z.ZodObject, config: ConfigValues): ConfigCheck {
  const invalid: ConfigCheck["invalid"] = [];
  const partial = z.strictObject(schema.partial().shape).safeParse(config);
  if (!partial.success) {
    for (const issue of partial.error.issues) {
      if (issue.code === "unrecognized_keys") {
        for (const key of issue.keys) {
          invalid.push({
            path: [...issue.path.map(pathKey), key],
            message: `Unknown config key "${key}"`,
          });
        }
      } else {
        invalid.push({ path: issue.path.map(pathKey), message: issue.message });
      }
    }
  }
  const missing = Object.entries(schema.shape)
    .filter(([key, field]) => config[key] === undefined && !field.safeParse(undefined).success)
    .map(([key]) => key);
  return { invalid, missing };
}

/** Config with defaults applied. Throws if the config isn't complete and valid. */
export function resolveConfig(schema: z.ZodObject, config: ConfigValues): Record<string, unknown> {
  return schema.parse(config);
}

function pathKey(key: PropertyKey): string | number {
  return typeof key === "symbol" ? String(key) : key;
}

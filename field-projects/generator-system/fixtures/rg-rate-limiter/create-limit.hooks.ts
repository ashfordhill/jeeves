// @jeeves-extension: policy
import type { RateLimiterHooks } from "../../extension-api/index.ts";
export function createLimitHooks(_resources: Record<string, never>): RateLimiterHooks {
  return { key: (caller) => caller.subject };
}

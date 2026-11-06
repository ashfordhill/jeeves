/** Only reviewed, separately versioned studio studies belong in this registry. */

import { MARKETPLACE_STUDIO_EXAMPLE, marketplaceStudioExample } from "./marketplace.ts";
import { TINYURL_STUDIO_EXAMPLE, tinyurlStudioExample } from "./tinyurl.ts";

/** The studies New project offers, TinyURL first (the default). Earlier studies live in git history. */
export const studioArchitectureExamples = Object.freeze([
  TINYURL_STUDIO_EXAMPLE,
  MARKETPLACE_STUDIO_EXAMPLE,
]);

export function studioArchitectureExample(id: string) {
  switch (id) {
    case TINYURL_STUDIO_EXAMPLE.id:
      return tinyurlStudioExample();
    case MARKETPLACE_STUDIO_EXAMPLE.id:
      return marketplaceStudioExample();
    default:
      throw new Error(`Unknown studio example ${id}.`);
  }
}

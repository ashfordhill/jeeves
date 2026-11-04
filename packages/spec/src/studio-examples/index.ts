/** Only reviewed, separately versioned studio studies belong in this registry. */

import { TINYURL_STUDIO_EXAMPLE, tinyurlStudioExample } from "./tinyurl.ts";

/** SG04: TinyURL is the single study. Earlier studies live in git history only. */
export const studioArchitectureExamples = Object.freeze([TINYURL_STUDIO_EXAMPLE]);

export function studioArchitectureExample(id: string) {
  switch (id) {
    case TINYURL_STUDIO_EXAMPLE.id:
      return tinyurlStudioExample();
    default:
      throw new Error(`Unknown studio example ${id}.`);
  }
}

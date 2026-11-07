/** Only reviewed, separately versioned studio studies belong in this registry. */

import { MARKETPLACE_STUDIO_EXAMPLE, marketplaceStudioExample } from "./marketplace.ts";
import { TINYURL_STUDIO_EXAMPLE, tinyurlStudioExample } from "./tinyurl.ts";
import {
  TINYURL_FOUNDATION_STUDIO_EXAMPLE,
  tinyurlFoundationStudioExample,
} from "./tinyurl-foundation.ts";
import { YOUTUBE_STUDIO_EXAMPLE, youtubeStudioExample } from "./youtube.ts";

export { studioStudySeedOperations } from "./seed.ts";
export const DEFAULT_STUDIO_EXAMPLE_ID = TINYURL_FOUNDATION_STUDIO_EXAMPLE.id;

/** Chooser presentation does not change the older study's source, goal or saved designs. */
export const studioArchitectureExamples = Object.freeze([
  TINYURL_FOUNDATION_STUDIO_EXAMPLE,
  { ...TINYURL_STUDIO_EXAMPLE, name: "TinyURL · extended study (design only)" },
  MARKETPLACE_STUDIO_EXAMPLE,
  YOUTUBE_STUDIO_EXAMPLE,
]);

export function studioArchitectureExample(id: string) {
  switch (id) {
    case TINYURL_FOUNDATION_STUDIO_EXAMPLE.id:
      return tinyurlFoundationStudioExample();
    case TINYURL_STUDIO_EXAMPLE.id:
      return tinyurlStudioExample();
    case MARKETPLACE_STUDIO_EXAMPLE.id:
      return marketplaceStudioExample();
    case YOUTUBE_STUDIO_EXAMPLE.id:
      return youtubeStudioExample();
    default:
      throw new Error(`Unknown studio example ${id}.`);
  }
}

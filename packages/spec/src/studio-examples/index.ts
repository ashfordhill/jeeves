/** Only reviewed, separately versioned studio studies belong in this registry. */
import { ENTERPRISE_STUDIO_EXAMPLE, enterpriseStudioExample } from "./enterprise.ts";
import { MATTERMOST_STUDIO_EXAMPLE, mattermostStudioExample } from "./mattermost.ts";
import { STREAMLY_STUDIO_EXAMPLE, streamlyStudioExample } from "./streamly.ts";

export const studioArchitectureExamples = Object.freeze([
  MATTERMOST_STUDIO_EXAMPLE,
  ENTERPRISE_STUDIO_EXAMPLE,
  STREAMLY_STUDIO_EXAMPLE,
]);

export function studioArchitectureExample(id: string) {
  switch (id) {
    case MATTERMOST_STUDIO_EXAMPLE.id:
      return mattermostStudioExample();
    case ENTERPRISE_STUDIO_EXAMPLE.id:
      return enterpriseStudioExample();
    case STREAMLY_STUDIO_EXAMPLE.id:
      return streamlyStudioExample();
    default:
      throw new Error(`Unknown studio example ${id}.`);
  }
}

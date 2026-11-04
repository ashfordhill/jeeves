/** Only reviewed, separately versioned studio studies belong in this registry. */

import { COMMUNITY_STUDIO_EXAMPLE, communityStudioExample } from "./community.ts";
import {
  DISCOURSE_FOUNDATION_STUDIO_EXAMPLE,
  discourseFoundationStudioExample,
} from "./discourse-foundation.ts";
import { DROPSHIPPING_STUDIO_EXAMPLE, dropshippingStudioExample } from "./dropshipping.ts";
import { ENTERPRISE_STUDIO_EXAMPLE, enterpriseStudioExample } from "./enterprise.ts";
import { GROCERY_STUDIO_EXAMPLE, groceryStudioExample } from "./grocery.ts";
import { INVENTORY_STUDIO_EXAMPLE, inventoryStudioExample } from "./inventory.ts";
import { LINKS_STUDIO_EXAMPLE, linksStudioExample } from "./links.ts";
import { MATTERMOST_STUDIO_EXAMPLE, mattermostStudioExample } from "./mattermost.ts";
import { QRWTY_ORIGINAL_STUDIO_EXAMPLE, qrwtyOriginalStudioExample } from "./qrwty-original.ts";
import { QRWTY_TARGET_STUDIO_EXAMPLE, qrwtyTargetStudioExample } from "./qrwty-target.ts";
import { SOCIAL_STUDIO_EXAMPLE, socialStudioExample } from "./social.ts";
import { STREAMLY_STUDIO_EXAMPLE, streamlyStudioExample } from "./streamly.ts";
import {
  VENDURE_FOUNDATION_STUDIO_EXAMPLE,
  vendureFoundationStudioExample,
} from "./vendure-foundation.ts";
import {
  ZAMMAD_FOUNDATION_STUDIO_EXAMPLE,
  zammadFoundationStudioExample,
} from "./zammad-foundation.ts";

export const studioArchitectureExamples = Object.freeze([
  MATTERMOST_STUDIO_EXAMPLE,
  ENTERPRISE_STUDIO_EXAMPLE,
  STREAMLY_STUDIO_EXAMPLE,
  QRWTY_TARGET_STUDIO_EXAMPLE,
  LINKS_STUDIO_EXAMPLE,
  COMMUNITY_STUDIO_EXAMPLE,
  SOCIAL_STUDIO_EXAMPLE,
  DISCOURSE_FOUNDATION_STUDIO_EXAMPLE,
  VENDURE_FOUNDATION_STUDIO_EXAMPLE,
  ZAMMAD_FOUNDATION_STUDIO_EXAMPLE,
  QRWTY_ORIGINAL_STUDIO_EXAMPLE,
  DROPSHIPPING_STUDIO_EXAMPLE,
  INVENTORY_STUDIO_EXAMPLE,
  GROCERY_STUDIO_EXAMPLE,
]);

export function studioArchitectureExample(id: string) {
  switch (id) {
    case MATTERMOST_STUDIO_EXAMPLE.id:
      return mattermostStudioExample();
    case ENTERPRISE_STUDIO_EXAMPLE.id:
      return enterpriseStudioExample();
    case STREAMLY_STUDIO_EXAMPLE.id:
      return streamlyStudioExample();
    case QRWTY_TARGET_STUDIO_EXAMPLE.id:
      return qrwtyTargetStudioExample();
    case LINKS_STUDIO_EXAMPLE.id:
      return linksStudioExample();
    case COMMUNITY_STUDIO_EXAMPLE.id:
      return communityStudioExample();
    case SOCIAL_STUDIO_EXAMPLE.id:
      return socialStudioExample();
    case DISCOURSE_FOUNDATION_STUDIO_EXAMPLE.id:
      return discourseFoundationStudioExample();
    case VENDURE_FOUNDATION_STUDIO_EXAMPLE.id:
      return vendureFoundationStudioExample();
    case ZAMMAD_FOUNDATION_STUDIO_EXAMPLE.id:
      return zammadFoundationStudioExample();
    case QRWTY_ORIGINAL_STUDIO_EXAMPLE.id:
      return qrwtyOriginalStudioExample();
    case DROPSHIPPING_STUDIO_EXAMPLE.id:
      return dropshippingStudioExample();
    case INVENTORY_STUDIO_EXAMPLE.id:
      return inventoryStudioExample();
    case GROCERY_STUDIO_EXAMPLE.id:
      return groceryStudioExample();
    default:
      throw new Error(`Unknown studio example ${id}.`);
  }
}

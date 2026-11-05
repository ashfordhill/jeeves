/**
 * Tabler icons named by the kinds' visuals (`visual.icon`) and the tile types. Unknown names fall
 * back to a box.
 */
import {
  type Icon,
  IconApi,
  IconArchive,
  IconArrowsSplit,
  IconBolt,
  IconBox,
  IconBrowser,
  IconCpu,
  IconCreditCard,
  IconDatabase,
  IconList,
  IconLock,
  IconMail,
  IconPlug,
  IconQuestionMark,
  IconRoute,
  IconSearch,
  IconServer,
  IconWorld,
} from "@tabler/icons-react";

const ICONS: Record<string, Icon> = {
  api: IconApi,
  browser: IconBrowser,
  database: IconDatabase,
  server: IconServer,
  archive: IconArchive,
  "arrows-split": IconArrowsSplit,
  bolt: IconBolt,
  cpu: IconCpu,
  "credit-card": IconCreditCard,
  list: IconList,
  lock: IconLock,
  mail: IconMail,
  plug: IconPlug,
  route: IconRoute,
  search: IconSearch,
  world: IconWorld,
};

export function StudioIcon({ name, size = 20 }: { name: string | undefined; size?: number }) {
  const Glyph = name ? (ICONS[name] ?? IconBox) : IconQuestionMark;
  return <Glyph size={size} stroke={2} aria-hidden />;
}

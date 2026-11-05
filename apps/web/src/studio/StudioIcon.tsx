/**
 * Tabler icons named by the kinds' visuals (`visual.icon`), the tile types and the module kinds
 * (`studioComponentVisuals`). Unknown names fall back to a box.
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
  IconPlugConnected,
  IconPuzzle,
  IconQuestionMark,
  IconRepeat,
  IconRoute,
  IconSearch,
  IconServer,
  IconShield,
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
  "plug-connected": IconPlugConnected,
  puzzle: IconPuzzle,
  repeat: IconRepeat,
  route: IconRoute,
  search: IconSearch,
  shield: IconShield,
  world: IconWorld,
};

export function StudioIcon({ name, size = 20 }: { name: string | undefined; size?: number }) {
  const Glyph = name ? (ICONS[name] ?? IconBox) : IconQuestionMark;
  return <Glyph size={size} stroke={2} aria-hidden />;
}

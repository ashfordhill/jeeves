/**
 * Tabler icons named by the kinds' visuals (`visual.icon`) and the module kinds
 * (`studioComponentVisuals`). Unknown names fall back to a box.
 */
import {
  type Icon,
  IconArchive,
  IconArrowsSplit,
  IconBolt,
  IconBox,
  IconBrowser,
  IconCloudUpload,
  IconCpu,
  IconCreditCard,
  IconDatabase,
  IconList,
  IconListSearch,
  IconLock,
  IconMail,
  IconMovie,
  IconPhoto,
  IconPlug,
  IconPlugConnected,
  IconProgressCheck,
  IconPuzzle,
  IconQuestionMark,
  IconRepeat,
  IconRoute,
  IconSearch,
  IconServer,
  IconShield,
  IconStack2,
  IconStar,
  IconSum,
  IconWorld,
} from "@tabler/icons-react";

const ICONS: Record<string, Icon> = {
  browser: IconBrowser,
  database: IconDatabase,
  server: IconServer,
  archive: IconArchive,
  "arrows-split": IconArrowsSplit,
  bolt: IconBolt,
  "cloud-upload": IconCloudUpload,
  cpu: IconCpu,
  "credit-card": IconCreditCard,
  list: IconList,
  "list-search": IconListSearch,
  lock: IconLock,
  mail: IconMail,
  movie: IconMovie,
  photo: IconPhoto,
  plug: IconPlug,
  "plug-connected": IconPlugConnected,
  "progress-check": IconProgressCheck,
  puzzle: IconPuzzle,
  repeat: IconRepeat,
  route: IconRoute,
  search: IconSearch,
  shield: IconShield,
  "stack-2": IconStack2,
  star: IconStar,
  sum: IconSum,
  world: IconWorld,
};

export function StudioIcon({ name, size = 20 }: { name: string | undefined; size?: number }) {
  const Glyph = name ? (ICONS[name] ?? IconBox) : IconQuestionMark;
  return <Glyph size={size} stroke={2} aria-hidden />;
}

/** Tabler icons named by template manifests (`card.icon`). Unknown names fall back to a box. */
import {
  type Icon,
  IconApi,
  IconBox,
  IconBrowser,
  IconDatabase,
  IconPlugConnected,
  IconQuestionMark,
  IconRepeat,
  IconServer,
} from "@tabler/icons-react";

const ICONS: Record<string, Icon> = {
  api: IconApi,
  browser: IconBrowser,
  database: IconDatabase,
  "plug-connected": IconPlugConnected,
  server: IconServer,
  repeat: IconRepeat,
};

export function TemplateIcon({ name, size = 20 }: { name: string | undefined; size?: number }) {
  const Glyph = name ? (ICONS[name] ?? IconBox) : IconQuestionMark;
  return <Glyph size={size} stroke={2} aria-hidden />;
}

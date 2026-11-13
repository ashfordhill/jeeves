/**
 * The studio's own glyphs (`STUDIO_GLYPHS`), named by the kinds' visuals (`visual.icon`) and the
 * module kinds (`studioComponentVisuals`): a dark outline, the family's accent fill (`--fam`, from
 * the nearest `data-family`) and one light fill, styled by `studio-icon.css`. An unknown name falls
 * back to Tabler's box, and no name to a question mark.
 */
import { IconBox, IconQuestionMark } from "@tabler/icons-react";
import { STUDIO_GLYPHS } from "./studio-glyphs.ts";
import "./studio-icon.css";

export function StudioIcon({ name, size = 20 }: { name: string | undefined; size?: number }) {
  if (!name) return <IconQuestionMark size={size} stroke={2} aria-hidden />;
  const glyph = Object.hasOwn(STUDIO_GLYPHS, name) ? STUDIO_GLYPHS[name] : undefined;
  if (glyph === undefined) return <IconBox size={size} stroke={2} aria-hidden />;
  return (
    <svg className="studio-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static artwork bundled with the app. */}
      <g dangerouslySetInnerHTML={{ __html: glyph }} />
    </svg>
  );
}

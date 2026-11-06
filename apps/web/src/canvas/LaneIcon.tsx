// The download and upload icons and names, shared by the action tiles, the user's fan and the
// inspector.
import type { StudioLane } from "@jeeves/spec";
import { IconDownload, IconUpload } from "@tabler/icons-react";

export const laneNames: Record<StudioLane, string> = { download: "Download", upload: "Upload" };

export function LaneIcon({ lane, size = 18 }: { lane: StudioLane; size?: number }) {
  const Glyph = lane === "download" ? IconDownload : IconUpload;
  return <Glyph size={size} stroke={2.4} aria-hidden />;
}

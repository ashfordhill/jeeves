import { viewPlayed, type ViewPlayed } from "../contracts/v1.ts";
import type { Tx } from "./transaction.ts";
export async function recordView(tx: Tx, input: ViewPlayed) {
  const e = viewPlayed.parse(input);
  const receipt = await tx.query(
    `INSERT INTO count_private.receipts(video_id,event_id,accepted_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING event_id`,
    [e.videoId, e.eventId, e.acceptedAt],
  );
  if (!receipt.rowCount) return false;
  await tx.query(
    `INSERT INTO count_private.totals(video_id,views) VALUES($1,1) ON CONFLICT(video_id) DO UPDATE SET views=count_private.totals.views+1`,
    [e.videoId],
  );
  return true;
}

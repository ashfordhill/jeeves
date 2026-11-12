// Wall timestamps are monotonic milliseconds. Short samples bound suspended-callback credit.
// Resets discard only the sample; qualifying time and the one-event latch survive pause/seek.
export class PlaybackPolicy {
  seconds = 0;
  triggered = false;
  private previous: { media: number; wall: number } | undefined;
  reset() {
    this.previous = undefined;
  }
  sample(media: number, wall: number, active: boolean) {
    if (!active || !Number.isFinite(media) || !Number.isFinite(wall)) {
      this.reset();
      return false;
    }
    const last = this.previous;
    this.previous = { media, wall };
    if (!last || this.triggered) return false;
    const elapsed = (wall - last.wall) / 1000,
      advanced = media - last.media;
    if (elapsed <= 0 || elapsed > 0.5 || advanced <= 0 || advanced > elapsed + 0.15) return false;
    this.seconds += Math.min(elapsed, advanced);
    if (this.seconds < 2) return false;
    this.triggered = true;
    return true;
  }
}

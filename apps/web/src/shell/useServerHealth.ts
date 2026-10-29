import { useEffect, useState } from "react";

/** `offline` means the server didn't answer; `degraded` means it answered but Postgres didn't. */
export type ServerHealth = "checking" | "ok" | "degraded" | "offline";

const POLL_MS = 5000;

export function useServerHealth(): ServerHealth {
  const [health, setHealth] = useState<ServerHealth>("checking");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      let next: ServerHealth;
      try {
        const res = await fetch("/api/health");
        const body = (await res.json()) as { status?: string };
        next = body.status === "ok" ? "ok" : "degraded";
      } catch {
        next = "offline";
      }
      if (cancelled) return;
      setHealth(next);
      timer = setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return health;
}

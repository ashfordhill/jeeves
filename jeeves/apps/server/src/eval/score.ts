/** External deterministic rubric; never asks the proposing model to grade its own work. */
import { type DesignDocument, isStructural, validateDesign } from "@jeeves/spec";
import type { EvalCase } from "./cases.ts";

export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export type Check = {
  id: string;
  pass: boolean;
  critical: boolean;
  evidence: string;
  /** Prose matching is only an evidence signal, always requiring independent adjudication. */
  assessment?: "needs-review";
};
export type Outcome = {
  design: DesignDocument;
  reply: string;
  /** Actual tool-result obligations plus final reviewDetails, not injected oracle expectations. */
  obligationText: string[];
  error: string | null;
};
export function score(test: EvalCase, before: DesignDocument, outcome: Outcome): Check[] {
  const design = outcome.design;
  const bindings = design.architecture?.studio?.elements ?? [];
  const kind = (id: string) => bindings.find((b) => b.element === id)?.settings.kind;
  const ids = (k: string) => bindings.filter((b) => b.settings.kind === k).map((b) => b.element);
  const links = (from: string, to: string) =>
    design.connections.some((c) => c.from.element === from && c.to.element === to);
  const someLink = (from: string[], to: string[]) => from.some((a) => to.some((b) => links(a, b)));
  const check = (id: string, pass: boolean, evidence: string, critical = true): Check => ({
    id,
    pass,
    critical,
    evidence,
  });
  const signature = (d: DesignDocument, id: string) =>
    stable({
      element: d.elements.find((e) => e.id === id),
      binding: d.architecture?.studio?.elements.find((b) => b.element === id),
      modules: d.architecture?.studio?.components?.filter((c) => c.host === id),
    });
  const checks: Check[] = [
    check("turn-completed", !outcome.error, outcome.error ?? "Turn completed", false),
    check(
      "structurally-valid",
      !validateDesign(design).some(isStructural),
      "Server structural validation",
    ),
    ...test.protectedIds.map((id) =>
      check(
        `preserve-${id}`,
        signature(before, id) === signature(design, id),
        "Exact element, settings, ownership and hosted module identity/value",
      ),
    ),
  ];
  // Refusal of an unsupported edit must preserve the entire represented design, ignoring revision.
  if (test.id === "tinyurl-unsupported-edit")
    checks.push(
      check(
        "unsupported-no-mutation",
        stable({ ...before, revision: 0 }) === stable({ ...design, revision: 0 }),
        "Whole represented design comparison",
      ),
    );
  if (test.domain === "video") {
    const workers = ids("worker");
    const objects = ids("object-store");
    const source =
      test.task === "repair"
        ? ["originals"]
        : objects.filter((id) =>
            bindings.some(
              (b) =>
                ["service", "uploads"].includes(b.settings.kind) &&
                links(b.element, id) &&
                bindings.find((s) => s.element === id)?.owner?.id === b.element,
            ),
          );
    checks.push(
      check(
        "durable-source-worker-read",
        workers.some((w) =>
          source.some((s) => links(w, s) && bindings.find((b) => b.element === s)?.owner?.id !== w),
        ),
        "Worker has a represented request dependency on an owner-written object store",
      ),
    );
    checks.push(
      check(
        "separate-worker-output",
        workers.some((w) =>
          objects.some(
            (o) =>
              !source.includes(o) &&
              links(w, o) &&
              bindings.find((b) => b.element === o)?.owner?.id === w,
          ),
        ),
        "A different object store is worker-owned output",
      ),
    );
    checks.push(
      check("queued-processing", someLink(ids("queue"), workers), "Queue→worker relationship"),
    );
    if (test.task === "repair") {
      const incoming = design.connections.filter((c) => c.to.element === "indexer");
      const feeds = incoming
        .filter((c) => ["topic", "queue"].includes(kind(c.from.element) ?? ""))
        .map((c) => c.from.element);
      const ownerFeed = feeds.some(
        (feed) => feed !== "completed" && links("video", feed) && !links("processor", feed),
      );
      checks.push(
        check(
          "publication-owner-feed",
          ownerFeed && !links("completed", "indexer") && !links("processor", "indexer"),
          "Distinct Video-owner feed into existing indexer; processing completion bypass removed",
        ),
      );
      checks.push(
        check(
          "search-projection-retained",
          links("indexer", "search") && kind("search") === "search",
          "Existing indexer→search projection remains",
        ),
      );
    }
  }
  if (test.domain === "checkout") {
    // Eval 1.1.0: new tiles are the link fan's kinds, so Payments is a Service calling one
    // External API provider (1.0.0 seeds used a Billing tile, whose provider was built in).
    const services = ids("service");
    checks.push(
      check(
        "durable-checkout-participants",
        someLink(services, ids("database")) && someLink(services, ids("external-api")),
        "Owned data and a payment provider call are represented intent only",
      ),
    );
    checks.push(
      check(
        "no-duplicate-provider",
        ids("external-api").length <= 1,
        "The payment provider is one External API tile, not duplicated",
      ),
    );
  }
  if (test.domain === "tinyurl") {
    const unsafe = bindings.filter(
      (b) => b.settings.kind === "cdn" && b.settings.cacheRedirects !== "disabled",
    );
    checks.push(
      check(
        "redirect-response-cache-safe",
        unsafe.length === 0,
        "No CDN with redirect caching enabled/unspecified; edge analytics is not implemented here",
      ),
    );
    checks.push(
      check(
        "analytics-path-reader",
        links("redirect", "click-events") &&
          links("click-events", "analytics") &&
          links("analytics", "analytics-store") &&
          links("stats-api", "analytics-store"),
        "Existing click publisher→channel→worker→store and Stats reader retained",
      ),
    );
    checks.push(
      check(
        "lookup-cache-retained",
        links("redirect", "url-cache"),
        "Lookup cache is distinct from response caching",
      ),
    );
  }
  const candidates = [...outcome.obligationText, ...outcome.reply.split(/\n\s*\n/)];
  for (const requirement of test.obligations) {
    // Canonical status-bearing review text or plain-language unresolved prose are accepted equally.
    const evidence = candidates.find((s) => {
      const lower = s.toLowerCase();
      const unresolved =
        /not specified|unsupported|unimplemented|unresolved|not implemented|cannot|can't|requires? (?:a |an )?(?:contract|implementation)|implementation obligation/.test(
          lower,
        );
      const aliases: Record<string, RegExp> = {
        retries: /retr(?:y|ies)|idempotent/,
        duplicate: /duplicat|idempotent|redeliver/,
        failed: /fail(?:ed|ure)?/,
        expiry: /expir/,
        notification: /notification|webhook/,
        unsupported: /unsupported|cannot|can't|not available|unavailable/,
      };
      return (
        unresolved &&
        requirement.terms.every((term) => aliases[term]?.test(lower) ?? lower.includes(term))
      );
    });
    checks.push({
      ...check(
        `obligation-${requirement.id}`,
        evidence !== undefined,
        evidence?.slice(0, 1400) ??
          `No explicit unresolved statement covering ${requirement.terms.join(", ")}`,
      ),
      assessment: "needs-review",
    });
  }
  // Review aid only: no regex can adjudicate arbitrary architectural claims. Agent/owner review is required.
  const falseClaim = outcome.reply
    .split(/[.!?\n]/)
    .find(
      (sentence) =>
        !/\b(?:no|none|not|never|cannot|unsupported|unresolved)\b/i.test(sentence) &&
        /\b(?:now guarantees|have implemented|is implemented|successfully deployed|verified exactly.once|guarantees exactly.once)\b/i.test(
          sentence,
        ),
    );
  checks.push({
    ...check(
      "claim-scan",
      !falseClaim,
      falseClaim
        ? `Candidate false support claim: ${falseClaim}; requires independent review`
        : "No narrow high-risk phrase matched; not proof of accurate claims",
    ),
    assessment: "needs-review",
  });
  return checks;
}

import type { Attachment, Element } from "@jeeves/spec";
import { resolveConfig } from "@jeeves/spec";
import type { GenerateContext } from "./contract.ts";

// Naming conventions templates share. They live here so templates don't import each other:
// template packages depend on one another for conformance tests, and importing in the other
// direction would make a workspace cycle.

/** A service's API contract, scaffolded by its rest-api-server attachment (PLAN §9 layout). */
export function contractPath(serviceId: string): string {
  return `contracts/${serviceId}.openapi.yaml`;
}

/** The local-only token compose gives a service whose API uses bearer auth (and its clients). */
export function bearerToken(serviceId: string): string {
  return `${serviceId}-local-token`;
}

/** `API_<TARGET>_URL` and `API_<TARGET>_TOKEN`: how compose tells a client where its API is. */
export function apiEnvName(targetId: string, what: "URL" | "TOKEN"): string {
  return `API_${targetId.toUpperCase().replaceAll("-", "_")}_${what}`;
}

/** The generated client module for one target, inside the calling element's directory. */
export function clientModulePath(elementDir: string, targetId: string): string {
  return `${elementDir}/src/clients/${targetId}.generated.ts`;
}

/** The client's export name: `link-stats` → `linkStatsClient`. */
export function clientExportName(targetId: string): string {
  const camel = targetId.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  return `${camel}Client`;
}

/** One rest-api-client attachment and the API it calls. */
export interface RestClientTarget {
  /** The rest-api-client attachment on the calling element. */
  attachment: Attachment;
  /** The attachment's config with defaults (`timeoutMs`, `retries`). */
  config: Record<string, unknown>;
  /** The target http-service element. */
  target: Element;
  /** The target's rest-api-server attachment and its config with defaults. */
  server: { attachment: Attachment; basePath: string; auth: string };
  /** The target's container port. */
  port: number;
}

/**
 * The element's rest-api-client attachments with the APIs they call (their `calls` connection),
 * in design order. Throws when one isn't connected or two call the same service: each target
 * gets one client module.
 */
export function restClientTargets(ctx: GenerateContext): RestClientTarget[] {
  const targets: RestClientTarget[] = [];
  for (const resolved of ctx.attachments) {
    if (resolved.manifest.id !== "rest-api-client") continue;
    const calls = resolved.outgoing.find((c) => c.connection.kind === "calls");
    const where = `${resolved.attachment.id} on ${ctx.element.id}`;
    if (!calls) throw new Error(`The REST client ${where} isn't connected to an API`);
    const { peer } = calls;
    if (
      peer.manifest?.id !== "rest-api-server" ||
      !peer.attachment ||
      !peer.elementManifest ||
      peer.elementManifest.kind !== "element"
    ) {
      throw new Error(`The REST client ${where} must call a rest-api-server attachment`);
    }
    if (targets.some((t) => t.target.id === peer.element.id)) {
      throw new Error(`${ctx.element.id} has two REST clients for ${peer.element.id}; use one`);
    }
    const server = resolveConfig(peer.manifest.config, peer.attachment.config);
    const element = resolveConfig(peer.elementManifest.config, peer.element.config);
    targets.push({
      attachment: resolved.attachment,
      config: resolved.config,
      target: peer.element,
      server: {
        attachment: peer.attachment,
        basePath: String(server.basePath),
        auth: String(server.auth),
      },
      port: Number(element.port),
    });
  }
  return targets;
}

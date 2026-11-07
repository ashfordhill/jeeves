/** Finite resolve/cache compatibility over declarations; no lookup or clock simulation. */
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import {
  contractRecords,
  isCreateOperation,
  isResolveOperation,
  knownSchemaRefs,
  positiveCachePolicy,
  sameContractRef,
} from "./operation-records.ts";
import { accessAllows, designOwnership } from "./ownership.ts";
import { studioProtocolSchema } from "./studio-model.ts";

export function resolveContractFindings(design: DesignDocument): Finding[] {
  if (design.schemaVersion !== 3) return [];
  const findings: Finding[] = [],
    ownership = designOwnership(design),
    studio = design.architecture?.studio;
  for (const [index, receiver] of (design.operations?.receivers ?? []).entries()) {
    // Unknown operation refs acquire no resolve behavior, even with a known tagged payload.
    if (!isResolveOperation(receiver.implementation) || receiver.binding.kind !== "resolve-link")
      continue;
    const binding = receiver.binding;
    const report = (
      code: "CONFIG_REQUIRED" | "CONFIG_INVALID" | "UNKNOWN_REFERENCE",
      field: string,
      message: string,
      connection?: string,
    ) =>
      findings.push(
        finding(code, message, {
          element: receiver.role,
          ...(connection ? { connection } : {}),
          path: ["operations", "receivers", index, "binding", field],
        }),
      );
    const role = ownership.roles.find((x) => x.element === receiver.role);
    const receiverSettings = studio?.elements.find((x) => x.element === receiver.role)?.settings;
    if (receiverSettings?.kind === "redirect") {
      if (
        receiverSettings.lookupStoreConnection !== undefined &&
        receiverSettings.lookupStoreConnection !== binding.storeConnection
      )
        report(
          "CONFIG_INVALID",
          "storeConnection",
          "Redirect lookup store shortcut contradicts the exact resolve primary connection; edit the represented setting explicitly.",
        );
      if (
        receiverSettings.lookupCacheConnection !== undefined &&
        binding.cacheConnection !== null &&
        receiverSettings.lookupCacheConnection !== binding.cacheConnection
      )
        report(
          "CONFIG_INVALID",
          "cacheConnection",
          "Redirect lookup cache shortcut contradicts the exact resolve cache connection; edit the represented setting explicitly.",
        );
    }
    const sourceLink = design.connections.find((x) => x.id === binding.storeConnection);
    const source = ownership.resources.find((x) => x.element === sourceLink?.to.element);
    const sourceSettings = studio?.elements.find(
      (x) => x.element === sourceLink?.to.element,
    )?.settings;
    if (sourceLink && sourceSettings?.kind !== "database")
      report(
        "CONFIG_INVALID",
        "storeConnection",
        "Resolve requires an authoritative source database.",
      );
    if (!source)
      report("CONFIG_REQUIRED", "storeConnection", "Resolve source authority is unspecified.");
    else if (source.kind !== "source" || (role && source.authority !== role.owner))
      report(
        "CONFIG_INVALID",
        "storeConnection",
        "Resolve must read its same-owner authoritative source; a foreign published read or projection cannot replace this primary.",
      );
    const permission = (
      connection: string,
      resource: string,
      access: "read" | "read-write",
      field: string,
    ) => {
      const dependency = ownership.dependencies.find((x) => x.connection === connection),
        grant = ownership.grants.find((x) => x.role === receiver.role && x.resource === resource);
      if (!dependency || !grant)
        report(
          "CONFIG_REQUIRED",
          field,
          `Resolve needs explicit ${access} dependency intent and role grant for ${resource}.`,
          connection,
        );
      if (
        (dependency && !accessAllows(dependency.access, access)) ||
        (grant && !accessAllows(grant.access, access))
      )
        report(
          "CONFIG_INVALID",
          field,
          `Resolve ${access} exceeds the dependency or role grant for ${resource}; an ownership read remains a read.`,
          connection,
        );
    };
    const dependencyPolicy = (id: string, field: string, protocols: string[], cap: number) => {
      const link = design.connections.find((x) => x.id === id);
      if (!link) return;
      if (link.from.element !== receiver.role)
        report(
          "CONFIG_INVALID",
          field,
          "Resolve dependency must start at its canonical receiver role.",
          id,
        );
      if (link.planned.interaction !== "Request / response")
        report("CONFIG_INVALID", field, "Resolve dependencies must be synchronous requests.", id);
      if (!protocols.includes(link.planned.protocol))
        report(
          studioProtocolSchema.options.some((x) => x === link.planned.protocol) &&
            link.planned.protocol !== "Unspecified"
            ? "CONFIG_INVALID"
            : "CONFIG_REQUIRED",
          field,
          `Resolve dependency protocol ${link.planned.protocol} does not declare ${protocols.join(" or ")} intent; no adapter is inferred.`,
          id,
        );
      if (!["Service identity", "Private network"].includes(link.planned.security))
        report(
          ["Public", "User identity"].includes(link.planned.security)
            ? "CONFIG_INVALID"
            : "CONFIG_REQUIRED",
          field,
          `Resolve store dependency ${link.planned.security} does not declare a trusted internal service boundary.`,
          id,
        );
      const settings = studio?.connections.find((x) => x.connection === id)?.settings;
      if (settings?.timeoutMs !== undefined && settings.timeoutMs > cap)
        report(
          "CONFIG_INVALID",
          field,
          `Resolve dependency timeout ${settings.timeoutMs}ms exceeds its ${cap}ms phase maximum; the overall 1200ms deadline never resets.`,
          id,
        );
      if (settings?.retry?.mode === "fixed")
        report(
          "CONFIG_INVALID",
          field,
          "Resolve dependencies allow no automatic retries or unbounded wait.",
          id,
        );
      if (settings?.channelUse)
        report(
          "CONFIG_INVALID",
          field,
          "Resolve dependency cannot also publish/consume a channel.",
          id,
        );
    };
    if (sourceLink) {
      permission(sourceLink.id, sourceLink.to.element, "read", "storeConnection");
      dependencyPolicy(sourceLink.id, "storeConnection", ["SQL", "Native binding"], 1000);
    }
    if (!binding.cachePolicy)
      report(
        "CONFIG_REQUIRED",
        "cachePolicy",
        "Declare the exact positive clamp-to-record-expiry cache policy; null is unspecified.",
      );
    else if (!sameContractRef(binding.cachePolicy, positiveCachePolicy.ref))
      report(
        [...knownSchemaRefs, ...contractRecords.map((x) => x.ref)].some(
          (x) => !!binding.cachePolicy && sameContractRef(x, binding.cachePolicy),
        )
          ? "CONFIG_INVALID"
          : "CONFIG_REQUIRED",
        "cachePolicy",
        `Unknown exact cache policy ${binding.cachePolicy.id}@${binding.cachePolicy.version} (${binding.cachePolicy.sha256}); retained without known cache behavior.`,
      );
    if (!binding.cacheConnection)
      report(
        "CONFIG_REQUIRED",
        "cacheConnection",
        "Resolve cache read-and-fill connection is unspecified.",
      );
    else {
      const cacheLink = design.connections.find((x) => x.id === binding.cacheConnection);
      if (!cacheLink)
        report(
          "UNKNOWN_REFERENCE",
          "cacheConnection",
          `Resolve cache connection ${binding.cacheConnection} is missing.`,
        );
      else {
        const cacheSettings = studio?.elements.find(
          (x) => x.element === cacheLink.to.element,
        )?.settings;
        const cache = ownership.resources.find((x) => x.element === cacheLink.to.element);
        if (cacheSettings?.kind !== "cache")
          report(
            "CONFIG_INVALID",
            "cacheConnection",
            "Resolve positive cache must target a cache tile.",
          );
        if (!cache)
          report(
            "CONFIG_REQUIRED",
            "cacheConnection",
            "Resolve cache authority/projection is unspecified.",
          );
        else if (
          cache.kind !== "projection" ||
          cache.source !== sourceLink?.to.element ||
          (role && cache.authority !== role.owner)
        )
          report(
            "CONFIG_INVALID",
            "cacheConnection",
            "Resolve cache must be the same logical owner's projection of this exact authoritative source.",
          );
        permission(cacheLink.id, cacheLink.to.element, "read-write", "cacheConnection");
        if (binding.cachePolicy && sameContractRef(binding.cachePolicy, positiveCachePolicy.ref)) {
          dependencyPolicy(cacheLink.id, "cacheConnection", ["Redis", "Native binding"], 50);
          if (
            cacheSettings?.kind === "cache" &&
            cacheSettings.ttlSeconds !== undefined &&
            cacheSettings.ttlSeconds > 300
          )
            report(
              "CONFIG_INVALID",
              "cachePolicy",
              "Cache TTL exceeds the pinned 300-second maximum; record expiry must still clamp every write.",
            );
        }
      }
    }
    // Finite typed settings are intent; module descriptions never establish operation behavior.
    const relevant = new Set(
      (studio?.componentConnections ?? [])
        .filter(
          (x) =>
            x.to.kind === "element" &&
            (x.to.via === binding.storeConnection || x.to.via === binding.cacheConnection),
        )
        .map((x) => x.from),
    );
    let traced = true;
    while (traced) {
      traced = false;
      for (const link of studio?.componentConnections ?? [])
        if (link.to.kind === "component" && relevant.has(link.to.id) && !relevant.has(link.from)) {
          relevant.add(link.from);
          traced = true;
        }
    }
    for (const component of studio?.components?.filter(
      (x) => x.host === receiver.role && relevant.has(x.id),
    ) ?? []) {
      const settings = component.settings;
      if (settings.kind === "data-access") {
        if (settings.readRouting === "replica")
          report(
            "CONFIG_INVALID",
            "storeConnection",
            `Attached data-access module ${component.id} declares replica reads; immediate create-to-resolve needs fresh primary authority.`,
          );
        if (settings.statementTimeoutMs !== undefined && settings.statementTimeoutMs > 1000)
          report(
            "CONFIG_INVALID",
            "storeConnection",
            `Attached data-access module ${component.id} exceeds the 1000ms primary maximum.`,
          );
      }
      if (
        settings.kind === "cache-reader" &&
        binding.cachePolicy &&
        sameContractRef(binding.cachePolicy, positiveCachePolicy.ref)
      ) {
        if (
          settings.pattern !== "cache-aside" ||
          settings.stampede !== "none" ||
          settings.l1MaxEntries !== undefined ||
          settings.l1TtlSeconds !== undefined ||
          settings.negativeTtlSeconds !== undefined
        )
          report(
            "CONFIG_INVALID",
            "cachePolicy",
            `Attached cache-reader ${component.id} contradicts the finite policy: cache-aside, no L1, negative cache or single-flight waiting.`,
          );
        if (settings.l2TtlSeconds !== undefined && settings.l2TtlSeconds > 300)
          report(
            "CONFIG_INVALID",
            "cachePolicy",
            `Attached cache-reader ${component.id} TTL exceeds the 300-second maximum.`,
          );
      }
      if (
        settings.kind === "redirect-responder" &&
        (settings.status !== "307" ||
          (settings.edgeMaxAgeSeconds !== undefined && settings.edgeMaxAgeSeconds !== 0))
      )
        report(
          "CONFIG_INVALID",
          "cachePolicy",
          `Attached redirect-responder ${component.id} contradicts fixed307 and all-outcome no-store.`,
        );
    }
    const ancestors = new Set([receiver.role]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const link of design.connections)
        if (ancestors.has(link.to.element) && !ancestors.has(link.from.element)) {
          ancestors.add(link.from.element);
          changed = true;
        }
    }
    for (const item of studio?.elements ?? []) {
      const settings = item.settings;
      if (
        settings.kind !== "cdn" ||
        (!ancestors.has(item.element) && settings.origin !== receiver.role)
      )
        continue;
      if (settings.cacheRedirects === "enabled")
        report(
          "CONFIG_INVALID",
          "cachePolicy",
          `Attached CDN ${item.element} response caching contradicts no-store on every resolve outcome.`,
        );
      else if (settings.cacheRedirects !== "disabled")
        report(
          "CONFIG_REQUIRED",
          "cachePolicy",
          `Attached CDN ${item.element} has unspecified response-cache bypass; no-store is required for all outcomes, including404/410/503.`,
        );
    }
  }
  return findings;
}

/** This selected profile describes one namespace. Independent arbitrary designs remain legal. */
export function namespaceAuthorityFindings(design: DesignDocument): Finding[] {
  if (
    design.schemaVersion !== 3 ||
    design.scope.profile?.id !== "tinyurl-create-resolve" ||
    design.scope.profile.version !== "1.0.0"
  )
    return [];
  const receivers = design.operations?.receivers ?? [],
    ownership = designOwnership(design),
    findings: Finding[] = [];
  const known = receivers.filter(
    (x) => isCreateOperation(x.implementation) || isResolveOperation(x.implementation),
  );
  const authorities = known.map((x) => {
    const link = design.connections.find((link) => link.id === x.binding.storeConnection),
      role = ownership.roles.find((role) => role.element === x.role),
      resource = ownership.resources.find((r) => r.element === link?.to.element);
    return {
      receiver: x,
      source: resource?.kind === "source" ? resource.element : undefined,
      owner: role?.owner,
      authority: resource?.authority,
    };
  });
  const report = (code: "CONFIG_REQUIRED" | "CONFIG_INVALID", message: string) =>
    findings.push(finding(code, message, { path: ["operations", "namespace"] }));
  if (
    !known.some((x) => isCreateOperation(x.implementation)) ||
    !known.some((x) => isResolveOperation(x.implementation)) ||
    authorities.some((x) => !x.source || !x.owner || !x.authority)
  )
    report(
      "CONFIG_REQUIRED",
      "One-public-namespace authority is incomplete: declare exact create and resolve bindings with their authoritative source and logical owner.",
    );
  if (
    new Set(authorities.map((x) => x.source).filter(Boolean)).size > 1 ||
    new Set(authorities.flatMap((x) => [x.owner, x.authority]).filter(Boolean)).size > 1
  )
    report(
      "CONFIG_INVALID",
      "The selected one-public-namespace profile requires all known create/resolve bindings to share one authoritative source and compatible logical owner.",
    );
  return findings;
}

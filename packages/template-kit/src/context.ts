import {
  compareVersions,
  type DesignDocument,
  type ElementKind,
  formatTemplateRef,
  resolveConfig,
  type TemplateLookup,
  type TemplateManifest,
  type TemplateManifestInput,
  templateManifestSchema,
} from "@jeeves/spec";
import type { GenerateContext, ResolvedConnection, ResolvedEnd } from "./contract.ts";

const KIND_DIRS: Record<ElementKind, string> = {
  service: "services",
  worker: "services",
  frontend: "frontends",
  library: "packages",
  database: "databases",
  external: "externals",
};

/** An element's directory in the generated project (PLAN §9 layout). */
export function elementDir(kind: ElementKind, id: string): string {
  return `${KIND_DIRS[kind]}/${id}`;
}

export class GenerateContextError extends Error {}

/**
 * Builds the context `generate` gets for one element, or for one attachment on it. The design
 * must already be valid (no structural errors); templates may assume it.
 */
export function createGenerateContext(
  design: DesignDocument,
  lookup: TemplateLookup,
  elementId: string,
  attachmentId?: string,
): GenerateContext {
  const element = design.elements.find((e) => e.id === elementId);
  if (!element) throw new GenerateContextError(`No element "${elementId}" in the design`);
  const attachment =
    attachmentId === undefined ? undefined : element.attachments.find((a) => a.id === attachmentId);
  if (attachmentId !== undefined && !attachment) {
    throw new GenerateContextError(`No attachment "${attachmentId}" on element "${elementId}"`);
  }
  const elementManifest = manifestOf(lookup, element.template, element.id);
  const manifest = attachment
    ? manifestOf(lookup, attachment.template, attachment.id)
    : elementManifest;
  const dir = dirOf(elementManifest, element.id);
  if (dir === undefined) throw new GenerateContextError(`"${element.id}" is not an element`);

  const peerOf = (end: { element: string; attachment?: string }): ResolvedEnd => {
    const peer = design.elements.find((e) => e.id === end.element);
    if (!peer) throw new GenerateContextError(`Connection to unknown element "${end.element}"`);
    const peerAttachment = peer.attachments.find((a) => a.id === end.attachment);
    const peerElementManifest = peer.template ? lookup.get(peer.template) : undefined;
    const ref = peerAttachment ? peerAttachment.template : peer.template;
    const peerManifest = ref ? lookup.get(ref) : undefined;
    return {
      element: peer,
      ...(peerAttachment && { attachment: peerAttachment }),
      ...(peerManifest && { manifest: peerManifest }),
      ...(peerElementManifest && {
        elementManifest: peerElementManifest,
        dir: dirOf(peerElementManifest, peer.id),
      }),
    };
  };
  /** Connections at one end: the element itself (`attachmentId` undefined) or an attachment. */
  const connectionsOf = (attachmentId: string | undefined) => {
    const isSelf = (end: { element: string; attachment?: string }) =>
      end.element === element.id && end.attachment === attachmentId;
    const incoming: ResolvedConnection[] = [];
    const outgoing: ResolvedConnection[] = [];
    for (const connection of design.connections) {
      if (isSelf(connection.to)) {
        incoming.push({ connection, self: connection.to, peer: peerOf(connection.from) });
      }
      if (isSelf(connection.from)) {
        outgoing.push({ connection, self: connection.from, peer: peerOf(connection.to) });
      }
    }
    return { incoming, outgoing };
  };
  const { incoming, outgoing } = connectionsOf(attachment?.id);

  return {
    design,
    element,
    ...(attachment && { attachment }),
    manifest,
    config: resolveConfig(manifest.config, (attachment ?? element).config),
    dir,
    attachments: element.attachments.map((a) => {
      const attachmentManifest = manifestOf(lookup, a.template, a.id);
      return {
        attachment: a,
        manifest: attachmentManifest,
        config: resolveConfig(attachmentManifest.config, a.config),
        ...connectionsOf(a.id),
      };
    }),
    incoming,
    outgoing,
  };
}

function manifestOf(
  lookup: TemplateLookup,
  ref: { id: string; version: string } | null,
  id: string,
): TemplateManifest {
  if (!ref) throw new GenerateContextError(`"${id}" needs a template and can't be generated`);
  const manifest = lookup.get(ref);
  if (!manifest) throw new GenerateContextError(`Unknown template ${formatTemplateRef(ref)}`);
  return manifest;
}

function dirOf(manifest: TemplateManifest, id: string): string | undefined {
  return manifest.kind === "element" ? elementDir(manifest.elementKind, id) : undefined;
}

/** A `TemplateLookup` over manifests, for tests and tools that can't use `@jeeves/registry`. */
export function manifestLookup(inputs: readonly TemplateManifestInput[]): TemplateLookup {
  const manifests = inputs.map((input) => templateManifestSchema.parse(input));
  return {
    get: (ref) => manifests.find((m) => m.id === ref.id && m.version === ref.version),
    versions: (id) =>
      manifests
        .filter((m) => m.id === id)
        .map((m) => m.version)
        .sort(compareVersions),
  };
}

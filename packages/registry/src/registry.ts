import {
  type AttachmentManifest,
  type Connection,
  type ConnectionKind,
  checkConfig,
  compareVersions,
  connectionKindSchema,
  type DesignDocument,
  type ElementKind,
  type ElementManifest,
  type Endpoint,
  type FindingCode,
  findPort,
  formatTemplateRef,
  isStructural,
  type Port,
  resolveEndpoint,
  type TemplateLookup,
  type TemplateManifest,
  type TemplateManifestInput,
  type TemplateRef,
  templateManifestSchema,
  validateDesign,
} from "@jeeves/spec";
import { z } from "zod";

export class RegistryError extends Error {}

export type PaletteGroup = "Services" | "Frontends" | "Data" | "Libraries" | "External";

const paletteGroups: Record<ElementKind, PaletteGroup> = {
  service: "Services",
  worker: "Services",
  frontend: "Frontends",
  database: "Data",
  library: "Libraries",
  external: "External",
};
const paletteOrder: PaletteGroup[] = ["Services", "Frontends", "Data", "Libraries", "External"];

/** Serializable view of a manifest, for the API and the chat agent's `describeTemplate`. */
export interface TemplateDescription {
  id: string;
  version: string;
  kind: TemplateManifest["kind"];
  elementKind?: ElementKind;
  displayName: string;
  description: string;
  configJsonSchema: Record<string, unknown>;
  presets: TemplateManifest["presets"];
  ports: Port[];
  attachmentSlots: ElementManifest["attachmentSlots"];
  card: TemplateManifest["card"];
}

export interface Suggestion {
  message: string;
  /** An existing attachment to connect instead of the element itself. */
  useEndpoint?: Endpoint;
  /** An attachment to add that would make the connection possible. */
  addAttachment?: { element: string; template: TemplateRef };
}

export type Compatibility =
  | { ok: true }
  | { ok: false; code: FindingCode; reason: string; suggestions: Suggestion[] };

export interface Registry extends TemplateLookup {
  /** Every manifest, all versions, sorted by ID then version. */
  list(): TemplateManifest[];
  latest(id: string): TemplateManifest | undefined;
  describe(ref: TemplateRef): TemplateDescription | undefined;
  /** Latest element templates grouped for the toolbar, in palette order; empty groups omitted. */
  palette(): { group: PaletteGroup; templates: ElementManifest[] }[];
  /** Latest attachment templates the given element template accepts. */
  attachmentsFor(elementTemplate: TemplateRef): AttachmentManifest[];
  /** Whether adding an attachment of this template to the element would be accepted. */
  canAttach(design: DesignDocument, elementId: string, template: TemplateRef): Compatibility;
  /** Whether a `kind` connection from `from` to `to` would be accepted, with fixes if not. */
  canConnect(
    design: DesignDocument,
    kind: ConnectionKind,
    from: Endpoint,
    to: Endpoint,
  ): Compatibility;
  /** Connection kinds that would be accepted between two endpoints (for the connector tool). */
  connectionKinds(design: DesignDocument, from: Endpoint, to: Endpoint): ConnectionKind[];
}

const PROBE_ID = "registry-probe";

/** Validates manifests and builds a registry. Throws `RegistryError` on a bad manifest set. */
export function createRegistry(inputs: readonly TemplateManifestInput[]): Registry {
  const byId = new Map<string, TemplateManifest[]>();
  for (const input of inputs) {
    const result = templateManifestSchema.safeParse(input);
    const label = `${input.id ?? "?"}@${input.version ?? "?"}`;
    if (!result.success) {
      throw new RegistryError(`Manifest ${label} is invalid: ${z.prettifyError(result.error)}`);
    }
    const manifest = result.data;
    checkManifest(manifest);
    const versions = byId.get(manifest.id) ?? [];
    if (versions.some((m) => m.version === manifest.version)) {
      throw new RegistryError(`Manifest ${label} is registered twice.`);
    }
    if (versions.some((m) => m.kind !== manifest.kind)) {
      throw new RegistryError(`Versions of "${manifest.id}" disagree on kind.`);
    }
    versions.push(manifest);
    versions.sort((a, b) => compareVersions(a.version, b.version));
    byId.set(manifest.id, versions);
  }
  for (const versions of byId.values()) {
    for (const manifest of versions) {
      if (manifest.kind !== "element") continue;
      for (const slot of manifest.attachmentSlots) {
        if (byId.get(slot.template)?.[0]?.kind !== "attachment") {
          throw new RegistryError(
            `${formatTemplateRef(manifest)} has a slot for "${slot.template}", which isn't a registered attachment template.`,
          );
        }
      }
    }
  }

  const get = (ref: TemplateRef) => byId.get(ref.id)?.find((m) => m.version === ref.version);
  const latest = (id: string) => byId.get(id)?.at(-1);
  const lookup: TemplateLookup = {
    get,
    versions: (id) => byId.get(id)?.map((m) => m.version) ?? [],
  };

  /** First new structural finding about the probe item after applying `change` to a copy. */
  const probe = (
    design: DesignDocument,
    change: (draft: DesignDocument) => void,
    about: "connection" | "attachment",
  ) => {
    const draft = structuredClone(design);
    change(draft);
    const before = new Set(validateDesign(design, lookup).filter(isStructural).map(keyOf));
    return validateDesign(draft, lookup).find(
      (f) => isStructural(f) && !before.has(keyOf(f)) && f.target[about] === PROBE_ID,
    );
  };

  const canConnect: Registry["canConnect"] = (design, kind, from, to) => {
    const connection: Connection =
      design.schemaVersion === 2
        ? {
            id: PROBE_ID,
            kind,
            from: { element: from.element },
            to: { element: to.element },
            config: {
              ...(from.attachment && { fromCapability: from.attachment }),
              ...(to.attachment && { toCapability: to.attachment }),
            },
          }
        : { id: PROBE_ID, kind, from, to };
    const problem = probe(design, (d) => d.connections.push(connection), "connection");
    if (!problem) return { ok: true };
    const suggestions =
      problem.code === "PORT_INCOMPATIBLE" ? suggestAttachments(design, kind, from, to) : [];
    return { ok: false, code: problem.code, reason: problem.message, suggestions };
  };

  /** For an end that lacks the port: an attachment it already has, else ones it could add. */
  const suggestAttachments = (
    design: DesignDocument,
    kind: ConnectionKind,
    from: Endpoint,
    to: Endpoint,
  ): Suggestion[] => {
    const suggestions: Suggestion[] = [];
    for (const [endpoint, direction] of [
      [from, "out"],
      [to, "in"],
    ] as const) {
      const end = resolveEndpoint(design, endpoint, lookup);
      if (!end?.elementManifest) continue;
      if (end.manifest && findPort(end.manifest, kind, direction)) continue;
      const verb = direction === "out" ? "from" : "to";
      const existing = end.element.attachments.flatMap((attachment) => {
        const manifest = get(attachment.template);
        return manifest && findPort(manifest, kind, direction) ? [{ attachment, manifest }] : [];
      });
      for (const { attachment, manifest } of existing) {
        suggestions.push({
          message: `Connect ${verb} the ${manifest.displayName} on "${end.element.name}" instead.`,
          useEndpoint: { element: end.element.id, attachment: attachment.id },
        });
      }
      if (existing.length > 0) continue;
      for (const attachment of attachmentsForManifest(end.elementManifest)) {
        if (!findPort(attachment, kind, direction)) continue;
        suggestions.push({
          message: `Add a ${attachment.displayName} to "${end.element.name}" and connect ${verb} it.`,
          addAttachment: {
            element: end.element.id,
            template: { id: attachment.id, version: attachment.version },
          },
        });
      }
    }
    return suggestions;
  };

  const attachmentsForManifest = (manifest: ElementManifest): AttachmentManifest[] =>
    manifest.attachmentSlots
      .map((slot) => latest(slot.template))
      .filter((m): m is AttachmentManifest => m?.kind === "attachment");

  return {
    ...lookup,
    list: () => [...byId.keys()].sort().flatMap((id) => byId.get(id) ?? []),
    latest,
    describe(ref) {
      const manifest = get(ref);
      if (!manifest) return undefined;
      return {
        id: manifest.id,
        version: manifest.version,
        kind: manifest.kind,
        ...(manifest.kind === "element" ? { elementKind: manifest.elementKind } : {}),
        displayName: manifest.displayName,
        description: manifest.description,
        configJsonSchema: z.toJSONSchema(manifest.config, { io: "input" }),
        presets: manifest.presets,
        ports: manifest.ports,
        attachmentSlots: manifest.kind === "element" ? manifest.attachmentSlots : [],
        card: manifest.card,
      };
    },
    palette() {
      const elements = [...byId.keys()]
        .sort()
        .map((id) => latest(id))
        .filter((m): m is ElementManifest => m?.kind === "element");
      return paletteOrder
        .map((group) => ({
          group,
          templates: elements.filter((m) => paletteGroups[m.elementKind] === group),
        }))
        .filter((entry) => entry.templates.length > 0);
    },
    attachmentsFor(ref) {
      const manifest = get(ref);
      return manifest?.kind === "element" ? attachmentsForManifest(manifest) : [];
    },
    canAttach(design, elementId, template) {
      const element = design.elements.find((e) => e.id === elementId);
      if (!element) {
        return {
          ok: false,
          code: "UNKNOWN_REFERENCE",
          reason: `There is no element "${elementId}".`,
          suggestions: [],
        };
      }
      const problem = probe(
        design,
        (d) =>
          d.elements
            .find((e) => e.id === elementId)
            ?.attachments.push({ id: PROBE_ID, template, config: {}, notes: "" }),
        "attachment",
      );
      // A new attachment with missing required config is fine; only structural problems refuse.
      return problem
        ? { ok: false, code: problem.code, reason: problem.message, suggestions: [] }
        : { ok: true };
    },
    canConnect,
    connectionKinds: (design, from, to) =>
      connectionKindSchema.options.filter((kind) => canConnect(design, kind, from, to).ok),
  };
}

function keyOf(f: { code: string; target: object }): string {
  return `${f.code} ${JSON.stringify(f.target)}`;
}

function checkManifest(manifest: TemplateManifest): void {
  const label = formatTemplateRef(manifest);
  const seen = new Set<string>();
  for (const port of manifest.ports) {
    const key = `${port.kind}/${port.direction}`;
    if (seen.has(key)) throw new RegistryError(`${label} has two "${key}" ports.`);
    seen.add(key);
  }
  for (const chip of manifest.card.chips) {
    if (!(chip in manifest.config.shape)) {
      throw new RegistryError(`${label} card chip "${chip}" isn't a config key.`);
    }
  }
  for (const preset of manifest.presets) {
    const { invalid } = checkConfig(manifest.config, preset.config);
    if (invalid.length > 0) {
      throw new RegistryError(
        `${label} preset "${preset.id}" is invalid: ${invalid.map((i) => i.message).join("; ")}`,
      );
    }
  }
  try {
    z.toJSONSchema(manifest.config, { io: "input" });
  } catch (error) {
    throw new RegistryError(
      `${label} config can't be exported as JSON Schema: ${(error as Error).message}`,
    );
  }
}

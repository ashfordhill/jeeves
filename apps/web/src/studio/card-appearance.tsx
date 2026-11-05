import {
  type DesignDocument,
  type StudioElementField,
  type StudioViewNode,
  studioDefinitions,
  studioResourceKinds,
} from "@jeeves/spec";
import {
  IconArrowsExchange,
  IconBrandAws,
  IconBrandCloudflare,
  IconBrandGoogle,
  IconBrandStripe,
  IconBrandSupabase,
  IconPackages,
  IconStack2,
} from "@tabler/icons-react";
import { StudioIcon } from "./StudioIcon.tsx";

export { boundedStudioText } from "./text.ts";

/** World dimensions belong to the role, never the camera, name or support status. Every size is a
 * multiple of the 32px layout grid. */
export function studioCardSize(node: StudioViewNode) {
  if (node.kind === "component") return { width: 192, height: 64 };
  return {
    width:
      node.kind === "person" ||
      studioResourceKinds.some((kind) => kind === node.kind) ||
      node.kind === "cdn" ||
      node.kind === "external-api"
        ? 160
        : 192,
    height: 96,
  };
}

export function StudioRoleIcon({ node }: { node: StudioViewNode }) {
  const Glyph =
    node.kind === "package"
      ? IconPackages
      : node.kind === "cache"
        ? IconStack2
        : node.kind === "queue"
          ? IconArrowsExchange
          : undefined;
  return Glyph ? (
    <Glyph size={28} stroke={2} aria-hidden />
  ) : (
    <StudioIcon name={node.visual.icon} size={28} />
  );
}

/** Only actual, known settings supply secondary text. Legacy data is never guessed or rewritten. */
export function studioCardDetails(node: StudioViewNode, design: DesignDocument) {
  const ref = node.refs.find((ref) => ref.kind === "element");
  const binding =
    ref && "id" in ref
      ? design.architecture?.studio?.elements.find((binding) => binding.element === ref.id)
      : undefined;
  if (!binding) return {};
  const definition = studioDefinitions[binding.settings.kind];
  const settings = binding.settings as unknown as Record<string, unknown>;
  const label = (path: string) => {
    const field = (definition.fields as readonly StudioElementField[]).find(
      (field) => field.path === `settings.${path}`,
    );
    const value = settings[path];
    return value && value !== "unspecified" && field?.control === "select"
      ? field.choices.find((choice) => choice.value === value)?.label
      : undefined;
  };
  const provider = label("provider") ?? label("host");
  return {
    provider,
    providerKey: provider
      ? String(label("provider") ? settings.provider : settings.host)
      : undefined,
    technology: [label("language"), label("engine"), provider].filter(Boolean).join(" · "),
  };
}

/** Bundled Tabler marks only. An unknown provider leaves the capability icon intact. */
export function StudioProviderMark({ provider, label }: { provider?: string; label?: string }) {
  const Glyph = provider?.startsWith("cloudflare")
    ? IconBrandCloudflare
    : provider?.startsWith("aws")
      ? IconBrandAws
      : provider?.startsWith("google-cloud")
        ? IconBrandGoogle
        : provider === "stripe"
          ? IconBrandStripe
          : provider === "supabase"
            ? IconBrandSupabase
            : undefined;
  return Glyph ? (
    <span className="studio-provider-mark" title={label}>
      <Glyph size={14} stroke={2} aria-hidden />
    </span>
  ) : null;
}

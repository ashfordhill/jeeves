import {
  architectureSchema,
  buildStudioCommand,
  type DesignDocument,
  resolveStudioDefinition,
  type StudioSemanticRef,
  studioApplicationKinds,
  studioLimits,
  studioSettingsSchema,
} from "@jeeves/spec";
import type { DraftErrors, DraftSpec, DraftValues } from "../draw/form-drafts.ts";

export function draftSettings(values: DraftValues) {
  return Object.fromEntries(
    Object.entries(values).flatMap(([path, value]) =>
      path.startsWith("settings.") && value !== undefined ? [[path.slice(9), value]] : [],
    ),
  );
}

/** Only the explicit studio application allowlist or legacy canonical text is editable here. */
export function inspectorSpec(
  projectId: string,
  ref: StudioSemanticRef,
  label: string,
  design: DesignDocument,
): DraftSpec | undefined {
  const binding =
    ref.kind === "element"
      ? design.architecture?.studio?.elements.find((item) => item.element === ref.id)
      : undefined;
  if (
    binding &&
    (!resolveStudioDefinition(binding.definition) ||
      !studioApplicationKinds.some((kind) => kind === binding.settings.kind))
  )
    return;
  const definition = binding
    ? `${binding.definition.id}@${binding.definition.version}`
    : `canonical-${ref.kind}@1`;
  const read: DraftSpec["read"] = (current) => {
    let object: { name: string; description?: string } | undefined;
    if (ref.kind === "system")
      object = current.architecture?.system ?? { name: label, description: "" };
    else if (ref.kind === "context")
      object = current.architecture?.nodes.find((item) => item.id === ref.id);
    else if (ref.kind === "package")
      object = current.architecture?.studio?.packages.find((item) => item.id === ref.id);
    else object = current.elements.find((item) => item.id === ref.id);
    if (!object) return;
    const currentBinding =
      ref.kind === "element"
        ? current.architecture?.studio?.elements.find((item) => item.element === ref.id)
        : undefined;
    // A target changing definition while this form is pending is a conflict, never a migration.
    if (
      binding
        ? !currentBinding ||
          `${currentBinding.definition.id}@${currentBinding.definition.version}` !== definition ||
          currentBinding.settings.kind !== binding.settings.kind
        : currentBinding
    )
      return;
    return {
      "element.name": object.name,
      "element.description": object.description ?? "",
      ...Object.fromEntries(
        Object.entries(currentBinding?.settings ?? {}).map(([path, value]) => [
          `settings.${path}`,
          value,
        ]),
      ),
    };
  };
  const initial = read(design);
  if (!initial) return;
  return {
    projectId,
    target: ref.kind === "system" ? "system" : `${ref.kind}:${ref.id}`,
    definition,
    label,
    read,
    validate(values) {
      const errors: DraftErrors = {};
      const name = values["element.name"];
      if (typeof name !== "string" || !name.trim()) errors["element.name"] = "Enter a name";
      else if (name.length > studioLimits.name && name !== initial["element.name"])
        errors["element.name"] = `Use ${studioLimits.name} characters or fewer`;
      const description = values["element.description"];
      if (
        typeof description !== "string" ||
        (description.length > studioLimits.description &&
          description !== initial["element.description"])
      )
        errors["element.description"] = `Use ${studioLimits.description} characters or fewer`;
      if (binding) {
        const parsed = studioSettingsSchema.safeParse(draftSettings(values));
        if (!parsed.success)
          for (const issue of parsed.error.issues)
            errors[`settings.${String(issue.path[0])}`] = issue.message;
      }
      return errors;
    },
    build(current, values, paths) {
      const text = {
        ...(paths.includes("element.name") && { name: String(values["element.name"]) }),
        ...(paths.includes("element.description") && {
          description: String(values["element.description"]),
        }),
      };
      if (ref.kind === "element") {
        if (!binding) return [{ op: "updateElement", id: ref.id, ...text }];
        return buildStudioCommand(current, {
          type: "edit",
          element: ref.id,
          ...text,
          ...(paths.some((path) => path.startsWith("settings.")) && {
            settings: studioSettingsSchema.parse(draftSettings(values)),
          }),
        }).ops;
      }
      if (ref.kind === "package") {
        const pkg = current.architecture?.studio?.packages.find((item) => item.id === ref.id);
        if (!pkg) throw new Error("Package no longer exists");
        return buildStudioCommand(current, { type: "group", package: { ...pkg, ...text } }).ops;
      }
      const architecture = structuredClone(
        current.architecture ?? architectureSchema.parse({ system: { name: label } }),
      );
      if (ref.kind === "system") Object.assign(architecture.system, text);
      else {
        const node = architecture.nodes.find((item) => item.id === ref.id);
        if (!node) throw new Error("Context object no longer exists");
        Object.assign(node, text);
      }
      return [{ op: "setArchitecture", architecture }];
    },
  };
}

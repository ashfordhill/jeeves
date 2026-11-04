import {
  architectureSchema,
  buildStudioCommand,
  containerClassification,
  type DesignDocument,
  legacyStudioKind,
  resolveStudioDefinition,
  type StudioOwner,
  type StudioSemanticRef,
  studioLimits,
  studioResourceKinds,
  studioSettingsSchema,
} from "@jeeves/spec";
import type { DraftErrors, DraftSpec, DraftValues } from "../draw/form-drafts.ts";

export function ownerChoices(design: DesignDocument) {
  return [
    ...design.elements
      .filter((item) => containerClassification(item).kind === "Application")
      .map((item) => ({ value: `element:${item.id}`, label: `${item.name} · Application` })),
    ...(design.architecture?.studio?.packages ?? []).map((item) => ({
      value: `package:${item.id}`,
      label: `${item.name} · Package`,
    })),
  ];
}
export function originChoices(design: DesignDocument) {
  return design.elements
    .filter(
      (item) =>
        containerClassification(item).kind === "Application" ||
        (design.architecture?.studio?.elements.find((binding) => binding.element === item.id)
          ?.settings.kind ?? legacyStudioKind(item)) === "object-store",
    )
    .map((item) => ({
      value: item.id,
      label: `${item.name} · ${containerClassification(item).kind === "Application" ? "Application" : "Object storage"}`,
    }));
}
function ownerValue(value: unknown): StudioOwner | null {
  if (typeof value !== "string") return null;
  const [kind, id] = value.split(":");
  if ((kind !== "element" && kind !== "package") || !id) throw new Error("Select an owner");
  return { kind, id };
}

export function draftSettings(values: DraftValues) {
  return Object.fromEntries(
    Object.entries(values).flatMap(([path, value]) =>
      path.startsWith("settings.") && value !== undefined ? [[path.slice(9), value]] : [],
    ),
  );
}

/** Exact studio definitions or safe legacy canonical text, never reflected backend fields. */
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
  if (binding && !resolveStudioDefinition(binding.definition)) return;
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
      ...(binding && {
        owner: currentBinding?.owner
          ? `${currentBinding.owner.kind}:${currentBinding.owner.id}`
          : undefined,
      }),
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
        if (studioResourceKinds.some((kind) => kind === binding.settings.kind)) {
          const owner = values.owner;
          if (owner === undefined) {
            if (binding.settings.kind === "queue") errors.owner = "Select an owner";
          } else if (
            typeof owner !== "string" ||
            !ownerChoices(design).some((item) => item.value === owner)
          )
            errors.owner = "Select an application or package";
        }
        if (
          values["settings.origin"] !== undefined &&
          !originChoices(design).some((item) => item.value === values["settings.origin"])
        )
          errors["settings.origin"] = "Select an application or object store";
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
          ...(paths.includes("owner") && { owner: ownerValue(values.owner) }),
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

import {
  containerClassification,
  type DesignDocument,
  resolveStudioDefinition,
  type StudioOwner,
  studioLimits,
  studioResourceKinds,
  studioSettingsSchema,
} from "@jeeves/spec";
import type { DraftErrors, DraftSpec, DraftValues } from "../project/form-drafts.ts";
import { buildEditorCommand } from "./generation-support.ts";

/** What the tile inspector edits: an element, or the system (the actor and no selection). */
export type InspectorTarget = { kind: "system" } | { kind: "element"; id: string };

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
        design.architecture?.studio?.elements.find((binding) => binding.element === item.id)
          ?.settings.kind === "object-store",
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
  ref: InspectorTarget,
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
    const object =
      ref.kind === "system"
        ? (current.architecture?.system ?? { name: label, description: "" })
        : current.elements.find((item) => item.id === ref.id);
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
      if (ref.kind === "system")
        return buildEditorCommand(current, {
          type: "editSystem",
          ...(!current.architecture && { name: label }),
          ...text,
        }).ops;
      if (!binding)
        return buildEditorCommand(current, { type: "edit", element: ref.id, ...text }).ops;
      return buildEditorCommand(current, {
        type: "edit",
        element: ref.id,
        ...text,
        ...(paths.includes("owner") && { owner: ownerValue(values.owner) }),
        ...(paths.some((path) => path.startsWith("settings.")) && {
          settings: studioSettingsSchema.parse(draftSettings(values)),
        }),
      }).ops;
    },
  };
}

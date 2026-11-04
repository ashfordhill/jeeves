/**
 * SG09: draft spec for one C3 component. Same autosave controller as elements (form-drafts):
 * draft identity is project + component + kind, edits become one `editComponent` command.
 */
import {
  buildStudioCommand,
  type DesignDocument,
  type StudioComponent,
  type StudioComponentDefinition,
  type StudioComponentField,
  type StudioComponentSettings,
  studioComponentLimits,
  studioComponentSettingsSchemas,
} from "@jeeves/spec";
import type { DraftErrors, DraftSpec, DraftValues } from "../draw/form-drafts.ts";
import { endpointKind } from "./actions.ts";
import { draftSettings } from "./inspector-drafts.ts";

export const findComponent = (design: DesignDocument, id: string) =>
  design.architecture?.studio?.components?.find((item) => item.id === id);

/** Queues this consumer may dead-letter to: every queue except one it consumes from. */
export function deadLetterChoices(design: DesignDocument, component: StudioComponent) {
  const sources = new Set(
    (design.architecture?.studio?.componentConnections ?? []).flatMap((link) =>
      link.from === component.id && link.to.kind === "element" ? [link.to.id] : [],
    ),
  );
  return design.elements
    .filter((item) => endpointKind(design, item.id) === "queue" && !sources.has(item.id))
    .map((item) => ({ value: item.id, label: item.name }));
}

/** Fields that only apply under another setting; hidden fields are cleared with that change. */
export function componentFieldApplies(
  field: StudioComponentField,
  settings: Partial<StudioComponentSettings>,
) {
  if (field.path === "settings.blockSize")
    return "strategy" in settings && settings.strategy === "range-allocation";
  return true;
}
export function componentSelectChange(
  definition: StudioComponentDefinition,
  values: DraftValues,
  path: string,
  value: string | undefined,
): DraftValues {
  const changes: DraftValues = { [path]: value };
  const next = { ...draftSettings(values), [path.slice(9)]: value } as StudioComponentSettings;
  for (const field of definition.fields)
    if (!componentFieldApplies(field, next) && values[field.path] !== undefined)
      changes[field.path] = undefined;
  return changes;
}

export function componentSpec(
  projectId: string,
  id: string,
  design: DesignDocument,
): DraftSpec | undefined {
  const component = findComponent(design, id);
  if (!component) return;
  const kind = component.settings.kind;
  const read: DraftSpec["read"] = (current) => {
    const item = findComponent(current, id);
    // A kind change is a removal plus a new component, never a migration of this draft.
    if (!item || item.settings.kind !== kind) return;
    return {
      "component.name": item.name,
      "component.description": item.description ?? "",
      ...Object.fromEntries(
        Object.entries(item.settings).map(([key, value]) => [`settings.${key}`, value]),
      ),
    };
  };
  const initial = read(design);
  if (!initial) return;
  return {
    projectId,
    target: `component:${id}`,
    definition: `component-${kind}@1`,
    label: component.name,
    read,
    validate(values: DraftValues) {
      const errors: DraftErrors = {};
      const name = values["component.name"];
      if (typeof name !== "string" || !name.trim()) errors["component.name"] = "Enter a name";
      else if (name.length > studioComponentLimits.name)
        errors["component.name"] = `Use ${studioComponentLimits.name} characters or fewer`;
      const description = values["component.description"];
      if (typeof description !== "string" || description.length > studioComponentLimits.description)
        errors["component.description"] =
          `Use ${studioComponentLimits.description} characters or fewer`;
      const parsed = studioComponentSettingsSchemas[kind].safeParse(draftSettings(values));
      if (!parsed.success)
        for (const issue of parsed.error.issues)
          errors[`settings.${String(issue.path[0])}`] ??= issue.message;
      const dead = values["settings.deadLetterQueue"];
      const current = findComponent(design, id);
      if (
        dead !== undefined &&
        current &&
        !deadLetterChoices(design, current).some((item) => item.value === dead)
      )
        errors["settings.deadLetterQueue"] = "Select a queue other than the source queue";
      return errors;
    },
    build(current: DesignDocument, values: DraftValues, paths: readonly string[]) {
      return buildStudioCommand(current, {
        type: "editComponent",
        component: id,
        ...(paths.includes("component.name") && {
          name: String(values["component.name"]).trim(),
        }),
        ...(paths.includes("component.description") && {
          description: String(values["component.description"]).trim(),
        }),
        ...(paths.some((path) => path.startsWith("settings.")) && {
          settings: studioComponentSettingsSchemas[kind].parse(draftSettings(values)),
        }),
      }).ops;
    },
  };
}

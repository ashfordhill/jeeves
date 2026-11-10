/** Normal authoring uses installed consumers. Raw source commands remain available for
 * preserving/importing custom intent; reading a design never rewrites that intent. */
import type { z } from "zod";
import { canonicalJson } from "./content-hash.ts";
import type { DesignDocument } from "./design.ts";
import { resolveGeneration } from "./generation-resolver.ts";
import type { GenerationInstalledSupport } from "./generation-support.ts";
import { buildStudioCommand, studioCommandSchema } from "./studio-operations.ts";

/** What the mouse and chat may send: the studio's commands, refused below where unsupported. */
export const supportedAuthoringCommandSchema = studioCommandSchema;
export type SupportedAuthoringCommand = z.infer<typeof supportedAuthoringCommandSchema>;

export function normalGenerationControls(
  design: DesignDocument,
  installed: GenerationInstalledSupport,
) {
  return resolveGeneration(design, installed).settings.filter((setting) => setting.normalControl);
}

/** Only the first source path is authoritative; traced mirrors are updated atomically below. */
export function normalSettingFields(
  design: DesignDocument,
  installed: GenerationInstalledSupport,
  target: { element: string } | { component: string },
) {
  const studio = design.architecture?.studio;
  const path =
    "element" in target
      ? [
          "architecture",
          "studio",
          "elements",
          studio?.elements.findIndex((row) => row.element === target.element) ?? -1,
          "settings",
        ]
      : [
          "architecture",
          "studio",
          "components",
          studio?.components?.findIndex((row) => row.id === target.component) ?? -1,
          "settings",
        ];
  return normalGenerationControls(design, installed).filter(
    (control) => canonicalJson(control.sourcePaths[0]?.slice(0, -1)) === canonicalJson(path),
  );
}

export function buildSupportedAuthoringCommand(
  design: DesignDocument,
  raw: SupportedAuthoringCommand,
  installed: GenerationInstalledSupport,
) {
  const command = supportedAuthoringCommandSchema.parse(raw);
  if (command.type === "createComponent" || command.type === "connectComponent")
    throw new Error(
      "Add a module with addModule and connect it with connectModule; its generation and ownership are derived in the same step.",
    );
  if (
    command.type === "editConnection" &&
    (command.settings || Object.keys(command.planned ?? {}).some((key) => key !== "label"))
  )
    throw new Error(
      "Transport and connection policies have no normal editable consumer. Existing intent is preserved; custom transport requires a generation gap.",
    );
  if (command.type === "changeKind")
    throw new Error(
      "Kind replacement has no supported normal workflow; custom replacement requires a generation gap.",
    );
  if ((command.type !== "edit" && command.type !== "editComponent") || !command.settings)
    return buildStudioCommand(design, command);
  const studio = design.architecture?.studio;
  const target =
    command.type === "edit"
      ? studio?.elements.find((row) => row.element === command.element)
      : studio?.components?.find((row) => row.id === command.component);
  const controls = normalSettingFields(
    design,
    installed,
    command.type === "edit" ? { element: command.element } : { component: command.component },
  );
  const previous = target?.settings as unknown as Record<string, unknown> | undefined;
  const next = command.settings as unknown as Record<string, unknown>;
  const changed = [...new Set([...Object.keys(previous ?? {}), ...Object.keys(next)])].filter(
    (key) => canonicalJson(previous?.[key]) !== canonicalJson(next[key]),
  );
  for (const key of changed) {
    const control = controls.find((control) => control.sourcePaths[0]?.at(-1) === key);
    const value = next[key];
    if (
      !control ||
      !("values" in control.supported
        ? control.supported.values.includes(value as string | number)
        : typeof value === "number" &&
          Number.isInteger(value) &&
          value >= control.supported.integer.min &&
          value <= control.supported.integer.max)
    )
      throw new Error(
        `${key} has no installed, useful editable consumer for this target/value. Existing intent is preserved; explicitly requested custom behavior must be recorded as a generation gap.`,
      );
  }
  const batch = buildStudioCommand(design, command);
  // A single architecture update owns both the authoritative field and its traced mirrors.
  const mirrored = controls.filter(
    (control) =>
      changed.includes(String(control.sourcePaths[0]?.at(-1))) && control.sourcePaths.length > 1,
  );
  for (const op of batch.ops) {
    if (op.op !== "setStudio" || !op.studio) continue;
    for (const control of mirrored)
      for (const path of control.sourcePaths.slice(1)) {
        let object: unknown = op.studio;
        for (const key of path.slice(2, -1))
          object = (object as Record<string | number, unknown>)[key];
        (object as Record<string | number, unknown>)[String(path.at(-1))] =
          next[String(control.sourcePaths[0]?.at(-1))];
      }
  }
  return batch;
}

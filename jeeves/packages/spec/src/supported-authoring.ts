/** Normal authoring uses installed consumers. Raw source commands remain available for
 * preserving/importing custom intent; reading a design never rewrites that intent. */
import { z } from "zod";
import { canonicalJson } from "./content-hash.ts";
import type { DesignDocument } from "./design.ts";
import { generationPresets, generationRuntime } from "./generation-catalog.ts";
import { buildGenerationPresetCommand } from "./generation-presets.ts";
import { resolveGeneration } from "./generation-resolver.ts";
import { type GenerationInstalledSupport, generationCapabilities } from "./generation-support.ts";
import { idSchema } from "./ids.ts";
import { sameContractRef } from "./operation-records.ts";
import { buildStudioCommand, studioCommandSchema } from "./studio-operations.ts";

export const supportedAuthoringCommandSchema = z.union([
  studioCommandSchema,
  z.strictObject({
    type: z.literal("attachGenerationPreset"),
    preset: z.enum(["video", "youtube"]),
    prefix: idSchema.optional(),
  }),
]);
export type SupportedAuthoringCommand = z.infer<typeof supportedAuthoringCommandSchema>;

export function supportedGenerationPresets(installed: GenerationInstalledSupport) {
  return (["video", "youtube"] as const).filter(
    (key) =>
      !!installed.runtime &&
      sameContractRef(installed.runtime, generationRuntime.ref) &&
      !!installed.presets?.some((ref) => sameContractRef(ref, generationPresets[key].ref)) &&
      generationPresets[key].definition.templates.every((ref) =>
        installed.templates.some(
          (template) =>
            sameContractRef(template.ref, ref) &&
            Object.values(generationCapabilities)
              .find((capability) => sameContractRef(capability.template, ref))
              ?.settings.every((rule) =>
                template.consumers.some(
                  (consumer) =>
                    consumer.input === rule.input &&
                    consumer.consumer === rule.consumer &&
                    consumer.outputPaths.length > 0,
                ),
              ),
        ),
      ),
  );
}

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
  if (command.type === "attachGenerationPreset") {
    if (!supportedGenerationPresets(installed).includes(command.preset))
      throw new Error(
        `The ${command.preset} preset is not installed with its required consumers. No source changed.`,
      );
    return buildGenerationPresetCommand(design, command);
  }
  if (command.type === "createComponent" || command.type === "connectComponent")
    throw new Error(
      "Attach an installed feature preset to create its bound modules. Custom modules require explicit custom work and remain a generation gap.",
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
      "Kind replacement has no supported normal workflow. Attach a supported feature; custom replacement requires a generation gap.",
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

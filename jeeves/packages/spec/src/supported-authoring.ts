/** Normal authoring uses installed consumers. Raw source commands remain available for
 * preserving/importing custom intent; reading a design never rewrites that intent. */
import type { z } from "zod";
import { applyOperations } from "./apply.ts";
import { canonicalJson } from "./content-hash.ts";
import type { DesignDocument } from "./design.ts";
import type { Finding } from "./findings.ts";
import { designGeneration } from "./generation.ts";
import { generationExportBlockers, resolveGeneration } from "./generation-resolver.ts";
import { callableContractRefusal, type GenerationInstalledSupport } from "./generation-support.ts";
import { hasModuleSelections } from "./module-generation.ts";
import { studioComponentDefinitions } from "./studio-components.ts";
import { studioDefinitions } from "./studio-definitions.ts";
import { studioModelSchema } from "./studio-model.ts";
import {
  buildStudioCommand,
  moduleAuthoringBaseline,
  studioCommandSchema,
} from "./studio-operations.ts";
import { studioLinkFanKinds } from "./studio-tiles.ts";

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

/** What to draw instead of a legacy kind, in plain words. */
const legacyKindInstead: Partial<Record<string, string>> = {
  billing:
    "For payments, add a Service that owns its payment records and calls the provider as an External API.",
  notification:
    "For notifications, add a Worker or Service that calls the provider as an External API.",
  redirect: "For redirects, add a Service.",
  gateway: "Link the action to the services that handle it instead.",
};

export function buildSupportedAuthoringCommand(
  design: DesignDocument,
  raw: SupportedAuthoringCommand,
  installed: GenerationInstalledSupport,
) {
  const command = supportedAuthoringCommandSchema.parse(raw);
  // Validate a disposable result before returning any operations. Imported custom intent stays
  // readable/repairable; a normal edit may not introduce a new unsupported composition.
  const checked = (batch: ReturnType<typeof buildStudioCommand>) => {
    const next = applyOperations(design, batch.ops, { baseRevision: batch.baseRevision });
    if (!next.ok) throw new Error(next.errors.map((entry) => entry.message).join("\n"));
    if (
      (command.type === "edit" && !command.settings && command.owner === undefined) ||
      (command.type === "editComponent" && !command.settings) ||
      command.type === "editSystem" ||
      command.type === "renameAction"
    )
      return batch;
    const baseline =
      !designGeneration(design) && designGeneration(next.design)
        ? moduleAuthoringBaseline(design)
        : design;
    const existing = new Set(
      generationExportBlockers(baseline, installed).map((entry) =>
        refusalIdentity(baseline, entry),
      ),
    );
    const introduced = generationExportBlockers(next.design, installed).find(
      (entry) => !existing.has(refusalIdentity(next.design, entry)),
    );
    if (introduced) throw new Error(introduced.message);
    return batch;
  };
  // The link fan's kinds are what a new tile can be by mouse; the legacy kinds keep working on
  // existing tiles but are never added (module authoring contract, D6).
  if (command.type === "addTile" && !studioLinkFanKinds.includes(command.tile.kind)) {
    const name = studioDefinitions[command.tile.kind].name;
    const instead = legacyKindInstead[command.tile.kind] ?? "";
    throw new Error(
      `A new tile can't be ${name}: new tiles are the link fan's kinds (${studioLinkFanKinds.map((kind) => studioDefinitions[kind].name).join(", ")}). Existing ${name} tiles keep working.${instead && ` ${instead}`}`,
    );
  }
  if (command.type === "createComponent" || command.type === "connectComponent")
    throw new Error(
      "Add a module with addModule and connect it with connectModule; its generation and ownership are derived in the same step.",
    );
  // Once modules generate code, removing one or its link must re-derive, as the mouse does.
  if (
    (command.type === "removeComponent" || command.type === "disconnectComponent") &&
    hasModuleSelections(design)
  )
    throw new Error(
      command.type === "removeComponent"
        ? "Remove a module with removeModule; its tile's generation is derived again in the same step."
        : "Disconnect a module with disconnectModule; its tile's generation is derived again in the same step.",
    );
  if (command.type === "setRunnableProcesses" && command.on && !installed.processes)
    throw new Error("Runnable processes aren't installed in this studio's generator.");
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
  if (command.type === "connectModule") {
    const module = design.architecture?.studio?.components?.find(
      (item) => item.id === command.module,
    );
    const slot =
      module &&
      studioComponentDefinitions[module.settings.kind].slots.find(
        (item) => item.id === command.slot,
      );
    for (const required of slot?.callables ?? []) {
      const actual = installed.callables?.find(
        (item) => item.contract.id === required.id,
      )?.contract;
      const reason = actual
        ? callableContractRefusal(required, actual)
        : `Callable ${required.id}@${required.version} has no installed adapter.`;
      if (reason) throw new Error(reason);
    }
  }
  if (command.type === "addTile") {
    const batch = buildStudioCommand(design, command);
    // Normal creation defaults are authoring behavior, never a migration of saved input.
    for (const op of batch.ops) {
      if (op.op !== "setStudio" || !op.studio) continue;
      const studio = studioModelSchema.parse(op.studio);
      const binding = studio.elements.find((row) => row.element === command.tile.id);
      if (binding && "exposure" in binding.settings && binding.settings.kind !== "identity") {
        binding.settings.frontDoor = "required";
        if ("lane" in command.from) binding.settings.exposure = "public";
      }
      op.studio = studio;
    }
    return checked(batch);
  }
  if ((command.type !== "edit" && command.type !== "editComponent") || !command.settings)
    return checked(buildStudioCommand(design, command));
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
    // A tile setting only its process consumes may be cleared: the process runs the initial one.
    if (control?.process && value === undefined) continue;
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
  return checked(batch);
}

/** Array positions can move during a repair. Compare the addressed source identity instead. */
function refusalIdentity(design: DesignDocument, entry: Finding): string {
  let value: unknown = design;
  const path = (entry.target.path ?? []).map((key) => {
    const next = value && typeof value === "object" ? Reflect.get(value, key) : undefined;
    const stable =
      typeof key === "number" && next && typeof next === "object"
        ? ["id", "element", "connection", "role", "resource"].flatMap((field) =>
            typeof Reflect.get(next, field) === "string" ? [[field, Reflect.get(next, field)]] : [],
          )
        : [];
    value = next;
    return stable.length ? stable : key;
  });
  return canonicalJson({ code: entry.code, path, message: entry.message });
}

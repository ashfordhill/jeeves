/** Finite studio vocabulary. Legacy backend authoring is never routed through this profile. */
import type { ToolDefinition } from "@jeeves/providers";
import {
  applyOperations,
  buildStudioCommand,
  type DesignDocument,
  type Finding,
  legacyStudioDisplay,
  noTemplates,
  resolveStudioDefinition,
  resolveStudioPackagePreset,
  studioCommandSchema,
  studioDefinitions,
  studioKindSchema,
  studioPackagePresets,
  validateDesign,
} from "@jeeves/spec";
import { z } from "zod";
import type { Workspace } from "./tools.ts";

export const STUDIO_INSTRUCTIONS = `You are Jeeves's architecture studio assistant. Select, connect and configure a finite vocabulary of design-only building blocks. You do not implement software.
Use listStudioDefinitions and describeStudioDefinition for the exact settings, defaults, scope and C4b obligations. getDesign returns the current finite studio summary, not a raw backend document. Provider selections describe intent; they never select runtime templates, deploy, provision or verify behavior. A service package groups independent services and is not another runtime. A shared queue has one identity/owner at C3; C2 summarizes its producer/consumer connections.
Use applyStudioCommands with the saved baseRevision from getDesign. It calls the same strict command builder, validation, revision and history transport as manual edits. Several commands/tools in one turn commit atomically as one undo step. An error changes nothing for that call; fix it or explain the gap. A concurrent revision stops the turn without overwriting the person's edit; ask them to send again after inspecting it.
The only editable inputs are names/purposes, the system goal, finite studio settings, logical resource ownership, package membership and typed connections. Use editSystem.description for a concise stated project goal and element.description for purpose. Preserve existing declarations; the shared builder does this. Legacy objects without studio bindings retain canonical name/purpose only and cannot be silently converted.
There are no route, request/response schema, entity/field, access/business policy, lifecycle/effect, arbitrary config JSON or custom module editors in this profile. Raw applyOperations/setArchitecture, backend tools, legacy planned families, executable templates, library/study expansion and generation are unavailable. Do not invent a configurable module to satisfy requested business behavior. Keep that behavior in the person's goal context and explain the explicit C4b implementation/integration obligation; never promise it exists because a card or provider was selected. Existing hidden declarations still affect readiness and remain exportable through Generate.
Start with a small understandable graph (at most 15 initial applications/resources), useful purposes and verb labels. Docker is the default intent for a new managed service; language is independent of runtime availability. Describe shared resources accurately, and select explicit identities, not reuse by name. No provider setup or credentials. Ask a focused askUser question only if it changes the architecture materially; end after asking. Reply briefly with what changed and what remains unimplemented. Messages beginning [Jeeves] are caller context.`;

const schemas = {
  listStudioDefinitions: z.strictObject({}),
  describeStudioDefinition: z.strictObject({ kind: studioKindSchema }),
  getDesign: z.strictObject({}),
  applyStudioCommands: z.strictObject({
    baseRevision: z.int().nonnegative(),
    commands: z.array(studioCommandSchema).min(1).max(50),
  }),
  validateDesign: z.strictObject({}),
  askUser: z.strictObject({
    question: z.string().min(1).max(500),
    choices: z.array(z.string().min(1).max(120)).min(1).max(6),
    allowFreeText: z.boolean().default(true),
  }),
};
const descriptions: Record<keyof typeof schemas, string> = {
  listStudioDefinitions:
    "List the finite design-only studio definitions and package presets. None supplies a runtime or verification.",
  describeStudioDefinition:
    "Read exact finite settings JSON Schema, defaults, inspector fields, creation scopes and explicit C4b obligations for a kind.",
  getDesign:
    "Read the saved baseRevision and working finite studio summary, preserved legacy identities and current findings. No raw business/backend authoring document.",
  applyStudioCommands:
    "Prepare finite commands against getDesign.baseRevision. The exact manual builder and semantic validation apply. All accepted changes in this turn commit once; concurrent edits stop the turn. Settings are complete union values, not patches. No business/schema/route/legacy-config edits.",
  validateDesign:
    "Read current readiness findings, including preserved legacy obligations. Findings do not establish runtime support.",
  askUser: "Ask a focused question with clickable choices, then end the turn.",
};
export function studioToolDefinitions(): ToolDefinition[] {
  return (Object.keys(schemas) as (keyof typeof schemas)[]).map((name) => ({
    name,
    description: descriptions[name],
    parameters: z.toJSONSchema(schemas[name], { io: "input" }) as Record<string, unknown>,
  }));
}
export function studioCatalogSummary() {
  return Object.values(studioDefinitions).map(
    ({ id, version, kind, name, description, creationScopes }) => ({
      id,
      version,
      kind,
      name,
      description,
      creationScopes,
    }),
  );
}
export function studioDesignSummary(design: DesignDocument, findings: readonly Finding[]) {
  return {
    baseRevision: design.revision,
    system: design.architecture && {
      name: design.architecture.system.name,
      description: design.architecture.system.description,
    },
    elements: (design.architecture?.studio?.elements ?? []).map((binding) => {
      const element = design.elements.find((item) => item.id === binding.element);
      return { ...binding, name: element?.name, description: element?.description };
    }),
    packages: design.architecture?.studio?.packages ?? [],
    connections: design.connections.map((item) => ({
      id: item.id,
      from: item.from.element,
      to: item.to.element,
      kind: item.kind,
      display: item.planned ?? {
        label: item.label,
        protocol: item.protocol,
        interaction: item.interaction,
      },
      settings: design.architecture?.studio?.connections.find(
        (binding) => binding.connection === item.id,
      )?.settings,
    })),
    legacy: legacyStudioDisplay(design),
    findings,
    availability:
      "Studio definitions describe design intent only. No studio runtime resolver is available; Generate retains existing legacy obligations and support checks.",
  };
}
export function studioTurnContext(
  design: DesignDocument,
  findings: readonly Finding[],
  selection: readonly string[],
) {
  return `[Jeeves] Studio context.\nCatalog (finite, design only):\n${JSON.stringify(studioCatalogSummary())}\nCurrent design:\n${JSON.stringify(studioDesignSummary(design, findings))}\nSelected identities: ${JSON.stringify(selection)}`;
}
export function runStudioTool(workspace: Workspace, name: string, raw: string): unknown {
  if (!Object.hasOwn(schemas, name)) {
    workspace.log(name, false, "Tool unavailable in studio profile");
    return {
      ok: false,
      error: `Tool ${name} is unavailable in the studio editing profile. Use finite studio commands; business, schema and route edits are not supported.`,
    };
  }
  const tool = name as keyof typeof schemas;
  let json: unknown;
  try {
    json = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    workspace.log(tool, false, "Malformed studio arguments");
    return { ok: false, error: "Arguments must be valid JSON." };
  }
  const parsed = schemas[tool].safeParse(json);
  if (!parsed.success) {
    workspace.log(tool, false, "Studio arguments refused; nothing changed");
    return {
      ok: false,
      error: z.prettifyError(parsed.error),
      note: "Nothing changed for this call. Business/schema/route inputs are unavailable.",
    };
  }
  switch (tool) {
    case "listStudioDefinitions":
      workspace.log(tool, true, "Listed finite studio definitions");
      return {
        definitions: studioCatalogSummary(),
        packagePresets: studioPackagePresets,
        availability: "Design only; no runtime or verification supplied.",
      };
    case "describeStudioDefinition": {
      const { kind } = parsed.data as z.infer<typeof schemas.describeStudioDefinition>;
      const { settingsSchema, ...definition } = studioDefinitions[kind];
      workspace.log(tool, true, `Read studio ${kind} settings`);
      return {
        ...definition,
        settingsSchema: z.toJSONSchema(settingsSchema, { io: "input" }),
        availability: "Design only; no runtime or verification supplied.",
      };
    }
    case "getDesign":
      workspace.log(tool, true, "Read finite studio design");
      return {
        ...studioDesignSummary(workspace.working, validateDesign(workspace.working, noTemplates)),
        baseRevision: workspace.base.revision,
      };
    case "validateDesign":
      workspace.log(tool, true, "Checked studio design readiness");
      return { findings: validateDesign(workspace.working, noTemplates) };
    case "askUser":
      workspace.question = parsed.data as z.infer<typeof schemas.askUser>;
      workspace.log(tool, true, "Asked a question");
      return { ok: true, note: "End this turn; the answer comes as a new message." };
    case "applyStudioCommands": {
      const { baseRevision, commands } = parsed.data as z.infer<typeof schemas.applyStudioCommands>;
      if (baseRevision !== workspace.base.revision) {
        workspace.log(tool, false, "Studio base revision mismatch; nothing prepared");
        return {
          ok: false,
          error: "Revision conflict. Read getDesign before preparing commands.",
          baseRevision: workspace.base.revision,
        };
      }
      let working = workspace.working;
      const ops = [] as Workspace["pending"];
      try {
        for (const command of commands) {
          if (command.type === "create") {
            for (const element of command.elements)
              if (element.definition && !resolveStudioDefinition(element.definition))
                throw new Error("Choose a known studio definition and version.");
          }
          const pkg =
            command.type === "create" || command.type === "group" ? command.package : undefined;
          if (pkg?.preset && !resolveStudioPackagePreset(pkg.preset))
            throw new Error("Choose a known studio package preset.");
          const batch = buildStudioCommand(working, command);
          const result = applyOperations(working, batch.ops, noTemplates);
          if (!result.ok) {
            workspace.log(tool, false, "Studio edit refused; nothing prepared for this call");
            return { ok: false, errors: result.errors, note: "Nothing changed for this call." };
          }
          working = result.design;
          ops.push(...batch.ops);
        }
      } catch (error) {
        workspace.log(tool, false, "Studio command refused; nothing prepared for this call");
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          note: "Nothing changed for this call.",
        };
      }
      workspace.working = working;
      workspace.pending.push(...ops);
      workspace.log(
        tool,
        true,
        `Prepared ${commands.length} studio command${commands.length === 1 ? "" : "s"}`,
      );
      return {
        ok: true,
        commands: commands.length,
        findings: validateDesign(working, noTemplates),
        note: "Prepared for one atomic turn commit, not saved yet.",
      };
    }
  }
}

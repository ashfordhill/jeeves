import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { deliveryMigration } from "@jeeves/durable-events";
import { type DeliveryField, deliveryConfigSchema } from "@jeeves/spec";
import type { GenerateContext, GenerateResult, OutputFile } from "@jeeves/template-kit";

const q = JSON.stringify;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
// This SQL belongs to the P21 release. A future component must receive its own version.
const migrationHash = "0d197f7a0499032f9452fbde5f729dd3b92e6b895c6ed52b2c244d3cff6610c3";
function validator(field: DeliveryField): string {
  switch (field.type) {
    case "text":
      return `z.string().min(1).max(${field.maxLength})`;
    case "integer":
      return `z.int().min(${field.min}).max(${field.max})`;
    case "boolean":
      return "z.boolean()";
    case "enum":
      return `z.enum(${q(field.choices)})`;
  }
}
export function generate(ctx: GenerateContext): GenerateResult {
  const config = deliveryConfigSchema.parse(ctx.config);
  const attachment = ctx.attachment;
  if (!attachment) throw new Error("Durable events is an attachment");
  if (digest(deliveryMigration.sql) !== migrationHash)
    throw new Error("Released durable event SQL changed");
  const contracts = [
    "// Generated event contracts. Append a new event version to change a published payload.",
    'import { defineEvent } from "@jeeves/durable-events";',
    'import { z } from "@jeeves/service-runtime";',
    "export const schemas = {",
    ...config.events.map(
      (event) =>
        `  ${q(event.id)}: z.strictObject({ ${event.fields.map((f) => `${q(f.name)}: ${validator(f)}`).join(", ")} }),`,
    ),
    "} as const;",
    "export type Payloads = { [K in keyof typeof schemas]: z.infer<(typeof schemas)[K]> };",
    "export const events = {",
    ...config.events.map(
      (event) =>
        `  ${q(event.id)}: defineEvent({ type: ${q(event.type)}, version: ${event.version}, parse: (value: unknown) => schemas[${q(event.id)}].parse(value) }),`,
    ),
    "} as const;",
    "",
  ].join("\n");
  let adapter = readFileSync(new URL("./scaffold/adapter.ts.txt", import.meta.url), "utf8");
  for (const [key, value] of Object.entries({
    HANDLER_IMPORTS: config.events
      .map((event, index) => `import handler${index} from "../event-handlers/${event.id}.ts";`)
      .join("\n"),
    HANDLERS: config.events.map((_, i) => `handler${i}`).join(", "),
    QUEUE: q(attachment.id),
    PRESET: q(config.preset),
    MIGRATION_HASH: q(migrationHash),
  }))
    adapter = adapter.replaceAll(`%%${key}%%`, value);
  const files: OutputFile[] = [
    { path: `${ctx.dir}/src/delivery/contracts.ts`, contents: contracts, ownership: "generated" },
    { path: `${ctx.dir}/src/delivery/adapter.ts`, contents: adapter, ownership: "generated" },
    {
      path: `${ctx.dir}/event-migrations/0001.sql`,
      contents: deliveryMigration.sql,
      ownership: "generated",
    },
    ...config.events.map(
      (event): OutputFile => ({
        path: `${ctx.dir}/src/event-handlers/${event.id}.ts`,
        ownership: "scaffold",
        contents: [
          'import { defineHandler, PermanentDeliveryFailure } from "@jeeves/durable-events";',
          'import { events } from "../delivery/contracts.ts";',
          "",
          "// Project-owned domain behavior. Database effects belong inside context.effect().",
          "// External effects need destination idempotency using context.id. Cancellation is cooperative.",
          `export default defineHandler(events[${q(event.id)}], async (_payload, _context) => {`,
          "  // Implement the fixed acceptance references before enabling a producer.",
          "  throw new PermanentDeliveryFailure();",
          "});",
          "",
        ].join("\n"),
      }),
    ),
  ];
  return {
    files,
    compose: {},
    runtimeDependencies: [{ element: ctx.element.id, name: "@jeeves/durable-events" }],
  };
}

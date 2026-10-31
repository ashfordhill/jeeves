import { z } from "zod";
import type { DesignDocument } from "./design.ts";
import { idSchema } from "./ids.ts";

const fieldName = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9]{0,47}$/)
  .refine(
    (name) => !["constructor", "prototype", "__proto__"].includes(name),
    "Reserved field name",
  );
export const deliveryFieldSchema = z.discriminatedUnion("type", [
  z.strictObject({ name: fieldName, type: z.literal("text"), maxLength: z.int().min(1).max(4096) }),
  z
    .strictObject({
      name: fieldName,
      type: z.literal("integer"),
      min: z.int().min(-1_000_000_000),
      max: z.int().max(1_000_000_000),
    })
    .refine((f) => f.min <= f.max, "Minimum must not exceed maximum"),
  z.strictObject({ name: fieldName, type: z.literal("boolean") }),
  z.strictObject({
    name: fieldName,
    type: z.literal("enum"),
    choices: z
      .array(z.string().min(1).max(80))
      .min(1)
      .max(20)
      .refine((v) => new Set(v).size === v.length, "Choices must be unique"),
  }),
]);
export const deliveryEventSchema = z.strictObject({
  id: idSchema,
  type: z
    .string()
    .regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/)
    .max(100),
  version: z.int().min(1).max(1000),
  fields: z
    .array(deliveryFieldSchema)
    .min(1)
    .max(20)
    .refine(
      (fields) => new Set(fields.map((f) => f.name)).size === fields.length,
      "Payload field names must be unique",
    ),
  notes: z.string().max(12000).default(""),
  acceptance: z
    .array(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/))
    .min(1)
    .max(20)
    .refine((v) => new Set(v).size === v.length, "Acceptance references must be unique"),
});
export const deliveryConfigSchema = z.strictObject({
  preset: z.enum(["standard", "responsive"]).default("standard"),
  events: z
    .array(deliveryEventSchema)
    .min(1)
    .max(20)
    .superRefine((events, ctx) => {
      for (const key of ["id", "type/version"] as const) {
        const values = events.map((e) => (key === "id" ? e.id : `${e.type}@${e.version}`));
        if (new Set(values).size !== values.length)
          ctx.addIssue({ code: "custom", path: [], message: `Event ${key} must be unique` });
      }
    }),
});
export type DeliveryConfig = z.infer<typeof deliveryConfigSchema>;
export type DeliveryEvent = DeliveryConfig["events"][number];
export type DeliveryField = DeliveryEvent["fields"][number];
export const deliveryModelSchema = z.strictObject({
  attachment: idSchema,
  connection: idSchema,
  database: idSchema,
  config: deliveryConfigSchema,
});
export type DeliveryModel = z.infer<typeof deliveryModelSchema>;
export const eventBehaviorId = (attachment: string, event: string) =>
  `event:${attachment}:${event}`;

/** The one actual service-to-Postgres binding; no synthetic attachment connection. */
export function deliveryStore(
  design: DesignDocument,
  service: string,
): { connection: string; database: string } | undefined {
  const stores = design.connections.filter(
    (c) =>
      c.from.element === service &&
      c.kind === "uses-database" &&
      !c.from.attachment &&
      !c.to.attachment,
  );
  const store = stores[0];
  if (
    stores.length !== 1 ||
    !store ||
    design.elements.find((e) => e.id === store.to.element)?.template?.id !== "postgres"
  )
    return undefined;
  return { connection: store.id, database: store.to.element };
}
export function deliveryModels(design: DesignDocument): Record<string, DeliveryModel> {
  return Object.fromEntries(
    design.elements.flatMap((element) =>
      element.attachments
        .filter((a) => a.template.id === "durable-events")
        .map((attachment) => {
          const store = deliveryStore(design, element.id);
          if (!store)
            throw new Error(
              `${element.id}: durable events require one actual Postgres connection from this service`,
            );
          return [
            element.id,
            {
              attachment: attachment.id,
              ...store,
              config: deliveryConfigSchema.parse(attachment.config),
            },
          ];
        }),
    ),
  );
}

/** Bounded, editable design contracts; these declarations do not generate runtime code. */
import { z } from "zod";
import { idSchema } from "./ids.ts";

export const contractValueTypes = [
  "unresolved",
  "text",
  "integer",
  "number",
  "boolean",
  "uuid",
  "http-url",
  "timestamp",
  "object",
  "array",
] as const;
export const CONTRACT_NESTING_LIMIT = 5;
export type ContractValue = {
  type: (typeof contractValueTypes)[number];
  nullable?: boolean;
  items?: ContractValue;
  fields?: ContractField[];
  enumValues?: string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
};
export type ContractField = ContractValue & {
  id: string;
  name: string;
  required: boolean;
  description: string;
};
const shortText = z.string().trim().max(1200);
const count = z.int().nonnegative().max(1_000_000_000);
const valuesByDepth = new Map<number, z.ZodType<ContractValue>>();
const fieldsByDepth = new Map<number, z.ZodType<ContractField[]>>();

function checkValue(value: ContractValue, ctx: z.RefinementCtx) {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (value.items && value.type !== "array") issue("Only arrays have an item type.");
  if (value.fields && value.type !== "object") issue("Only objects have nested fields.");
  if (
    value.enumValues &&
    (value.type !== "text" || new Set(value.enumValues).size !== value.enumValues.length)
  )
    issue("Allowed values must be unique text values.");
  for (const [min, max, types] of [
    ["minLength", "maxLength", ["text"]],
    ["minimum", "maximum", ["integer", "number"]],
    ["minItems", "maxItems", ["array"]],
  ] as const) {
    if (
      (value[min] !== undefined || value[max] !== undefined) &&
      !types.some((type) => type === value.type)
    )
      issue(`${min}/${max} do not apply to ${value.type}.`);
    const lower = value[min];
    const upper = value[max];
    if (lower !== undefined && upper !== undefined && lower > upper)
      issue(`${min} must not exceed ${max}.`);
  }
  if (
    value.type === "integer" &&
    [value.minimum, value.maximum].some((v) => v !== undefined && !Number.isInteger(v))
  )
    issue("Integer bounds must be whole numbers.");
}
function valueShape(depth: number) {
  return {
    type: z.enum(contractValueTypes),
    nullable: z.boolean().optional(),
    items: z
      .lazy(() => (depth < CONTRACT_NESTING_LIMIT ? valueSchema(depth + 1) : z.never()))
      .optional(),
    fields: z
      .lazy(() => (depth < CONTRACT_NESTING_LIMIT ? fieldsSchema(depth + 1) : z.never()))
      .optional(),
    enumValues: z.array(z.string().max(120)).min(1).max(40).optional(),
    minLength: count.optional(),
    maxLength: count.optional(),
    minimum: z.number().finite().optional(),
    maximum: z.number().finite().optional(),
    minItems: count.optional(),
    maxItems: count.optional(),
  };
}
function valueSchema(depth: number): z.ZodType<ContractValue> {
  const existing = valuesByDepth.get(depth);
  if (existing) return existing;
  const schema = z.strictObject(valueShape(depth)).superRefine(checkValue);
  valuesByDepth.set(depth, schema);
  return schema;
}
function fieldSchema(depth: number): z.ZodType<ContractField> {
  return z
    .strictObject({
      ...valueShape(depth),
      id: idSchema,
      name: z
        .string()
        .trim()
        .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/),
      required: z.boolean(),
      description: shortText.default(""),
    })
    .superRefine(checkValue);
}
function fieldsSchema(depth: number): z.ZodType<ContractField[]> {
  const existing = fieldsByDepth.get(depth);
  if (existing) return existing;
  const schema = z
    .array(fieldSchema(depth))
    .max(40)
    .superRefine((items, ctx) => {
      if (
        new Set(items.map((item) => item.name)).size !== items.length ||
        new Set(items.map((item) => item.id)).size !== items.length
      )
        ctx.addIssue({
          code: "custom",
          message: "Field names and identities must be unique within an object.",
        });
    });
  fieldsByDepth.set(depth, schema);
  return schema;
}
export const contractFieldSchema = fieldSchema(0);
export const contractFieldsSchema = fieldsSchema(0);
export function unresolvedContractValue(value: ContractValue): boolean {
  return (
    value.type === "unresolved" ||
    (value.type === "array" && (!value.items || unresolvedContractValue(value.items))) ||
    (value.type === "object" &&
      (!value.fields?.length || value.fields.some(unresolvedContractValue)))
  );
}

/** Named design choices and application hooks, not executable expressions or proof of correctness. */
export const operationBehaviorSchema = z.strictObject({
  kind: z.enum(["Unspecified", "Command", "Query"]).optional(),
  authorization: shortText.optional(),
  preconditions: shortText.optional(),
  stateChanges: shortText.optional(),
  transaction: shortText.optional(),
  idempotency: z
    .enum(["Unspecified", "Read only", "Idempotent effect", "Deduplication key", "Not guaranteed"])
    .optional(),
  idempotencyKey: shortText.optional(),
  sideEffects: shortText.optional(),
  implementation: z
    .enum(["Unspecified", "Template configuration", "Application hook", "Composition"])
    .optional(),
  extensionPoint: shortText.optional(),
  acceptance: shortText.optional(),
});
export type OperationBehavior = z.output<typeof operationBehaviorSchema>;
export const operationOutcomeSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["Success", "Rejection", "Failure"]),
  status: z.int().min(100).max(599).optional(),
  condition: shortText,
  state: z.enum(["Unspecified", "Unchanged", "Committed", "Partial", "Unknown"]),
  retry: z.enum(["Unspecified", "Safe", "Unsafe", "After correction", "Reconcile first"]),
  payload: contractFieldsSchema.optional(),
});
export type OperationOutcome = z.output<typeof operationOutcomeSchema>;

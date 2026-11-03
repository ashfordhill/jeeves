import { type BackendCapabilityConfig, backendCapabilityConfigSchema } from "@jeeves/spec";

/** The strict design schema also owns bounds and the finite choice vocabulary in the editor. */
export type SettingSchema = {
  type?: string;
  const?: string | number;
  enum?: string[];
  oneOf?: SettingSchema[];
  properties?: Record<string, SettingSchema>;
  required?: string[];
  items?: SettingSchema;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};
export const settingSchemas =
  (backendCapabilityConfigSchema.toJSONSchema({ io: "input" }) as SettingSchema).oneOf ?? [];
export const settingKinds = settingSchemas.map((s) =>
  String(s.properties?.kind?.const),
) as BackendCapabilityConfig["kind"][];
export const settingSchema = (kind: string) =>
  requireSetting(settingSchemas.find((s) => s.properties?.kind?.const === kind));
export const settingLabel = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/-/g, " ")
    .replace(/^./, (v) => v.toUpperCase());
export function settingSeed(s: SettingSchema): unknown {
  if (s.const !== undefined) return s.const;
  if (s.oneOf) return settingSeed(requireSetting(s.oneOf[0]));
  if (s.enum) return s.enum[0];
  if (s.type === "object")
    return Object.fromEntries(
      Object.entries(s.properties ?? {})
        .filter(([k]) => s.required?.includes(k))
        .map(([k, v]) => [k, settingSeed(v)]),
    );
  if (s.type === "array")
    return Array.from({ length: s.minItems ?? 0 }, () => settingSeed(requireSetting(s.items)));
  if (s.type === "integer" || s.type === "number") return s.minimum ?? 0;
  if (s.pattern === "^[A-Z]{3}$") return "USD";
  if (s.pattern?.includes("\\d{4}")) return "2026-01-01";
  if (s.pattern?.includes("a-z0-9!")) return "application/pdf";
  return "";
}
export const settingGroups: Record<string, string[][]> = {
  delivery: [
    ["effect", "queue", "due"],
    ["attempts", "backoff", "leaseSeconds", "timeoutSeconds", "deadlineSeconds"],
    ["unknown", "duplicates", "provider"],
  ],
  files: [
    ["entity", "parent", "associationEntity", "store"],
    ["maximumBytes", "acceptedTypes", "inspection"],
    ["parentAccess", "lifecycle", "states", "cleanup"],
  ],
  notifications: [
    ["effect", "recipients", "cutoff", "recipient"],
    ["preferences", "access", "fields"],
    ["pageSize", "maximumRecipients", "channels"],
  ],
  search: [
    ["source", "fields", "query", "strategy", "nullableText"],
    ["projection", "access", "maximumQueryLength", "maximumResults"],
    ["freshness", "rebuild"],
  ],
  calendar: [["timezone", "weekly"], ["holidays"]],
  "business-time": [
    ["calendar", "entity", "durationMinutes", "restart"],
    ["startEvents", "stopEvents"],
    ["due", "clockVersion", "lifecycle", "runningStates"],
  ],
  routing: [["operation", "match", "maximumActions"], ["rules"], ["audit"]],
  money: [
    ["fields", "currencies"],
    [
      "minimumMinorUnits",
      "maximumMinorUnits",
      "maximumTotalMinorUnits",
      "maximumQuantity",
      "maximumLines",
    ],
  ],
  cart: [
    ["aggregate", "line", "relation", "quantity", "variant", "money"],
    ["quote"],
    ["mutations"],
  ],
  inventory: [
    [
      "aggregate",
      "stock",
      "reservation",
      "relation",
      "location",
      "variant",
      "onHand",
      "reserved",
      "quantity",
    ],
    ["lifecycle", "states"],
    ["expiry", "heldPayment"],
  ],
  order: [
    ["aggregate", "cart", "inventory", "money"],
    ["checkout", "cancellation", "lifecycle", "paymentReview"],
    ["snapshots"],
  ],
  payment: [
    ["entity", "order", "inventory", "money", "amount", "providerIdentity"],
    ["lifecycle", "states"],
    ["provider", "dispatch", "callback", "reconciliation"],
  ],
  fulfillment: [
    ["aggregate", "order", "payment", "inventory"],
    ["lifecycle", "shipment", "identity"],
    ["ordered", "paid", "reserved", "fulfilled", "quantity", "maximumQuantity"],
  ],
};

export function requireSetting<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing declared settings schema");
  return value;
}

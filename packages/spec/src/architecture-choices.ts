/** Architectural intent is independent of runtime host roles and executable wiring. */
import { z } from "zod";
import type { Element } from "./design.ts";
import { plannedCapability } from "./planned-capabilities.ts";

export const architectureKinds = [
  "Application",
  "Data store",
  "External system",
  "Deployment infrastructure",
  "Unspecified",
] as const;
export const architectureOwnerships = [
  "System responsibility",
  "External responsibility",
  "Unspecified",
] as const;
export const architectureOperations = [
  "Self operated",
  "Externally operated",
  "Unspecified",
] as const;
export const classificationSchema = z
  .strictObject({
    kind: z.enum(architectureKinds).optional(),
    ownership: z.enum(architectureOwnerships).optional(),
    operation: z.enum(architectureOperations).optional(),
  })
  .refine(
    (value) => !(value.kind === "External system" && value.ownership === "System responsibility"),
    "An external system cannot be a system-owned responsibility; choose Application or Data store.",
  );
export type Classification = z.output<typeof classificationSchema>;

export const systemChoiceOptions = {
  businessTenancy: [
    "Unspecified",
    "Personal workspaces",
    "Organizations",
    "Agency and client workspaces",
    "Custom",
  ],
  authorization: [
    "Unspecified",
    "Public access",
    "Owner access",
    "Roles and permissions",
    "Custom policy",
  ],
  dataIsolation: [
    "Unspecified",
    "Shared scoped data",
    "Schema per tenant",
    "Database per tenant",
    "Dedicated infrastructure",
  ],
  deliveryModel: ["Unspecified", "Hosted", "Private deployment", "Hosted and private"],
} as const;
export const systemChoiceLabels = {
  businessTenancy: "Business tenancy",
  authorization: "Authorization intent",
  dataIsolation: "Data isolation",
  deliveryModel: "Delivery model",
} as const;
export const systemChoicesSchema = z.strictObject({
  businessTenancy: z.enum(systemChoiceOptions.businessTenancy).optional(),
  authorization: z.enum(systemChoiceOptions.authorization).optional(),
  dataIsolation: z.enum(systemChoiceOptions.dataIsolation).optional(),
  deliveryModel: z.enum(systemChoiceOptions.deliveryModel).optional(),
});

export function containerClassification(element: Element) {
  const capability = plannedCapability(element.planned);
  const catalogKind =
    capability?.architectureKind ??
    (element.template?.id === "postgres"
      ? "Data store"
      : ["http-service", "web-app"].includes(element.template?.id ?? "")
        ? "Application"
        : "Unspecified");
  const kind = element.classification?.kind ?? catalogKind;
  return {
    kind,
    ownership:
      element.classification?.ownership ??
      (catalogKind === "External system"
        ? "External responsibility"
        : catalogKind === "Unspecified"
          ? "Unspecified"
          : "System responsibility"),
    operation: element.classification?.operation ?? "Unspecified",
  };
}
export function isExternalResponsibility(element: Element) {
  const value = containerClassification(element);
  return value.kind === "External system" || value.ownership === "External responsibility";
}

export function outsideSystem(element: Element) {
  return (
    isExternalResponsibility(element) ||
    containerClassification(element).kind === "Deployment infrastructure"
  );
}

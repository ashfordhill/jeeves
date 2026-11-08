/** Immutable finite records and exact signatures; no graph/runtime imports. */
import { z } from "zod";
import cacheCatalog from "./cache-policy-catalog.json" with { type: "json" };
import { idSchema } from "./ids.ts";
import catalog from "./operation-catalog.json" with { type: "json" };
import resolveCatalog from "./resolve-operation-catalog.json" with { type: "json" };
export const exactContractRefSchema = z.strictObject({
  id: idSchema,
  version: z
    .string()
    .max(40)
    .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/, "Use an exact lowercase SHA256 hash."),
});
export type ExactContractRef = z.infer<typeof exactContractRefSchema>;
const freeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const createLinkOperation = freeze(catalog);
export const sameContractRef = (a: ExactContractRef, b: ExactContractRef) =>
  a.id === b.id && a.version === b.version && a.sha256 === b.sha256;
export const operationSignatureSchema = z.strictObject({
  operation: exactContractRefSchema,
  request: exactContractRefSchema,
  success: exactContractRefSchema,
  errors: exactContractRefSchema,
  auth: z.enum(["verified-principal", "public"]),
  idempotency: z.enum(["principal-operation-key", "none"]),
  timeoutMs: z.int().min(1).max(300000),
});
export type OperationSignature = z.infer<typeof operationSignatureSchema>;
export function createLinkSignature(): OperationSignature {
  return {
    operation: { ...catalog.ref },
    ...Object.fromEntries(
      Object.entries(catalog.definition.schemas).map(([key, value]) => [key, { ...value.ref }]),
    ),
    auth: "verified-principal",
    idempotency: "principal-operation-key",
    timeoutMs: 10000,
  } as OperationSignature;
}

export const resolveLinkOperation = freeze(resolveCatalog);
export const positiveCachePolicy = freeze(cacheCatalog);
export const operationRecords = freeze([createLinkOperation, resolveLinkOperation] as const);
export const contractRecords = freeze([...operationRecords, positiveCachePolicy] as const);
export const knownSchemaRefs = freeze(
  contractRecords.flatMap((record) => Object.values(record.definition.schemas).map((x) => x.ref)),
);
export function resolveLinkSignature(): OperationSignature {
  return {
    operation: { ...resolveCatalog.ref },
    ...Object.fromEntries(
      Object.entries(resolveCatalog.definition.schemas).map(([key, value]) => [
        key,
        { ...value.ref },
      ]),
    ),
    auth: "public",
    idempotency: "none",
    timeoutMs: 1200,
  } as OperationSignature;
}
export const isCreateOperation = (signature: OperationSignature) =>
  sameContractRef(signature.operation, catalog.ref);
export const isResolveOperation = (signature: OperationSignature) =>
  sameContractRef(signature.operation, resolveCatalog.ref);
export const knownOperationSignature = (signature: OperationSignature) =>
  isCreateOperation(signature)
    ? createLinkSignature()
    : isResolveOperation(signature)
      ? resolveLinkSignature()
      : undefined;
export const signaturesEqual = (a: OperationSignature, b: OperationSignature) =>
  (["operation", "request", "success", "errors"] as const).every((key) =>
    sameContractRef(a[key], b[key]),
  ) &&
  a.auth === b.auth &&
  a.idempotency === b.idempotency &&
  a.timeoutMs === b.timeoutMs;
export const knownCreateSignature = (signature: OperationSignature) =>
  signaturesEqual(signature, createLinkSignature());
export const knownResolveSignature = (signature: OperationSignature) =>
  signaturesEqual(signature, resolveLinkSignature());
export const operationDisplayName = (signature: OperationSignature) =>
  isCreateOperation(signature)
    ? "Create link · v1"
    : isResolveOperation(signature)
      ? "Resolve link · v1"
      : `Unknown ${signature.operation.id}@${signature.operation.version}`;

export const exactKnownOperationSignature = (signature: OperationSignature) => {
  const expected = knownOperationSignature(signature);
  return !!expected && signaturesEqual(signature, expected);
};

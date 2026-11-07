/** Trusted host inputs only. No product resolver, upload, registry, runner or generator exists. */
import { z } from "zod";
import { canonicalJson, contentSha256 } from "./content-hash.ts";
import { idSchema } from "./ids.ts";
import {
  type ExactContractRef,
  exactContractRefSchema,
  sameContractRef,
} from "./operation-records.ts";
import {
  canonicalRows,
  tinyurlReadinessProfileRef,
  tinyurlRuntimeCases,
} from "./readiness-subject.ts";
import type { ReadinessIssue } from "./readiness-types.ts";

const refs = z.array(exactContractRefSchema).min(1).max(100);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const templateManifestSchema = z.strictObject({
  format: z.literal("jeeves.template-manifest.v1"),
  /** Supports exactly one whole semantic composition, never a wildcard template family. */
  composition: z.json(),
  templates: refs,
  dependencies: refs,
  authVerifiers: refs,
});
const environmentSchema = z.strictObject({
  id: idSchema,
  imageSha256: digest,
  configurationSha256: digest,
});
const outputIdentity = {
  compositionSha256: digest,
  profile: exactContractRefSchema,
  manifest: exactContractRefSchema,
  templates: refs,
  dependencies: refs,
  authVerifiers: refs,
  output: exactContractRefSchema,
};
export const generationReceiptSchema = z.strictObject({
  format: z.literal("jeeves.generated-receipt.v1"),
  ...outputIdentity,
  verification: z.strictObject({
    suite: exactContractRefSchema,
    environment: environmentSchema,
    /** Trusted acceptance window, not the report's wall clock. Both ends are inclusive. */
    notBefore: z.int().nonnegative(),
    notAfter: z.int().nonnegative(),
  }),
});
export const runtimeEvidenceSchema = z.strictObject({
  format: z.literal("jeeves.runtime-evidence.v1"),
  receipt: exactContractRefSchema,
  ...outputIdentity,
  suite: exactContractRefSchema,
  environment: environmentSchema,
  completedAt: z.int().nonnegative(),
  outcomes: z
    .array(z.strictObject({ case: idSchema, outcome: z.enum(["pass", "fail", "skip"]) }))
    .max(100),
});
const suiteSchema = z.strictObject({
  format: z.literal("jeeves.runtime-suite.v1"),
  cases: z.array(idSchema).min(1).max(100),
});

/** The host pins references independently of design/model input. A hash field alone is no proof. */
export type TrustedReadinessContext = {
  manifest?: ExactContractRef;
  expectedReceipt?: ExactContractRef;
  evidence?: ExactContractRef;
  resolve: (ref: ExactContractRef) => Uint8Array | undefined;
};
type Manifest = z.infer<typeof templateManifestSchema>;
const issue = (code: string, message: string, path: (string | number)[] = []): ReadinessIssue => ({
  code,
  message,
  target: { path: ["artifacts", ...path] },
});
/** A deterministic resolver failure is a blocker, never a crash or fallback to another version. */
function content(
  context: TrustedReadinessContext,
  ref: ExactContractRef,
  issues: ReadinessIssue[],
  path: (string | number)[],
) {
  if (!exactContractRefSchema.safeParse(ref).success) {
    issues.push(
      issue("ARTIFACT_REFERENCE_INVALID", "Pinned artifact reference is malformed.", path),
    );
    return;
  }
  let bytes: Uint8Array | undefined;
  try {
    bytes = context.resolve(structuredClone(ref));
  } catch {
    issues.push(
      issue(
        "ARTIFACT_RESOLVER_FAILED",
        `Trusted resolver failed for ${ref.id}@${ref.version}.`,
        path,
      ),
    );
    return;
  }
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength) {
    issues.push(
      issue(
        "ARTIFACT_UNAVAILABLE",
        `Pinned ${ref.id}@${ref.version} content is unavailable.`,
        path,
      ),
    );
    return;
  }
  if (contentSha256(bytes) !== ref.sha256) {
    issues.push(
      issue(
        "ARTIFACT_HASH_MISMATCH",
        `Resolved ${ref.id}@${ref.version} bytes do not match the pinned SHA256.`,
        path,
      ),
    );
    return;
  }
  return bytes;
}
function document<T>(
  context: TrustedReadinessContext,
  ref: ExactContractRef,
  schema: z.ZodType<T>,
  issues: ReadinessIssue[],
  path: (string | number)[],
) {
  const bytes = content(context, ref, issues, path);
  if (!bytes) return;
  try {
    const json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const parsed = schema.safeParse(json);
    if (parsed.success) return parsed.data;
  } catch {
    /* The targeted malformed result is identical for invalid UTF-8, JSON or schema. */
  }
  issues.push(
    issue(
      "ARTIFACT_DOCUMENT_INVALID",
      `Pinned ${ref.id}@${ref.version} has malformed or unsupported document content.`,
      path,
    ),
  );
}
/** Compare leaves for precise settings/provider/role/deployable failures, without reading prose. */
function differences(
  actual: unknown,
  supported: unknown,
  path: (string | number)[] = [],
): (string | number)[][] {
  if (canonicalJson(actual) === canonicalJson(supported)) return [];
  if (
    actual &&
    supported &&
    typeof actual === "object" &&
    typeof supported === "object" &&
    Array.isArray(actual) === Array.isArray(supported)
  ) {
    const left = actual as Record<string, unknown>,
      right = supported as Record<string, unknown>;
    return [...new Set([...Object.keys(left), ...Object.keys(right)])]
      .sort()
      .flatMap((key) =>
        differences(left[key], right[key], [...path, Array.isArray(actual) ? Number(key) : key]),
      );
  }
  return [path];
}
const equalRefs = (a: ExactContractRef[], b: ExactContractRef[]) =>
  canonicalJson(canonicalRows(a)) === canonicalJson(canonicalRows(b));

export function inspectImplementation(
  subject: unknown,
  verifierRefs: { ref: ExactContractRef | null; operation: string; role: string }[],
  context?: TrustedReadinessContext,
) {
  const blockers: ReadinessIssue[] = [];
  let manifest: Manifest | undefined;
  if (!context?.manifest)
    blockers.push(
      issue(
        "MANIFEST_UNAVAILABLE",
        "No trusted pinned template manifest is available. Product templates, dependencies and auth verifiers have no registry.",
      ),
    );
  else
    manifest = document(context, context.manifest, templateManifestSchema, blockers, ["manifest"]);
  if (manifest && context) {
    for (const path of differences(subject, manifest.composition))
      blockers.push({
        code: "COMPOSITION_UNSUPPORTED",
        message: `The pinned manifest does not support this composition at ${path.join(".") || "subject"}.`,
        target: { path: ["composition", "subject", ...path] },
      });
    for (const kind of ["templates", "dependencies", "authVerifiers"] as const) {
      const seen = new Set<string>();
      for (const [index, ref] of manifest[kind].entries()) {
        const key = `${ref.id}@${ref.version}`;
        if (seen.has(key))
          blockers.push(
            issue("ARTIFACT_DUPLICATE", `Manifest repeats ${kind} identity ${key}.`, [
              "manifest",
              kind,
              index,
            ]),
          );
        seen.add(key);
        content(context, ref, blockers, ["manifest", kind, index]);
      }
    }
  }
  for (const { ref, operation, role } of verifierRefs) {
    if (!ref || !manifest?.authVerifiers.some((known) => sameContractRef(ref, known)))
      blockers.push({
        code: "AUTH_VERIFIER_UNAVAILABLE",
        message: ref
          ? `Exact auth verifier ${ref.id}@${ref.version} is unresolved or unavailable in the trusted manifest.`
          : "Concrete trusted auth verifier is unspecified and unavailable; the verified-principal behavior requirement is known.",
        target: { element: role, operation },
      });
  }
  return { blockers, manifest };
}

export function inspectRuntimeEvidence(
  compositionSha256: string,
  manifest: Manifest | undefined,
  implementationAvailable: boolean,
  context?: TrustedReadinessContext,
) {
  const blockers: ReadinessIssue[] = [];
  if (!context?.evidence)
    return {
      status: "none" as const,
      blockers: [
        issue(
          "RUNTIME_EVIDENCE_NONE",
          "No trusted evidence for an exact generated output is available. Declarations and generation eligibility do not verify runtime behavior.",
        ),
      ],
    };
  const evidence = document(context, context.evidence, runtimeEvidenceSchema, blockers, [
    "evidence",
  ]);
  if (!context.expectedReceipt)
    blockers.push(
      issue(
        "OUTPUT_RECEIPT_UNAVAILABLE",
        "No independently pinned expected generation receipt/output is available.",
        ["expectedReceipt"],
      ),
    );
  const receipt =
    context.expectedReceipt &&
    document(context, context.expectedReceipt, generationReceiptSchema, blockers, [
      "expectedReceipt",
    ]);
  if (!implementationAvailable || !manifest || !context.manifest)
    blockers.push(
      issue(
        "IMPLEMENTATION_UNAVAILABLE",
        "Exact implementation artifacts must resolve before their output evidence can be accepted.",
      ),
    );
  if (receipt && manifest && context.manifest) {
    if (receipt.compositionSha256 !== compositionSha256)
      blockers.push(
        issue(
          "RECEIPT_COMPOSITION_MISMATCH",
          "Expected generated output belongs to a different composition.",
          ["expectedReceipt", "compositionSha256"],
        ),
      );
    if (!sameContractRef(receipt.profile, tinyurlReadinessProfileRef))
      blockers.push(
        issue(
          "RECEIPT_PROFILE_MISMATCH",
          "Expected output pins a different resolved profile definition.",
          ["expectedReceipt", "profile"],
        ),
      );
    if (!sameContractRef(receipt.manifest, context.manifest))
      blockers.push(
        issue("RECEIPT_MANIFEST_MISMATCH", "Expected output pins a different manifest.", [
          "expectedReceipt",
          "manifest",
        ]),
      );
    for (const kind of ["templates", "dependencies", "authVerifiers"] as const)
      if (!equalRefs(receipt[kind], manifest[kind]))
        blockers.push(
          issue("RECEIPT_ARTIFACTS_MISMATCH", `Expected output pins different ${kind}.`, [
            "expectedReceipt",
            kind,
          ]),
        );
    content(context, receipt.output, blockers, ["expectedReceipt", "output"]);
    const suite = document(context, receipt.verification.suite, suiteSchema, blockers, [
      "expectedReceipt",
      "verification",
      "suite",
    ]);
    if (
      suite &&
      canonicalJson([...suite.cases].sort()) !== canonicalJson([...tinyurlRuntimeCases].sort())
    )
      blockers.push(
        issue(
          "SUITE_COVERAGE_INCOMPLETE",
          "Pinned suite must cover every finite profile runtime obligation exactly once.",
          ["expectedReceipt", "verification", "suite"],
        ),
      );
    if (receipt.verification.notBefore > receipt.verification.notAfter)
      blockers.push(
        issue("EVIDENCE_WINDOW_INVALID", "Pinned evidence acceptance window is invalid.", [
          "expectedReceipt",
          "verification",
        ]),
      );
  }
  if (evidence && receipt && context.expectedReceipt) {
    if (!sameContractRef(evidence.receipt, context.expectedReceipt))
      blockers.push(
        issue(
          "EVIDENCE_RECEIPT_MISMATCH",
          "Evidence does not bind the independently pinned expected receipt.",
          ["evidence", "receipt"],
        ),
      );
    for (const key of ["compositionSha256", "profile", "manifest", "output"] as const)
      if (canonicalJson(evidence[key]) !== canonicalJson(receipt[key]))
        blockers.push(
          issue(
            "EVIDENCE_SUBJECT_MISMATCH",
            `Evidence ${key} differs from the trusted expected output.`,
            ["evidence", key],
          ),
        );
    for (const kind of ["templates", "dependencies", "authVerifiers"] as const)
      if (!equalRefs(evidence[kind], receipt[kind]))
        blockers.push(
          issue("EVIDENCE_ARTIFACTS_MISMATCH", `Evidence pins different ${kind}.`, [
            "evidence",
            kind,
          ]),
        );
    for (const key of ["suite", "environment"] as const)
      if (canonicalJson(evidence[key]) !== canonicalJson(receipt.verification[key]))
        blockers.push(
          issue(
            "EVIDENCE_POLICY_MISMATCH",
            `Evidence ${key} differs from the trusted verification policy.`,
            ["evidence", key],
          ),
        );
    if (
      evidence.completedAt < receipt.verification.notBefore ||
      evidence.completedAt > receipt.verification.notAfter
    )
      blockers.push(
        issue(
          "EVIDENCE_OUTSIDE_WINDOW",
          "Evidence completion is outside the pinned acceptance window.",
          ["evidence", "completedAt"],
        ),
      );
    const cases = evidence.outcomes.map((outcome) => outcome.case);
    if (canonicalJson([...cases].sort()) !== canonicalJson([...tinyurlRuntimeCases].sort()))
      blockers.push(
        issue(
          "EVIDENCE_COVERAGE_INCOMPLETE",
          "Evidence must contain every required case exactly once, with no substitutions.",
          ["evidence", "outcomes"],
        ),
      );
    for (const [index, outcome] of evidence.outcomes.entries())
      if (outcome.outcome !== "pass")
        blockers.push(
          issue(
            "EVIDENCE_CASE_NOT_PASSED",
            `Required case ${outcome.case} is ${outcome.outcome}.`,
            ["evidence", "outcomes", index],
          ),
        );
  }
  return { status: blockers.length ? ("insufficient" as const) : ("verified" as const), blockers };
}

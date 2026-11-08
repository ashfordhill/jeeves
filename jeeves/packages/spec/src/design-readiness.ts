/** One read-only report shared by mouse, blueprint v3 and chat. No capability inference. */
import { canonicalJson, jsonSha256 } from "./content-hash.ts";
import type { DesignDocument } from "./design.ts";
import { unresolvedDesignScope } from "./design-scope.ts";
import { type Finding, isDesignWarning, isStructural } from "./findings.ts";
import {
  designOperations,
  exactKnownOperationSignature,
  isCreateOperation,
  isResolveOperation,
  operationDependencyIds,
} from "./operation-contracts.ts";
import { designOwnership } from "./ownership.ts";
import {
  inspectImplementation,
  inspectRuntimeEvidence,
  type TrustedReadinessContext,
} from "./readiness-artifacts.ts";
import { readinessSubject } from "./readiness-subject.ts";
import type { DesignReadiness, ReadinessIssue, ReadinessTarget } from "./readiness-types.ts";
import { validateDesign } from "./validate.ts";

/** Classification uses the typed canonical field, never a validator's human message text. */
export function operationFindingStage(
  design: DesignDocument,
  item: Finding,
): "contract" | "implementation" {
  const path = item.target.path;
  return path?.[0] === "operations" &&
    path[1] === "receivers" &&
    typeof path[2] === "number" &&
    path[3] === "binding" &&
    path[4] === "authVerifier" &&
    designOperations(design).receivers[path[2]]?.binding.kind === "create-link"
    ? "implementation"
    : "contract";
}
function targetFor(design: DesignDocument, target: Finding["target"]): ReadinessTarget {
  const { op: _op, ...result } = target;
  const path = target.path;
  if (path?.[0] === "operations" && typeof path[2] === "number") {
    const operations = designOperations(design);
    const operation =
      path[1] === "receivers"
        ? operations.receivers[path[2]]?.id
        : path[1] === "calls"
          ? operations.calls[path[2]]?.receiverBinding
          : undefined;
    if (operation) return { ...result, operation };
  }
  if (path?.[0] === "ownership" && typeof path[2] === "number") {
    const ownership = designOwnership(design);
    if (path[1] === "owners") return { ...result, owner: ownership.owners[path[2]]?.id };
    if (path[1] === "roles")
      return {
        ...result,
        element: ownership.roles[path[2]]?.element,
        owner: ownership.roles[path[2]]?.owner,
      };
    if (path[1] === "resources")
      return { ...result, element: ownership.resources[path[2]]?.element };
    if (path[1] === "grants") return { ...result, element: ownership.grants[path[2]]?.role };
    if (path[1] === "dependencies")
      return { ...result, connection: ownership.dependencies[path[2]]?.connection };
  }
  if (path?.[0] === "architecture" && path[1] === "studio" && typeof path[3] === "number") {
    const studio = design.architecture?.studio,
      index = path[3];
    if (path[2] === "elements") return { ...result, element: studio?.elements[index]?.element };
    if (path[2] === "connections")
      return { ...result, connection: studio?.connections[index]?.connection };
    if (path[2] === "entries") return { ...result, element: studio?.entries?.[index]?.element };
    if (path[2] === "components") return { ...result, element: studio?.components?.[index]?.host };
    if (path[2] === "componentConnections") {
      const link = studio?.componentConnections?.[index];
      return {
        ...result,
        element: studio?.components?.find((component) => component.id === link?.from)?.host,
        ...(link?.to.kind === "element" ? { connection: link.to.via } : {}),
      };
    }
  }
  return result;
}
const sortedIssues = (issues: ReadinessIssue[]): ReadinessIssue[] =>
  [...new Map(issues.map((item) => [canonicalJson(item), item])).values()].sort((a, b) => {
    const left = canonicalJson(a),
      right = canonicalJson(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });

/** Coverage is independent of manifest claims: exact operations cannot bless unrelated behavior. */
function coverageIssues(design: DesignDocument): ReadinessIssue[] {
  const studio = design.architecture?.studio,
    operations = designOperations(design),
    ownership = designOwnership(design);
  const issues: ReadinessIssue[] = [];
  const add = (message: string, target: ReadinessTarget) =>
    issues.push({ code: "BEHAVIOR_UNREPRESENTED", message, target });
  if (design.schemaVersion === 3 && design.generation)
    add(
      "Generation declarations are outside the strict finite TinyURL Create/Resolve composition.",
      { path: ["generation"] },
    );
  const receivers = operations.receivers.filter((receiver) =>
    exactKnownOperationSignature(receiver.implementation),
  );
  const roles = new Set(receivers.map((receiver) => receiver.role));
  const dependencies = new Set(receivers.flatMap(operationDependencyIds));
  const callConnections = new Set(
    operations.calls.flatMap((call) =>
      call.caller.kind === "connection" ? [call.caller.connection] : [],
    ),
  );
  const entries = new Set(
    operations.calls.flatMap((call) => (call.caller.kind === "entry" ? [call.caller.entry] : [])),
  );
  const links = new Set([...dependencies, ...callConnections]);
  const resources = new Set(
    design.connections.filter((link) => dependencies.has(link.id)).map((link) => link.to.element),
  );
  const owners = new Set(
    ownership.roles.filter((role) => roles.has(role.element)).map((role) => role.owner),
  );
  for (const element of design.elements)
    if (!roles.has(element.id) && !resources.has(element.id))
      add(
        `Behavior of ${element.id} is outside the finite Create/Resolve composition; a generic tile supplies no contract.`,
        { element: element.id },
      );
  for (const link of design.connections)
    if (!links.has(link.id))
      add(`Connection ${link.id} has no exact represented operation or bound store dependency.`, {
        connection: link.id,
      });
  for (const entry of studio?.entries ?? [])
    if (!entries.has(entry.id))
      add(`Entry ${entry.id} has no exact operation expectation.`, {
        element: entry.element,
        path: ["architecture", "studio", "entries", entry.id],
      });
  for (const role of ownership.roles)
    if (!roles.has(role.element))
      add(`Role ${role.element} has no supported operation behavior.`, {
        element: role.element,
        owner: role.owner,
      });
  for (const owner of ownership.owners)
    if (!owners.has(owner.id))
      add(`Logical owner ${owner.id} has no represented operation responsibilities.`, {
        owner: owner.id,
      });
  for (const resource of ownership.resources)
    if (!resources.has(resource.element))
      add(`Resource ${resource.element} has no supported source/cache dependency.`, {
        element: resource.element,
        owner: resource.authority,
      });
  for (const node of design.architecture?.nodes ?? [])
    if (node.kind === "external-system")
      add(`External context ${node.id} has no finite implementation contract.`, {
        path: ["architecture", "nodes", node.id],
      });
  for (const relationship of design.architecture?.relationships ?? [])
    if (!relationship.container || !roles.has(relationship.container))
      add(`Context relationship ${relationship.id} has no represented operation boundary.`, {
        path: ["architecture", "relationships", relationship.id],
      });
  for (const action of studio?.actions ?? [])
    if (!studio?.entries?.some((entry) => entry.lane === action.lane))
      add(`The ${action.lane} action has no represented operation entry.`, {
        path: ["architecture", "studio", "actions", action.lane],
      });
  const trace = (id: string, seen = new Set<string>()): Set<string> => {
    if (seen.has(id)) return new Set();
    seen.add(id);
    return new Set(
      (studio?.componentConnections ?? [])
        .filter((link) => link.from === id)
        .flatMap((link) =>
          link.to.kind === "element" ? [link.to.via] : [...trace(link.to.id, seen)],
        ),
    );
  };
  for (const component of studio?.components ?? []) {
    const kind = component.settings.kind;
    const applicable = receivers.filter((receiver) => receiver.role === component.host);
    if (
      component.settings.kind === "data-access" &&
      applicable.some((receiver) => isCreateOperation(receiver.implementation)) &&
      (component.settings.readRouting !== "primary" ||
        (component.settings.statementTimeoutMs !== undefined &&
          component.settings.statementTimeoutMs > 10000))
    )
      add(
        `Create data-access module ${component.id} lacks compatible primary reads within the single 10000ms deadline.`,
        {
          element: component.host,
          path: ["architecture", "studio", "components", component.id, "settings"],
        },
      );
    const allowedEdges = applicable.flatMap((receiver) =>
      kind === "data-access"
        ? [receiver.binding.storeConnection]
        : isResolveOperation(receiver.implementation) &&
            receiver.binding.kind === "resolve-link" &&
            (kind === "cache-reader" || kind === "redirect-responder")
          ? operationDependencyIds(receiver)
          : [],
    );
    if (
      !allowedEdges.length ||
      ![...trace(component.id)].some((edge) => allowedEdges.includes(edge))
    )
      add(
        `Module ${component.id} has no represented finite behavior on its bound operation dependency.`,
        { element: component.host, path: ["architecture", "studio", "components", component.id] },
      );
  }
  return issues;
}

export function designReadiness(
  design: DesignDocument,
  trusted?: TrustedReadinessContext,
): DesignReadiness {
  // The snapshot is never parsed into a new version or mutated. Every validator participates.
  const findings = validateDesign(design),
    subject = readinessSubject(design),
    hash = jsonSha256(subject);
  const issueFor = (item: Finding): ReadinessIssue => ({
    code: item.code,
    message: item.message,
    target: targetFor(design, item.target),
  });
  const structural = sortedIssues(findings.filter(isStructural).map(issueFor));
  const contract: ReadinessIssue[] = findings
    .filter(
      (item) =>
        !isStructural(item) &&
        !isDesignWarning(item) &&
        item.code !== "NEEDS_TEMPLATE" &&
        item.target.path?.[0] !== "scope" &&
        operationFindingStage(design, item) === "contract",
    )
    .map(issueFor);
  const advisories: ReadinessIssue[] = findings.filter(isDesignWarning).map(issueFor);
  for (const requirement of unresolvedDesignScope(design)) {
    // Contract entries duplicate the exact validators; only missing-operation summaries are needed.
    if (
      requirement.source === "contract" &&
      !["create-contract", "resolve-contract", "contracts-unspecified"].includes(requirement.id)
    )
      continue;
    const issue: ReadinessIssue = {
      code: "REQUIREMENT_UNRESOLVED",
      message: requirement.requirement,
      target: {
        ...(requirement.element && { element: requirement.element }),
        ...(requirement.connection && { connection: requirement.connection }),
        path: ["scope", requirement.source, requirement.id],
      },
    };
    (requirement.criticality === "required" ? contract : advisories).push(issue);
  }
  contract.push(...coverageIssues(design));
  if (structural.length)
    contract.push({
      code: "DESIGN_INVALID",
      message: "Structural contradictions prevent a complete exact contract composition.",
      target: {},
    });
  const implementation = inspectImplementation(
    subject,
    designOperations(design).receivers.flatMap((receiver) =>
      isCreateOperation(receiver.implementation) && receiver.binding.kind === "create-link"
        ? [{ ref: receiver.binding.authVerifier, operation: receiver.id, role: receiver.role }]
        : [],
    ),
    trusted,
  );
  implementation.blockers.push(
    ...findings.filter((item) => item.code === "NEEDS_TEMPLATE").map(issueFor),
  );
  const complete = contract.length === 0;
  const available = implementation.blockers.length === 0;
  const runtime = inspectRuntimeEvidence(hash, implementation.manifest, available, trusted);
  // Verification must not certify a structurally invalid or incomplete design either.
  if (runtime.status === "verified" && (structural.length || !complete)) {
    runtime.status = "insufficient";
    runtime.blockers.push({
      code: "CONTRACT_INCOMPLETE",
      message: "Exact output evidence cannot establish unsupported or incomplete design behavior.",
      target: {},
    });
  }
  return {
    report: 1,
    composition: {
      domain: subject.domain,
      sha256: hash,
      profile: subject.resolvedProfile,
      subject: JSON.parse(canonicalJson(subject)),
    },
    designValidity: { status: structural.length ? "invalid" : "valid", blockers: structural },
    contractCompleteness: {
      status: complete ? "complete" : "incomplete",
      blockers: sortedIssues(contract),
    },
    implementationAvailability: {
      status: available ? "available" : "unavailable",
      blockers: sortedIssues(implementation.blockers),
    },
    runtimeEvidence: { status: runtime.status, blockers: sortedIssues(runtime.blockers) },
    generationEligible: !structural.length && complete && available,
    advisories: sortedIssues(advisories),
    limits: [
      "Static declaration checks do not execute HTTP, auth, storage, cache, clocks, concurrency or cancellation.",
      "Product has no template, dependency, auth-verifier or evidence registry, no generated output and no runtime runner. Trusted positive artifact resolution is exercised only in isolated tests.",
      "A manifest supports one exact pinned semantic composition. It does not certify all settings or deployments of reusable templates.",
      "Names, labels and prose do not establish behavior. Required custom or excluded-profile behavior remains unresolved; advisory requirements are listed separately.",
      "Evidence time is evaluated against the independently pinned receipt window; this deterministic report does not read the current clock.",
    ],
  };
}

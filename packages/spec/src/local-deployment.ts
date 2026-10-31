/** Read-only declared topology. It is never observed deployment state or another C4 model. */
import { createHttpPool } from "@jeeves/http-pool";
import type { DesignDocument, Element } from "./design.ts";
import type { Finding } from "./findings.ts";
import { localExecutionFor } from "./local-execution.ts";
import { localHttpPoolFor, localHttpPoolProblems } from "./local-http-pool.ts";

export function hasLocalDeploymentView(element: Element): boolean {
  return (
    element.template?.id === "http-service" &&
    ["0.1.0", "0.2.0", "0.3.0", "0.4.0"].includes(element.template.version)
  );
}
export function localDeploymentView(design: DesignDocument, id: string, findings: Finding[] = []) {
  const element = design.elements.find((item) => item.id === id);
  if (!element || !hasLocalDeploymentView(element)) return undefined;
  const execution = localExecutionFor(element),
    pool = localHttpPoolFor(element);
  const related = design.connections.filter((c) => c.from.element === id || c.to.element === id);
  const issues = [
    ...new Set([
      ...localHttpPoolProblems(design, element),
      ...findings
        .filter(
          (f) =>
            f.severity === "error" &&
            (f.target.element === id || related.some((c) => c.id === f.target.connection)),
        )
        .map((f) => f.message),
      ...(element.attachments.some((a) => a.template.id === "local-http-pool") && !pool
        ? ["The local pool policy is incomplete or unsupported."]
        : []),
      ...(element.attachments.some((a) => a.template.id === "local-execution") && !execution
        ? ["The local execution policy is incomplete or unsupported."]
        : []),
    ]),
  ];
  let proxy: ReturnType<typeof createHttpPool>["descriptor"] | undefined;
  if (pool && !issues.length) {
    // Consume the same released definition as generation; do not copy its budgets or routing defaults.
    proxy = createHttpPool({ serviceId: id, port: pool.port, replicas: pool.replicas }).descriptor;
  }
  const peers = (direction: "from" | "to", kinds: string[]) =>
    related
      .filter((c) => c[direction].element === id && kinds.includes(c.kind))
      .map((c) => {
        const peerId = c[direction === "from" ? "to" : "from"].element;
        const peer = design.elements.find((item) => item.id === peerId);
        return {
          connection: c.id,
          kind: c.kind,
          id: peerId,
          name: peer?.name ?? peerId,
          template: peer?.template,
        };
      });
  const instances = issues.length ? [] : (proxy?.instances ?? [id]);
  return {
    revision: design.revision,
    id,
    name: element.name,
    template: element.template!,
    port: Number(element.config.port ?? 8080),
    execution,
    proxy,
    issues,
    instances,
    callers: peers("to", ["calls"]),
    stores: peers("from", ["uses-database"]),
    dependencies: peers("from", ["calls", "depends-on"]),
    apiBudget:
      execution && instances.length
        ? {
            cpus: execution.cpus * instances.length,
            memoryMiB: execution.memoryMiB * instances.length,
            pids: execution.pids * instances.length,
          }
        : undefined,
    databaseConnections: proxy ? proxy.backendDatabasePoolMax * instances.length : undefined,
    legacyReplicaHint: Number(element.config.replicas ?? 1),
  };
}
export type LocalDeploymentView = NonNullable<ReturnType<typeof localDeploymentView>>;

import {
  type DesignDocument,
  type Finding,
  hasLocalDeploymentView,
  type LocalDeploymentView,
  localDeploymentView,
} from "@jeeves/spec";
import { Alert, Button, Group, NativeSelect } from "@mantine/core";
import { IconArrowDown, IconDatabase, IconRoute, IconServer } from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import "./local-deployment.css";

function Flow({ children }: { children: ReactNode }) {
  return (
    <div className="deployment-flow">
      <IconArrowDown size={18} aria-hidden />
      <span>{children}</span>
    </div>
  );
}
function Topology({ view }: { view: LocalDeploymentView }) {
  return (
    <section className="deployment-topology" aria-label="Declared physical arrangement">
      <div className="deployment-host-label">
        <strong>Local host</strong>
        <span>
          One logical application · {view.instances.length} instance
          {view.instances.length === 1 ? "" : "s"}
        </span>
      </div>
      {view.callers.length ? (
        <section className="deployment-callers" aria-label="Declared callers">
          {view.callers.map((peer) => (
            <span key={peer.connection} title={`Connection ${peer.connection}`}>
              {peer.name}
            </span>
          ))}
        </section>
      ) : (
        <p className="deployment-note">No application calls declared in this design.</p>
      )}
      {view.callers.length ? (
        <Flow>
          Calls {view.id}:{view.port}
        </Flow>
      ) : null}
      {view.proxy ? (
        <>
          <article className="deployment-card deployment-proxy" aria-label="Local proxy">
            <IconRoute size={23} aria-hidden />
            <div>
              <h3>Local proxy</h3>
              <code>
                {view.id}:{view.port}
              </code>
            </div>
            <div className="deployment-card-detail">
              <strong>Ready instances, in turn</strong>
              <span>No request replay · pool {view.proxy.version}</span>
            </div>
          </article>
          <Flow>Readiness-based routing</Flow>
        </>
      ) : null}
      <section className="deployment-instances" aria-label="Application instances">
        {view.instances.map((id, index) => (
          <article className="deployment-card deployment-instance" key={id}>
            <IconServer size={22} aria-hidden />
            <h3>
              {view.instances.length === 1 ? "Application instance" : `Instance ${index + 1}`}
            </h3>
            <code>{id}</code>
            {view.execution ? (
              <>
                <strong>
                  {view.execution.cpus} CPU · {view.execution.memoryMiB} MiB
                </strong>
                <span>
                  {view.execution.pids} PIDs · {view.execution.restartAttempts} failure restarts
                </span>
              </>
            ) : (
              <span>No explicit execution envelope selected</span>
            )}
          </article>
        ))}
      </section>
      {view.stores.length ? (
        <>
          <Flow>{view.proxy ? "Shared sessions and owner records" : "Uses database"}</Flow>
          <section className="deployment-stores" aria-label="Connected data stores">
            {view.stores.map((store) => (
              <article className="deployment-card deployment-store" key={store.connection}>
                <IconDatabase size={23} aria-hidden />
                <div>
                  <h3>{store.name}</h3>
                  <code>{store.id}</code>
                </div>
                <span>
                  {store.template?.id ?? "Unassigned store"}
                  <br />
                  Connection {store.connection}
                </span>
              </article>
            ))}
          </section>
        </>
      ) : null}
    </section>
  );
}
export function LocalDeploymentDialog({
  design,
  findings,
  initialElement,
  onClose,
  onConfigure,
  onEvidence,
  evidenceAvailable,
}: {
  design: DesignDocument;
  findings: Finding[];
  initialElement?: string;
  onClose(): void;
  onConfigure(id: string): void;
  onEvidence(id: string): void;
  evidenceAvailable: boolean;
}) {
  const applications = design.elements.filter(hasLocalDeploymentView);
  const [selected, setSelected] = useState(() =>
    applications.some((e) => e.id === initialElement) ? initialElement : applications[0]?.id,
  );
  const view = selected ? localDeploymentView(design, selected, findings) : undefined;
  return (
    <ConfigurationDialog
      title="Local deployment"
      size="xl"
      onClose={onClose}
      footer={
        <Group justify="space-between">
          <Button variant="default" onClick={onClose}>
            Close deployment
          </Button>
          <Button color="cyan.9" disabled={!view} onClick={() => view && onConfigure(view.id)}>
            Configure application
          </Button>
        </Group>
      }
    >
      <div className="local-deployment">
        <div className="deployment-intro">
          <span className="deployment-revision">Declared · revision {design.revision}</span>
          <p>Running containers and their health are not inspected.</p>
        </div>
        <div className="deployment-selector">
          <NativeSelect
            aria-label="Application deployment"
            value={selected ?? ""}
            onChange={(event) => setSelected(event.currentTarget.value)}
            data={applications.map((e) => ({ value: e.id, label: e.name }))}
          />
          <Button
            size="xs"
            variant="default"
            disabled={!evidenceAvailable || !view}
            onClick={() => view && onEvidence(view.id)}
          >
            Recorded evidence
          </Button>
        </div>
        {view ? (
          <>
            {view.issues.length ? (
              <Alert color="blue" title="Complete configuration before generation">
                <ul>
                  {view.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
                <p>
                  The physical arrangement is unavailable until these prerequisites are resolved.
                </p>
              </Alert>
            ) : (
              <>
                <dl className="deployment-budgets" aria-label="Declared execution budgets">
                  <div>
                    <dt>API instances</dt>
                    <dd>{view.instances.length}</dd>
                  </div>
                  <div>
                    <dt>API CPU ceiling</dt>
                    <dd>{view.apiBudget ? `${view.apiBudget.cpus} CPU` : "Not selected"}</dd>
                  </div>
                  <div>
                    <dt>API memory ceiling</dt>
                    <dd>{view.apiBudget ? `${view.apiBudget.memoryMiB} MiB` : "Not selected"}</dd>
                  </div>
                </dl>
                <p className="deployment-note">
                  API totals exclude the proxy and database. These ceilings do not predict
                  throughput.
                </p>
                <Topology view={view} />
                {view.execution ? (
                  <p className="deployment-note">
                    Each instance uses {view.execution.preset} execution {view.execution.version}:{" "}
                    {view.execution.shutdownMs / 1000}s application shutdown within{" "}
                    {view.execution.graceSeconds}s container grace.
                  </p>
                ) : null}
                {view.proxy ? (
                  <div className="deployment-policy-notes">
                    <p>
                      <strong>Proxy envelope:</strong> {view.proxy.proxy.cpus} CPU ·{" "}
                      {view.proxy.proxy.memoryMiB} MiB · {view.proxy.proxy.pids} PIDs. Its routing
                      is bounded; failed or ambiguous writes are never replayed.
                    </p>
                    <p>
                      <strong>Database budget:</strong> up to {view.databaseConnections} application
                      connections before other consumers. The proxy and database remain single
                      failure points on this host.
                    </p>
                  </div>
                ) : view.legacyReplicaHint !== 1 ? (
                  <p className="deployment-note">
                    Legacy replica hint {view.legacyReplicaHint} does not create instances. Select
                    an explicit local pool to change this arrangement.
                  </p>
                ) : null}
              </>
            )}
            {view.dependencies.length ? (
              <details className="deployment-dependencies">
                <summary>Other declared dependencies ({view.dependencies.length})</summary>
                <ul>
                  {view.dependencies.map((peer) => (
                    <li key={peer.connection}>
                      <strong>{peer.name}</strong> · {peer.kind} · connection {peer.connection}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <p className="deployment-note">
              Generation checks the complete design and supported source. Applying a new
              configuration requires recreating local containers; inspection and Save never deploy
              it.
            </p>
          </>
        ) : (
          <Alert color="blue" title="No supported HTTP application selected">
            Select an HTTP application from this design. This view does not invent deployment
            details for other templates.
          </Alert>
        )}
      </div>
    </ConfigurationDialog>
  );
}

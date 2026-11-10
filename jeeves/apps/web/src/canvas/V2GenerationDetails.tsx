import type { V2GenerationPreview } from "../project/generation-api.ts";

export function V2GenerationDetails({ data }: { data: V2GenerationPreview }) {
  const required = data.report.gaps.filter((gap) => gap.required);
  const processes = data.report.processes;
  return (
    <>
      <p>
        <strong>
          {data.report.applicationComplete
            ? "Selected backend assembled"
            : "Partial assembly · custom work required"}
        </strong>
        .
        {data.report.applicationComplete
          ? " Installed templates emitted the selected backend, SQL, resource and local setup wiring. The browser slot remains a separate custom UI."
          : processes?.runnable
            ? " Required hooks remain incomplete. This ZIP is an extension starting point; every application tile still starts as its own process."
            : " Required hooks remain incomplete. This ZIP is an extension starting point; unfinished application services do not start."}
      </p>
      {processes ? <GenerationProcesses processes={processes} /> : null}
      <details open>
        <summary>Support & custom gaps · {required.length} required</summary>
        <ul>
          {data.report.gaps.map((gap) => (
            <li key={`${gap.emitter}:${gap.id}`}>
              <strong>
                {gap.required ? "Required" : "Optional"} · {gap.status}
              </strong>
              : {gap.description}
            </li>
          ))}
        </ul>
        {!data.report.gaps.length ? (
          <p>
            No required implementation hooks remain in this assembly. Runtime verification remains
            unobserved for this export.
          </p>
        ) : null}
        <ul>
          {data.report.selections.map((selection) => (
            <li key={selection.selection}>
              <strong>
                {selection.selection} · {selection.status}
              </strong>
              <details>
                <summary>Emitted consumers</summary>
                <ul>
                  {selection.consumers.map((consumer) => (
                    <li key={consumer.input}>
                      {consumer.input} → {consumer.consumer}: {consumer.outputPaths.join(", ")}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </details>
      {data.report.localAdapterTreatments.length ? (
        <details>
          <summary>Local adapter limits</summary>
          <ul>
            {data.report.localAdapterTreatments.map((treatment) => (
              <li key={JSON.stringify(treatment.sourcePath)}>
                {treatment.reason} Actual: {treatment.actual}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <details>
        <summary>Source, versions & strict compatibility</summary>
        <p>
          Selected project: <code>{data.selectedSource.projectId}</code>, saved revision{" "}
          {data.selectedSource.revision}. ZIP inputs contain this exact canonical saved source.
        </p>
        <p>
          {data.generator.id} {data.generator.version} · runtime {data.runtime.id}@
          {data.runtime.version}
          {data.preset
            ? ` · preset ${data.preset.id}@${data.preset.version}`
            : " · no application preset"}
        </p>
        <p>
          Strict TinyURL readiness: {data.report.strictReadiness}. Runtime verification:{" "}
          {data.report.runtimeVerification}. Experimental implementation support grants no strict
          certification or runtime evidence.
        </p>
        <p>
          Settings:{" "}
          {
            data.report.settings.filter((setting) => setting.implementationStatus === "implemented")
              .length
          }{" "}
          implemented,{" "}
          {
            data.report.settings.filter(
              (setting) => setting.implementationStatus === "fixed-policy",
            ).length
          }{" "}
          fixed policy.
        </p>
        <p>
          Source SHA256 <code>{data.selectedSource.canonicalSha256}</code>
        </p>
        <p>
          Normalized input SHA256 <code>{data.input.normalizedInputSha256}</code>
        </p>
        <p>
          Registry SHA256 <code>{data.registry.sha256}</code>
        </p>
        <p>
          ZIP SHA256 <code>{data.archive.sha256}</code>
        </p>
        <p>
          Manifest SHA256 <code>{data.archive.manifestSha256}</code>
        </p>
        <ul>
          {data.templates.map((template) => (
            <li key={template.selection}>
              {template.ref.id}@{template.ref.version}
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

/** Each application tile's process: its service, shape and what it answers. */
function GenerationProcesses({
  processes,
}: {
  processes: NonNullable<V2GenerationPreview["report"]["processes"]>;
}) {
  return (
    <details open>
      <summary>
        Processes · {processes.tiles.length} · {processes.runnable ? "runnable" : "not runnable"}
      </summary>
      <ul aria-label="Runnable processes">
        {processes.tiles.map((row) => {
          const answers = [
            ...row.routes.map((route) => `${route.method} ${route.path}`),
            ...row.loops.map((loop) => `loop on ${loop.queue}`),
          ];
          return (
            <li key={row.tile}>
              {row.name}{" "}
              <span className="studio-field-help">
                {row.service} · {row.shape === "http" ? `HTTP, ${row.exposure}` : "worker"}
              </span>
              <p>{answers.length ? answers.join(", ") : "Idle until stopped"}</p>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

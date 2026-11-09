import type { LegacyGenerationPreview } from "../project/generation-api.ts";

export function LegacyGenerationDetails({ data }: { data: LegacyGenerationPreview }) {
  return (
    <>
      <details open>
        <summary>Included foundations</summary>
        <p>
          TypeScript HTTP/worker shells, signed multipart and FFmpeg integration points,
          PostgreSQL/Redis/AMQP clients, S3 storage, OIDC identity, search and edge configuration,
          Docker Compose, exact dependency locks, setup scripts and README.
        </p>
        <p>
          Includes the frozen diagram PNG, five source inputs, per-file hashes and provenance, and
          the full <code>.jeeves/report.json</code>.
        </p>
      </details>
      <details>
        <summary>
          Missing behavior · G01–G08 · {data.report.extensionTasks.length} custom extensions
        </summary>
        <ul>
          {data.report.gaps.map((gap) => (
            <li key={gap.id}>
              <strong>{gap.id}</strong> {gap.task}
            </li>
          ))}
        </ul>
        <p>
          S01–S08 business scenarios remain unrun; functional coverage is unmeasured. Incomplete
          endpoints/workers fail explicitly.
        </p>
      </details>
      <details>
        <summary>Local substitutions & {data.settings.unsupported} unsupported paths</summary>
        <p>
          The frozen design already normalizes storage and edge providers for local use. Remaining
          unsupported intent: Java Keycloak replaces the identity tile’s declared TypeScript
          runtime; six HTTPS links use local HTTP; eighteen service-identity declarations have no
          mTLS/workload-identity implementation. Dedicated resource credentials do not establish
          service identity or production-security equivalence.
        </p>
        <ul>
          {data.report.settings
            .filter((item) => item.status === "unsupported")
            .map((item) => (
              <li key={`${item.artifact}:${item.sourcePath}`}>
                <code>{item.sourcePath}</code>
                <p>{item.note}</p>
              </li>
            ))}
        </ul>
      </details>
      <details>
        <summary>Source, versions & strict compatibility</summary>
        <p>
          Selected project: <code>{data.selectedSource.projectId}</code>, saved revision{" "}
          {data.selectedSource.revision}. Its complete canonical source exactly matches the frozen
          profile.
        </p>
        <p>
          Archive inputs retain frozen origin <code>{data.profile.projectId}</code>, revision{" "}
          {data.profile.revision}, snapshot005. An identical copy does not rewrite that historical
          provenance.
        </p>
        <p>
          {data.generator.id} {data.generator.version} · profile {data.profile.id}@
          {data.profile.version}
        </p>
        <p>
          Strict generation eligible:{" "}
          <strong>{data.report.strictReadiness.generationEligible ? "yes" : "no"}</strong>. Strict
          template availability and runtime evidence remain none. Partial export does not change the
          compatibility contract.
        </p>
        <p>
          Settings: {data.settings.emitted} emitted, {data.settings["configuration-only"]}{" "}
          configuration only, {data.settings.custom} custom, {data.settings.unsupported}{" "}
          unsupported, {data.settings.unimplemented} untreated.
        </p>
        <p>
          Source SHA256 <code>{data.selectedSource.canonicalSha256}</code>
        </p>
        <p>
          ZIP SHA256 <code>{data.archive.sha256}</code>
        </p>
        <p>
          Manifest SHA256 <code>{data.archive.manifestSha256}</code>
        </p>
        <ul>
          {data.templates.map((template) => (
            <li key={template.id}>
              {template.id}@{template.version}
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

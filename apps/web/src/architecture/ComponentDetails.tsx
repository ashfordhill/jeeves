import { type ArchitectureViewNode, type DesignDocument, resourceConfigSchema } from "@jeeves/spec";
import { Button } from "@mantine/core";
import { AttachmentPanel } from "../draw/inspector/Inspector.tsx";
import { ResourceConfiguration } from "../draw/inspector/ResourceEditor.tsx";
import { useDraw } from "../draw/store.ts";
import { supportLabel } from "./ArchitectureGraph.tsx";
import { nodeFamily, TypeBadge } from "./type-style.tsx";

function MemberDetails({ node, design }: { node: ArchitectureViewNode; design: DesignDocument }) {
  const element = design.elements.find((item) => item.id === node.binding?.element);
  const attachment = element?.attachments.find((item) => item.id === node.binding?.attachment);
  const parsed = resourceConfigSchema.safeParse(attachment?.config.model);
  const extension = parsed.success
    ? parsed.data.extensions.find((item) => item.id === node.binding?.extension)
    : undefined;
  const resource = parsed.success
    ? parsed.data.resources.find((item) => item.id === node.binding?.resource)
    : undefined;
  const responses = extension ? Object.entries(extension.contract.responses) : [];
  const responseSummary = responses
    .filter(([status]) => /^[23]/.test(status))
    .map(
      ([status, response]) =>
        `${status} · ${Object.keys(response.content ?? {}).join(", ") || response.description}`,
    )
    .join(" / ");
  return (
    <details className="component-member">
      <summary>
        {extension ? (
          <>
            <span className="endpoint-line">
              <strong>{extension.method}</strong> {extension.path}
            </span>
            <span className="endpoint-response">{responseSummary}</span>
          </>
        ) : (
          node.name
        )}
      </summary>
      {extension ? (
        <>
          <p>{extension.access === "owner" ? "Signed-in owner" : "Public access"}</p>
          {responses.map(([status, response]) => (
            <p key={status}>
              <strong>{status}</strong> · {response.description}
              {response.content ? ` · ${Object.keys(response.content).join(", ")}` : ""}
            </p>
          ))}
          <details>
            <summary>Operation contract</summary>
            <pre className="component-contract">{JSON.stringify(extension.contract, null, 2)}</pre>
          </details>
          {extension.notes ? (
            <details>
              <summary>Implementation notes</summary>
              <p>{extension.notes}</p>
            </details>
          ) : null}
        </>
      ) : resource ? (
        <>
          <p>{resource.operations.join(" · ") || "Internal data contract"}</p>
          <ul>
            {resource.fields.map((field) => (
              <li key={field.id}>
                {field.name} <small>· {field.type}</small>
              </li>
            ))}
          </ul>
        </>
      ) : node.binding?.accounts ? (
        <p>Register · Login · Read session · Logout</p>
      ) : (
        <p>{node.description}</p>
      )}
      {element && attachment && resource ? (
        <ResourceConfiguration
          element={element}
          attachment={attachment}
          initialResource={resource.id}
        />
      ) : null}
    </details>
  );
}

export function ComponentDetails({
  node,
  onConfigure,
  onContainer,
}: {
  node: ArchitectureViewNode;
  onConfigure: () => void;
  onContainer: () => void;
}) {
  const loaded = useDraw((state) => state.loaded)!;
  const element = loaded.design.elements.find((item) => item.id === node.binding?.element);
  const attachment = element?.attachments.find((item) => item.id === node.binding?.attachment);
  return (
    <section className="component-details" data-family={nodeFamily(node, loaded.design)}>
      <TypeBadge family={nodeFamily(node, loaded.design)} />
      <h2>{node.name}</h2>
      <p>{node.description}</p>
      {node.support === "planned" ? <span className="capability-status">Planned</span> : null}
      {node.binding?.component ? (
        <Button fullWidth variant="default" onClick={onConfigure}>
          Configure component
        </Button>
      ) : null}
      {node.missing?.length ? (
        <p role="status">
          Missing bindings: {node.missing.join(", ")}. Configure this component to review them.
        </p>
      ) : null}
      {node.unassigned ? (
        <p className="planned-footnote">Not yet grouped into a responsibility.</p>
      ) : null}
      {node.members?.map((member) => (
        <MemberDetails key={member.id} node={member} design={loaded.design} />
      ))}
      {!node.members &&
      node.binding?.attachment &&
      (node.binding.resource || node.binding.extension || node.binding.accounts) ? (
        <MemberDetails node={node} design={loaded.design} />
      ) : null}
      {!node.members && element && attachment && !node.binding?.resource ? (
        <details className="component-technical">
          <summary>Application configuration</summary>
          <ul className="component-configuration">
            <AttachmentPanel element={element} attachment={attachment} findings={loaded.findings} />
          </ul>
        </details>
      ) : null}
      <details className="component-technical">
        <summary>Technical details</summary>
        <p>{supportLabel[node.support]}</p>
        <p>{node.technology}</p>
        {node.provenance ? <p>{node.provenance}</p> : null}
        <Button variant="subtle" size="xs" onClick={onContainer}>
          Open in C2
        </Button>
      </details>
    </section>
  );
}

import { type ArchitectureViewNode, type DesignDocument, resourceConfigSchema } from "@jeeves/spec";
import { Button } from "@mantine/core";
import { AttachmentPanel } from "../draw/inspector/Inspector.tsx";
import { ResourceConfiguration } from "../draw/inspector/ResourceEditor.tsx";
import { useDraw } from "../draw/store.ts";
import { supportLabel } from "./ArchitectureGraph.tsx";

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
  return (
    <details className="component-member" open>
      <summary>{node.name}</summary>
      <span className="architecture-support" data-support={node.support}>
        {supportLabel[node.support]}
      </span>
      {node.provenance ? <p className="planned-footnote">{node.provenance}</p> : null}
      {extension ? (
        <>
          <p className="endpoint-line">
            <strong>{extension.method}</strong> {extension.path}
          </p>
          <p className="planned-footnote">
            {extension.operationId} · {extension.access}
          </p>
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
      {node.acceptance.length ? (
        <p className="planned-footnote">
          Acceptance references: <strong>{node.acceptance.join(", ")}</strong>
        </p>
      ) : null}
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
    <section className="component-details">
      <span className="architecture-support" data-support={node.support}>
        {supportLabel[node.support]}
      </span>
      <h2>{node.name}</h2>
      <p>{node.description}</p>
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
        <ul className="component-configuration">
          <AttachmentPanel element={element} attachment={attachment} findings={loaded.findings} />
        </ul>
      ) : null}
      {!node.members && node.acceptance.length > 0 && !node.binding?.extension ? (
        <p>
          Acceptance references: <strong>{node.acceptance.join(", ")}</strong>
        </p>
      ) : null}
      <details className="component-technical">
        <summary>Technical details</summary>
        <p>{node.technology}</p>
        <p>{node.provenance}</p>
        <Button variant="subtle" size="xs" onClick={onContainer}>
          Open in C2
        </Button>
      </details>
    </section>
  );
}

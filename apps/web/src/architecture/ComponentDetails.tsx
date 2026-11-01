import {
  type ArchitectureViewNode,
  type DesignDocument,
  resourceConfigSchema,
  scenarioPaths,
} from "@jeeves/spec";
import { Button } from "@mantine/core";
import { OperationLabel, useApiPreview } from "../api-reference/preview.tsx";
import { AttachmentPanel } from "../draw/inspector/Inspector.tsx";
import { ResourceConfiguration } from "../draw/inspector/ResourceEditor.tsx";
import { useDraw } from "../draw/store.ts";
import { supportLabel } from "./ArchitectureGraph.tsx";
import { nodeFamily, TypeBadge } from "./type-style.tsx";

function MemberDetails({
  node,
  design,
  onOperation,
  showName = false,
}: {
  node: ArchitectureViewNode;
  design: DesignDocument;
  onOperation: (attachment: string, operation: string) => void;
  showName?: boolean;
}) {
  const { preview } = useApiPreview();
  const element = design.elements.find((item) => item.id === node.binding?.element);
  const attachment = element?.attachments.find((item) => item.id === node.binding?.attachment);
  const parsed = resourceConfigSchema.safeParse(attachment?.config.model);
  const extension = parsed.success
    ? parsed.data.extensions.find((item) => item.id === node.binding?.extension)
    : undefined;
  const resource = parsed.success
    ? parsed.data.resources.find((item) => item.id === node.binding?.resource)
    : undefined;
  const operations =
    preview?.apis
      .find((api) => api.attachment === attachment?.id)
      ?.operations.filter((operation) =>
        extension
          ? operation.extension === extension.id
          : resource
            ? operation.resource === resource.id
            : node.binding?.accounts
              ? operation.group === "Sessions"
              : true,
      ) ?? [];
  if (operations.length)
    return (
      <section className="component-member">
        {showName && (resource || node.binding?.accounts) ? <h3>{node.name}</h3> : null}
        {operations.map((operation) => (
          <button
            type="button"
            className="component-operation"
            key={operation.id}
            onClick={() => onOperation(attachment!.id, operation.id)}
          >
            <OperationLabel operation={operation} />
          </button>
        ))}
      </section>
    );
  return (
    <details className="component-member">
      <summary>{node.name}</summary>
      <p>{node.description}</p>
      {extension ? (
        <Button
          variant="default"
          onClick={() => onOperation(attachment!.id, extension.operationId)}
        >
          Inspect operation
        </Button>
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
  onOperation,
}: {
  node: ArchitectureViewNode;
  onConfigure: () => void;
  onContainer: () => void;
  onOperation: (attachment: string, operation: string) => void;
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
      {node.binding?.component ||
      node.members?.some((member) => member.binding?.resource || member.binding?.extension) ? (
        <Button fullWidth variant="default" onClick={onConfigure}>
          {node.binding?.component ? "Configure component" : "Define responsibility"}
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
        <MemberDetails
          key={member.id}
          node={member}
          design={loaded.design}
          onOperation={onOperation}
          showName
        />
      ))}
      {!node.members &&
      node.binding?.attachment &&
      (node.binding.resource ||
        node.binding.extension ||
        node.binding.accounts ||
        attachment?.config.model) ? (
        <MemberDetails node={node} design={loaded.design} onOperation={onOperation} />
      ) : null}
      {!node.members && element && attachment && !node.binding?.resource ? (
        <details className="component-technical">
          <summary>Application configuration</summary>
          <ul className="component-configuration">
            <AttachmentPanel element={element} attachment={attachment} findings={loaded.findings} />
          </ul>
        </details>
      ) : null}
      {loaded.design.architecture?.components?.some(
        (c) => c.id === node.binding?.component && c.capability === "screen-group",
      ) ? (
        <details className="component-technical">
          <summary>Client journey expectations</summary>
          {(loaded.design.architecture?.scenarios ?? []).flatMap((s) =>
            scenarioPaths(s).flatMap((p) =>
              p.steps
                .filter((step) => step.client?.component === node.binding?.component)
                .map((step) => (
                  <p key={`${s.id}:${step.id}`}>
                    {s.name} / {p.name}: {step.client?.state} — {step.text} (binding {step.binding}
                    ). Authored expectation.
                  </p>
                )),
            ),
          )}
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

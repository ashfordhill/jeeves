import type { ApiOperation, ResourceConfig } from "@jeeves/spec";
import { Alert, Button, Group, Loader, NativeSelect, Stack, Text } from "@mantine/core";
import { lazy, Suspense, useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { ResourceConfiguration } from "../draw/inspector/ResourceEditor.tsx";
import { useDraw } from "../draw/store.ts";
import { ExtensionEditor } from "./ExtensionEditor.tsx";
import { OperationLabel, schemaLabel, useApiPreview } from "./preview.tsx";
import "./api-reference.css";

const ApiReference = lazy(() => import("./ApiReference.tsx"));
export type ApiSelection = { attachment?: string; operation?: string };
export function ApiWorkspace({
  opened,
  selection,
  onSelect,
  onClose,
}: {
  opened: boolean;
  selection: ApiSelection;
  onSelect: (selection: ApiSelection) => void;
  onClose: () => void;
}) {
  const loaded = useDraw((s) => s.loaded)!;
  const { preview, error, retry } = useApiPreview();
  const [reference, setReference] = useState<"all" | "selected">();
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const current =
    preview?.apis.find((item) => item.attachment === selection.attachment) ?? preview?.apis[0];
  const operation =
    current?.operations.find((item) => item.id === selection.operation) ?? current?.operations[0];
  const element = loaded.design.elements.find((item) => item.id === current?.element);
  const attachment = element?.attachments.find((item) => item.id === current?.attachment);
  const model = attachment?.config.model as ResourceConfig | undefined;
  const extension = model?.extensions.find((item) => item.id === operation?.extension);
  const key = `${current?.attachment}:${operation?.id}`;
  if (!opened) return null;
  return (
    <ConfigurationDialog
      title="API contracts"
      size="xl"
      onClose={onClose}
      footer={
        <Group justify="space-between">
          <Text size="xs">
            Saved revision {preview?.revision ?? loaded.design.revision} · Design preview
          </Text>
          <Button variant="default" onClick={onClose}>
            Close API contracts
          </Button>
        </Group>
      }
    >
      <Stack gap="sm">
        <Text size="sm">
          Compiled from the saved design. Unsaved drafts are excluded. A running application's
          contract may be older. Requests are disabled.
        </Text>
        {error ? (
          <Alert color="red" role="alert">
            {error}{" "}
            <Button variant="default" size="xs" onClick={retry}>
              Retry API preview
            </Button>
          </Alert>
        ) : !preview ? (
          <Group>
            <Loader size="sm" />
            <Text>Compiling saved API contracts…</Text>
          </Group>
        ) : null}
        {preview && !preview.apis.length ? (
          <Text>No REST API capabilities in this design.</Text>
        ) : null}
        {current ? (
          <>
            <Group justify="space-between" align="end">
              <NativeSelect
                label="API application"
                value={current.attachment}
                data={preview!.apis.map((item) => ({
                  value: item.attachment,
                  label:
                    preview!.apis.filter((a) => a.element === item.element).length > 1
                      ? `${item.name} · ${item.attachment}`
                      : item.name,
                }))}
                onChange={(e) => onSelect({ attachment: e.currentTarget.value })}
              />
              <Button
                variant="default"
                disabled={!current.document}
                onClick={() => setReference("all")}
              >
                Full API reference
              </Button>
            </Group>
            {current.unavailable ? (
              <Alert color="yellow">{current.unavailable}</Alert>
            ) : (
              <div className="api-workspace-grid">
                <nav
                  ref={(node) => {
                    node
                      ?.querySelector('[aria-pressed="true"]')
                      ?.scrollIntoView({ block: "nearest" });
                  }}
                  className="api-operation-list"
                  aria-label="API operations"
                >
                  {[...new Set(current.operations.map((item) => item.group))].map((group) => (
                    <section key={group}>
                      <h3>{group}</h3>
                      {current.operations
                        .filter((item) => item.group === group)
                        .map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            aria-pressed={operation?.id === item.id}
                            aria-label={`${item.method} ${item.path}`}
                            onClick={() =>
                              onSelect({ attachment: current.attachment, operation: item.id })
                            }
                          >
                            <OperationLabel operation={item} />
                          </button>
                        ))}
                    </section>
                  ))}
                </nav>
                {operation ? (
                  <section className="api-operation-detail" aria-label="Selected operation">
                    <h2>
                      {operation.method} {operation.path}
                    </h2>
                    <p>{operation.purpose}</p>
                    {!editing[key] || operation.protected || !extension ? (
                      <>
                        <OperationDetails operation={operation} />
                        <Button
                          variant="default"
                          size="xs"
                          onClick={() => setReference("selected")}
                        >
                          Response schemas and examples
                        </Button>
                      </>
                    ) : null}
                    {element && attachment && operation.resource ? (
                      <ResourceConfiguration
                        key={`${attachment.id}:${operation.resource}`}
                        element={element}
                        attachment={attachment}
                        initialResource={operation.resource}
                      />
                    ) : null}
                    {operation.protected ? (
                      <p className="api-protected">
                        {operation.extension || operation.resource
                          ? "Protected recipe definition. Use independent project operations or resources for custom behavior."
                          : "Generated session contract. Managed by the pinned API template."}
                      </p>
                    ) : extension && attachment ? (
                      <>
                        {editing[key] ? (
                          <ExtensionEditor
                            key={key}
                            attachment={attachment}
                            extension={extension}
                            onDone={() => setEditing((state) => ({ ...state, [key]: false }))}
                          />
                        ) : (
                          <Button
                            variant="default"
                            size="xs"
                            onClick={() => setEditing((state) => ({ ...state, [key]: true }))}
                          >
                            Edit operation
                          </Button>
                        )}
                      </>
                    ) : null}
                  </section>
                ) : null}
              </div>
            )}
          </>
        ) : null}
      </Stack>
      {reference && current?.document ? (
        <ConfigurationDialog
          title="Saved design OpenAPI reference"
          size="xl"
          onClose={() => setReference(undefined)}
          footer={
            <Button variant="default" onClick={() => setReference(undefined)}>
              Close reference
            </Button>
          }
        >
          <Text size="sm" mb="sm">
            {current.name} · Saved revision {preview!.revision} · Design preview, not a live
            application contract. Requests and external validation are disabled.
          </Text>
          <Suspense fallback={<Loader size="sm" />}>
            <ApiReference
              api={current}
              operationId={reference === "selected" ? operation?.id : undefined}
            />
          </Suspense>
        </ConfigurationDialog>
      ) : null}
    </ConfigurationDialog>
  );
}
function OperationDetails({ operation }: { operation: ApiOperation }) {
  const { contract } = operation;
  const body = contract.requestBody?.content["application/json"].schema;
  return (
    <>
      <h3>Access</h3>
      <p>
        {operation.access === "owner"
          ? "Signed-in owner; records are scoped to that owner."
          : operation.access === "session"
            ? "Signed-in session."
            : "Public access."}
        {operation.method !== "GET"
          ? " State-changing requests use the template's origin and CSRF protections."
          : ""}
      </p>
      <h3>Inputs</h3>
      {contract.parameters?.length ? (
        <ul>
          {contract.parameters.map((parameter) => (
            <li key={`${parameter.in}:${parameter.name}`}>
              <strong>{parameter.name}</strong> · {parameter.in} ·{" "}
              {parameter.required ? "required" : "optional"} · {schemaLabel(parameter.schema)}
            </li>
          ))}
        </ul>
      ) : (
        <p>No path, query or header parameters.</p>
      )}
      {body ? (
        <>
          <p>Required application/json body · {schemaLabel(body)}</p>
          {body.properties && typeof body.properties === "object" ? (
            <p>Fields: {Object.keys(body.properties).join(", ")}</p>
          ) : null}
          {operation.method === "PATCH" ? (
            <p>Updates accept a partial set of resource fields.</p>
          ) : null}
        </>
      ) : (
        <p>No request body.</p>
      )}
      <h3>Responses</h3>
      <ul className="api-response-list">
        {Object.entries(contract.responses).map(([status, response]) => (
          <li key={status}>
            <strong>{status}</strong> · {response.description}
            {Object.keys(response.content ?? {}).length ? (
              <ul>
                {Object.entries(response.content!).map(([media, content]) => (
                  <li key={media}>
                    {media} · {schemaLabel(content.schema)}
                  </li>
                ))}
              </ul>
            ) : (
              <span> · No body</span>
            )}
            {response.headers ? (
              <p>
                Headers:{" "}
                {Object.entries(response.headers)
                  .map(
                    ([name, header]) =>
                      `${name}${header.required ? " (required)" : ""} · ${schemaLabel(header.schema)}`,
                  )
                  .join(", ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

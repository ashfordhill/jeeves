/** Disposable architecture spike. No API calls, project writes, or production imports. */
import { convertToExcalidrawElements, Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  Background,
  type Connection,
  Controls,
  Handle,
  type Node,
  type NodeProps,
  NodeResizer,
  Position,
  ReactFlow,
  reconnectEdge,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "@excalidraw/excalidraw/index.css";
import "./review.css";

type Subtype = "unselected" | "http-service" | "web-app" | "postgres";
type ReviewNode = Node<{ subtype: Subtype; components: string[]; change?: (s: Subtype) => void }>;
const compatible: Record<Subtype, string[]> = {
  unselected: [],
  "http-service": ["REST server", "REST client"],
  "web-app": ["REST client"],
  postgres: [],
};
const initial: ReviewNode[] = [
  {
    id: "service",
    position: { x: 80, y: 120 },
    type: "service",
    style: { width: 280, height: 200 },
    data: { subtype: "unselected", components: [] },
  },
  {
    id: "web",
    position: { x: 80, y: 440 },
    type: "service",
    style: { width: 280, height: 200 },
    data: { subtype: "web-app", components: ["REST client"] },
  },
  {
    id: "database",
    position: { x: 650, y: 120 },
    type: "service",
    style: { width: 280, height: 200 },
    data: { subtype: "postgres", components: [] },
  },
];

function SubtypeSelect({ value, change }: { value: Subtype; change: (s: Subtype) => void }) {
  return (
    <select
      aria-label="Service subtype"
      value={value}
      onChange={(event) => change(event.target.value as Subtype)}
    >
      <option value="unselected">Choose subtype</option>
      <option value="http-service">HTTP service</option>
      <option value="web-app">Web application</option>
    </select>
  );
}

function ServiceNode({ id, data, selected }: NodeProps<ReviewNode>) {
  return (
    <article
      className={`review-card ${data.subtype === "postgres" ? "database" : ""}`}
      aria-label={id}
    >
      <NodeResizer isVisible={selected} minWidth={240} minHeight={150} />
      <Handle id="in" type="target" position={Position.Left} />
      <strong>{data.subtype === "postgres" ? "Postgres" : `Service: ${id}`}</strong>
      {data.subtype !== "postgres" && data.change ? (
        <div className="nodrag">
          <SubtypeSelect value={data.subtype} change={data.change} />
        </div>
      ) : null}
      <ul>
        {data.components.map((component) => (
          <li key={component}>{component}</li>
        ))}
      </ul>
      <Handle id="out" type="source" position={Position.Right} />
    </article>
  );
}
const nodeTypes = { service: ServiceNode };

function sceneFor(nodes: ReviewNode[], previous: readonly ExcalidrawElement[]) {
  const skeletons: ExcalidrawElementSkeleton[] = [];
  for (const node of nodes) {
    const old = previous.find((element) => element.id === node.id);
    const x = old?.x ?? node.position.x;
    const y = old?.y ?? node.position.y;
    const width = old?.width ?? 280;
    const height = old?.height ?? 200;
    const common = {
      groupIds: [node.id],
      strokeWidth: 2,
      roughness: 0,
      customData: { owner: node.id },
    };
    skeletons.push({
      ...common,
      type: "rectangle",
      id: node.id,
      x,
      y,
      width,
      height,
      backgroundColor: "#fff4d4",
      fillStyle: "solid",
    });
    if (node.data.subtype === "postgres") {
      skeletons.push({
        ...common,
        type: "ellipse",
        id: `${node.id}-top`,
        x,
        y: y - 15,
        width,
        height: 30,
        backgroundColor: "#fff4d4",
        fillStyle: "solid",
      });
    }
    skeletons.push({
      ...common,
      type: "text",
      id: `${node.id}-label`,
      x: x + 20,
      y: y + 25,
      text: `${node.id}\n${node.data.subtype}`,
      fontSize: 18,
      fontFamily: 2,
    });
    node.data.components.forEach((component, index) => {
      skeletons.push({
        ...common,
        type: "rectangle",
        id: `${node.id}-component-${index}`,
        x: x + 20,
        y: y + 95 + index * 42,
        width: width - 40,
        height: 36,
        backgroundColor: "#d7eef4",
        fillStyle: "solid",
        label: { text: component, fontSize: 16, fontFamily: 2 },
      });
    });
  }
  return convertToExcalidrawElements(skeletons, { regenerateIds: false });
}

function ExcalidrawReview({
  nodes,
  select,
}: {
  nodes: ReviewNode[];
  select: (id: string) => void;
}) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI>();
  const previous = useRef<readonly ExcalidrawElement[]>([]);
  const [geometry, setGeometry] = useState("");
  const [diagnostics, setDiagnostics] = useState("No native arrows");
  useEffect(() => {
    if (!api) return;
    const elements = sceneFor(nodes, previous.current);
    // Preserve native arrows while changing labels/components. Native geometry stays in Excalidraw.
    api.updateScene({
      elements: [...elements, ...previous.current.filter((e) => e.type === "arrow")],
    });
  }, [api, nodes]);
  return (
    <div className="review-canvas" data-testid="excalidraw-review">
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={{ appState: { viewBackgroundColor: "#faf9f6" } }}
        onChange={(elements, appState) => {
          previous.current = elements;
          setGeometry(
            JSON.stringify(
              elements.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })),
            ),
          );
          const picked = elements.find((element) => appState.selectedElementIds[element.id]);
          const owner: unknown = picked?.customData?.owner;
          if (typeof owner === "string") select(owner);
          const arrows = elements
            .filter((element) => element.type === "arrow")
            .filter((element) => !element.isDeleted);
          setDiagnostics(
            arrows
              .flatMap((arrow) =>
                arrow.type === "arrow"
                  ? [
                      `${arrow.id}: ${arrow.startBinding?.elementId ?? "free"} → ${arrow.endBinding?.elementId ?? "free"}`,
                    ]
                  : [],
              )
              .join("; ") || "No native arrows",
          );
        }}
      />
      <details className="review-native-geometry">
        <summary>Native geometry</summary>
        <pre role="img" aria-label="Native geometry">
          {geometry}
        </pre>
      </details>
      <output className="review-diagnostics" aria-label="Native arrow bindings">
        {diagnostics}
      </output>
    </div>
  );
}

function Review() {
  const [engine, setEngine] = useState("react-flow");
  const [nodes, setNodes, onNodesChange] = useNodesState<ReviewNode>(initial);
  const [edges, setEdges, onEdgesChange] = useEdgesState([
    {
      id: "uses-db",
      source: "service",
      target: "database",
      label: "uses database",
      type: "smoothstep",
    },
  ]);
  const [selected, select] = useState("service");
  const [pendingSubtype, setPendingSubtype] = useState<{ id: string; subtype: Subtype }>();
  const [notice, setNotice] = useState("");
  const node = nodes.find((item) => item.id === selected);
  const change = (subtype: Subtype, discard = false, id = selected) => {
    const node = nodes.find((item) => item.id === id);
    if (!node || subtype === node.data.subtype) return;
    if (node.data.components.length && !discard) {
      setPendingSubtype({ id, subtype });
      return;
    }
    setNodes((items) =>
      items.map((item) => (item.id === id ? { ...item, data: { subtype, components: [] } } : item)),
    );
    setPendingSubtype(undefined);
  };
  const labelFor = (connection: Connection) => {
    const source = nodes.find((item) => item.id === connection.source);
    const target = nodes.find((item) => item.id === connection.target);
    if (
      !source ||
      !target ||
      source.id === target.id ||
      source.data.subtype === "postgres" ||
      source.data.subtype === "unselected"
    )
      return undefined;
    if (target.data.subtype === "postgres" && source.data.subtype === "http-service")
      return "uses database";
    if (
      source.data.components.includes("REST client") &&
      target.data.components.includes("REST server")
    )
      return "calls";
    return undefined;
  };
  return (
    <div className="review">
      <header>
        <h1>Editor comparison</h1>
        <p>Architecture prototype · temporary state · no saved projects</p>
        <label>
          Engine{" "}
          <select aria-label="Engine" value={engine} onChange={(e) => setEngine(e.target.value)}>
            <option value="react-flow">React Flow</option>
            <option value="excalidraw">Excalidraw</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            const id = `service-${nodes.length}`;
            setNodes((items) => [
              ...items,
              {
                id,
                type: "service",
                position: { x: 650, y: 440 },
                style: { width: 280, height: 200 },
                data: { subtype: "unselected", components: [] },
              },
            ]);
            select(id);
          }}
        >
          Add Service rectangle
        </button>
      </header>
      {engine === "react-flow" ? (
        <div className="review-canvas">
          <ReactFlow
            nodes={nodes.map((item) => ({
              ...item,
              selected: item.id === selected,
              data: {
                ...item.data,
                change: (s: Subtype) => {
                  select(item.id);
                  change(s, false, item.id);
                },
              },
            }))}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, item) => select(item.id)}
            onConnect={(connection) => {
              const label = labelFor(connection);
              if (!label) {
                setNotice("Choose compatible subtypes and components first.");
                return;
              }
              setNotice("");
              setEdges((items) => [
                ...items,
                {
                  ...connection,
                  id: `connection-${items.length}`,
                  type: "smoothstep",
                  label,
                },
              ]);
            }}
            onReconnect={(edge, connection) => {
              const label = labelFor(connection);
              if (!label) {
                setNotice("Choose compatible subtypes and components first.");
                return;
              }
              setEdges((items) => reconnectEdge({ ...edge, label }, connection, items));
            }}
            fitView
            fitViewOptions={{ maxZoom: 0.9 }}
            deleteKeyCode={null}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      ) : (
        <ExcalidrawReview nodes={nodes} select={select} />
      )}
      <aside>
        <h2>Inspector</h2>
        <label>
          Selection{" "}
          <select aria-label="Selection" value={selected} onChange={(e) => select(e.target.value)}>
            {nodes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id}
              </option>
            ))}
          </select>
        </label>
        {node && node.data.subtype !== "postgres" ? (
          <>
            <SubtypeSelect value={node.data.subtype} change={change} />
            <h3>Compatible components</h3>
            {compatible[node.data.subtype].map((component) => (
              <label key={component}>
                <input
                  type="checkbox"
                  checked={node.data.components.includes(component)}
                  onChange={(event) => {
                    setNodes((items) =>
                      items.map((item) =>
                        item.id === selected
                          ? {
                              ...item,
                              data: {
                                ...item.data,
                                components: event.target.checked
                                  ? [...item.data.components, component]
                                  : item.data.components.filter((c) => c !== component),
                              },
                            }
                          : item,
                      ),
                    );
                  }}
                />
                {component}
              </label>
            ))}
          </>
        ) : (
          <p>Database is a separate outer element.</p>
        )}
        {pendingSubtype ? (
          <div role="dialog" aria-label="Discard customized configuration">
            <p>
              Changing subtype removes these configured components:{" "}
              {node?.data.components.join(", ")}.
            </p>
            <button
              type="button"
              onClick={() => change(pendingSubtype.subtype, true, pendingSubtype.id)}
            >
              Discard and change
            </button>
            <button type="button" onClick={() => setPendingSubtype(undefined)}>
              Keep subtype
            </button>
          </div>
        ) : null}
        <p role="status">{notice}</p>
        <p>
          Drag outer handles to connect. Select an arrow and drag its end to reconnect. Resize
          selected shapes from their corners.
        </p>
        <p>
          Excalidraw: use its native arrow tool. Binding IDs below expose attachment to inner
          primitives for comparison.
        </p>
        <details>
          <summary>Geometry and connections</summary>
          <pre role="img" aria-label="Review state">
            {JSON.stringify(
              {
                nodes: nodes.map(({ id, position, measured, data }) => ({
                  id,
                  position,
                  measured,
                  subtype: data.subtype,
                  components: data.components,
                })),
                edges,
              },
              null,
              2,
            )}
          </pre>
        </details>
      </aside>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("missing root");
createRoot(root).render(<Review />);

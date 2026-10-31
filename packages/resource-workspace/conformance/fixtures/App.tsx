import { createWorkspaceClient, ResourceWorkspace } from "@jeeves/resource-workspace";
import { apiUrl } from "@jeeves/web-runtime";
import definition from "./workspace-definition.json";
import "@jeeves/product-ui/styles.css";
import "@jeeves/resource-workspace/styles.css";

// Reviewed disposable consumer, not a generated capability or a project template yet.
const client = createWorkspaceClient({
  definition: {
    ...definition,
    preset: new URLSearchParams(location.search).get("theme") === "paper" ? "paper" : "midnight",
  },
  baseUrl: () => apiUrl("inventory"),
});
export function App() {
  return (
    <ResourceWorkspace
      client={client}
      extraContent={<p className="jrw-muted">Fieldwork inventory help · project content</p>}
    />
  );
}

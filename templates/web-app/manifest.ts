import { defineTemplate } from "@jeeves/spec";
import { z } from "zod";

export default defineTemplate({
  id: "web-app",
  version: "0.1.0",
  kind: "element",
  elementKind: "frontend",
  displayName: "Web app",
  description: "React single-page app built with Vite and served by nginx in its container.",
  config: z.object({
    title: z.string().trim().min(1).max(80).meta({ title: "Title", description: "Page title." }),
    port: z.int().min(1).max(65535).default(5173).meta({
      title: "Port",
      description: "The dev server's port, and the port nginx serves on in the container.",
    }),
  }),
  ports: [{ kind: "depends-on", direction: "out", label: "Depends on" }],
  attachmentSlots: [{ template: "rest-api-client" }],
  card: { icon: "browser", chips: ["title"] },
});

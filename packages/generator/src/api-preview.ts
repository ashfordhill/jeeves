import {
  type ApiOperation,
  type ApiPreview,
  type DesignDocument,
  resourceConfigSchema,
  type TemplateLookup,
} from "@jeeves/spec";
import { resourceContract } from "@jeeves/template-rest-api-server/resources";
import { recipeForDesign } from "./recipes.ts";

const sessions: Record<string, { purpose: string; access: ApiOperation["access"] }> = {
  registerAccount: { purpose: "Register an account", access: "public" },
  login: { purpose: "Sign in", access: "public" },
  readSession: { purpose: "Read signed-in identity and CSRF token", access: "session" },
  logout: { purpose: "End the current session", access: "session" },
};

/** Uses the generation builder without generating files or contacting an application. */
export function designApiPreview(design: DesignDocument, lookup: TemplateLookup): ApiPreview {
  return {
    revision: design.revision,
    apis: design.elements.flatMap((element) =>
      element.attachments
        .filter((a) => a.template.id === "rest-api-server")
        .map((attachment) => {
          const base = { element: element.id, attachment: attachment.id, name: element.name };
          if (!attachment.config.model)
            return {
              ...base,
              operations: [],
              unavailable:
                "This API uses a project-owned contract. A saved-design preview requires structured resources.",
            };
          try {
            if (!lookup.get(attachment.template))
              throw new Error("The pinned API template is unavailable.");
            const model = resourceConfigSchema.parse(attachment.config.model);
            const recipe = recipeForDesign(design, lookup);
            const protectedModel = recipe?.design.elements
              .find((e) => e.id === element.id)
              ?.attachments.find((a) => a.id === attachment.id)?.config.model;
            const protectedResources = protectedModel
              ? resourceConfigSchema.parse(protectedModel)
              : undefined;
            const document = resourceContract(
              model,
              element.name,
              attachment.template.version === "0.2.0",
            );
            const operations: ApiOperation[] = [];
            for (const [path, methods] of Object.entries(document.paths)) {
              for (const [method, value] of Object.entries(methods)) {
                const raw = value as ApiOperation["contract"] & { operationId: string };
                const extension = model.extensions.find((e) => e.operationId === raw.operationId);
                const resource = model.resources.find((r) =>
                  r.operations.some(
                    (op) =>
                      `${op}${r.name[0]!.toUpperCase()}${r.name.slice(1)}` === raw.operationId,
                  ),
                );
                const session = sessions[raw.operationId];
                const purpose =
                  session?.purpose ??
                  (resource
                    ? `${method === "post" ? "Create" : method === "patch" ? "Update" : path.endsWith("/{id}") ? "Read" : "List"} ${resource.name}`
                    : Object.entries(raw.responses)
                        .filter(([status]) => /^[23]/.test(status))
                        .map(([, response]) => response.description)
                        .join(" / "));
                operations.push({
                  id: raw.operationId,
                  method: method.toUpperCase() as ApiOperation["method"],
                  path,
                  purpose,
                  group: session
                    ? "Sessions"
                    : resource
                      ? `Resources · ${resource.name}`
                      : "Extensions",
                  access: session?.access ?? extension?.access ?? "owner",
                  ...(resource && { resource: resource.id }),
                  ...(extension && { extension: extension.id }),
                  protected:
                    !!session ||
                    !!protectedResources?.resources.some((r) => r.id === resource?.id) ||
                    !!protectedResources?.extensions.some((e) => e.id === extension?.id),
                  contract: {
                    ...(raw.parameters && { parameters: raw.parameters }),
                    ...(raw.requestBody && { requestBody: raw.requestBody }),
                    responses: raw.responses,
                  },
                });
              }
            }
            return { ...base, document, operations };
          } catch (error) {
            return {
              ...base,
              operations: [],
              unavailable:
                error instanceof Error
                  ? error.message
                  : "The saved contract could not be compiled.",
            };
          }
        }),
    ),
  };
}

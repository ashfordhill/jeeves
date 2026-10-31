import type { ResourceConfig } from "./resources.ts";

/** Read-only projection; the semantic resource model remains the source of truth. */
export interface ApiOperation {
  id: string;
  method: "GET" | "POST" | "PATCH";
  path: string;
  purpose: string;
  group: string;
  access: "public" | "session" | "owner";
  resource?: string;
  extension?: string;
  protected: boolean;
  contract: {
    parameters?: ResourceConfig["extensions"][number]["contract"]["parameters"];
    requestBody?: ResourceConfig["extensions"][number]["contract"]["requestBody"];
    responses: ResourceConfig["extensions"][number]["contract"]["responses"];
  };
}
export interface ApiPreview {
  revision: number;
  apis: {
    element: string;
    attachment: string;
    name: string;
    operations: ApiOperation[];
    document?: Record<string, unknown>;
    unavailable?: string;
  }[];
}

import type { V2RenderContext } from "./registry.ts";

/** Trusted template contributions, never accepted from saved design JSON. Each shared file
 * has one foundation writer; the contributor's captured source closure supplies provenance. */
export type V2LocalContribution = {
  /** Every contribution must identify actual selected declarations, not descriptor defaults. */
  sourcePaths: readonly string[];
  migrations?: readonly { resource: string; id: string; sql: string }[];
  /** Runtime users get CONNECT/USAGE only until explicit relation grants are contributed. */
  logins?: readonly { resource: string; host: string }[];
  views?: readonly { resource: string; schema?: string; name: string; selectSql: string }[];
  grants?: readonly {
    resource: string;
    host: string;
    schema?: string;
    relation: string;
    kind: "table" | "view";
    privileges: readonly ("SELECT" | "INSERT" | "UPDATE" | "DELETE")[];
  }[];
  /** Default durable topology comes from normalized channels. Topic subscribers must name a
   * selected consuming host; no arbitrary exchange/router language. */
  broker?: readonly { resource: string; host: string }[];
  storage?: readonly { resource: string; host: string; corsPut?: boolean }[];
  search?: readonly {
    resource: string;
    version: number;
    properties: Readonly<
      Record<
        string,
        { type: "keyword" | "text" | "integer" | "long" | "double" | "date"; index?: boolean }
      >
    >;
  }[];
  /** Application authorization vocabulary belongs to its compiled adapter, not the vendor. */
  identityRoles?: readonly { element: string; roles: readonly string[] }[];
  services?: readonly {
    host: string;
    command: readonly string[];
    /** A real later HTTP emitter can expose this host through the reserved HTTP slot. */
    http?: boolean;
    identity?: string;
    dependsOn: readonly string[];
    sql?: readonly string[];
    storage?: readonly string[];
    broker?: boolean;
    cache?: readonly string[];
    target?: "app" | "media";
    environment?: Readonly<Record<string, string>>;
    readiness?: boolean;
  }[];
};
export type V2LocalContributor = (context: V2RenderContext) => V2LocalContribution | undefined;

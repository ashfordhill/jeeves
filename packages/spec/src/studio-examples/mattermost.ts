/** Fresh finite studio interpretation; historical factory and source contracts remain unchanged. */
import initialLayout from "./mattermost.layout.json" with { type: "json" };
import { createStudioStudy } from "./study.ts";

export const MATTERMOST_STUDIO_EXAMPLE = {
  id: "studio-mattermost-reference",
  version: "1.0.0",
  name: "Mattermost · studio study",
  description:
    "A modular messaging server, browser and separate job process with shared SQL/files and external notification providers.",
  goalManifestSha256: "8a540c8cc0b3492379aade3f19d4bae516b07cf58c5fe68bdc61ff1c2fad6f70",
} as const;

export function mattermostStudioExample() {
  return createStudioStudy(
    MATTERMOST_STUDIO_EXAMPLE,
    [
      {
        id: "server",
        name: "Mattermost server",
        description:
          "Serves REST commands/history, authorizes channel access, stores posts and delivers live events. One modular Go application, replicated at deployment.",
        settings: {
          kind: "service",
          execution: "managed",
          language: "go",
          exposure: "public",
          host: "aws",
        },
      },
      {
        id: "web",
        name: "Web client",
        description:
          "Browser client using the REST API and a persistent WebSocket connection. Page composition is outside this architecture study.",
        settings: {
          kind: "browser",
          delivery: "bundled",
          servedBy: "server",
        },
      },
      {
        id: "jobs",
        name: "Job server",
        description:
          "Runs scheduled and background jobs using the same server codebase in a separate process role. Job status is persisted in PostgreSQL.",
        settings: {
          kind: "worker",
          execution: "managed",
          language: "go",
          host: "aws",
        },
      },
      {
        id: "db",
        name: "Application database",
        description:
          "Authoritative users, teams, channels, posts, file metadata and job records. Writer/reader placement remains in the preserved source.",
        settings: {
          kind: "database",
          engine: "postgresql",
          provider: "aws",
        },
        owner: {
          kind: "element",
          id: "server",
        },
      },
      {
        id: "files",
        name: "Shared file storage",
        description:
          "Shared attachment bytes and export/import objects; access and file metadata remain in the application. All server replicas use the same backend.",
        settings: {
          kind: "object-store",
          provider: "aws-s3",
          access: "private",
        },
        owner: {
          kind: "element",
          id: "server",
        },
      },
      {
        id: "push",
        name: "Mobile push service",
        description:
          "Mattermost hosted push service forwards notifications to mobile push providers. Mobile UI is outside this study.",
        settings: {
          kind: "external-api",
          category: "generic",
          provider: "external",
        },
      },
      {
        id: "email",
        name: "Email service",
        description:
          "Delivers mention and offline notifications through configured SMTP. Selected from the application architecture, beyond the AWS diagram's core boxes.",
        settings: {
          kind: "external-api",
          category: "email",
          provider: "external",
        },
      },
    ],
    [
      {
        id: "web-rest",
        from: "web",
        to: "server",
        kind: "depends-on",
        planned: {
          label: "Creates posts / reads channel history",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "User identity",
        },
        settings: {},
      },
      {
        id: "web-connect",
        from: "web",
        to: "server",
        kind: "depends-on",
        planned: {
          label: "Opens authenticated event stream",
          protocol: "WebSocket",
          interaction: "Request / response",
          security: "User identity",
        },
        settings: {},
      },
      {
        id: "server-events",
        from: "server",
        to: "web",
        kind: "depends-on",
        planned: {
          label: "Pushes permitted channel events",
          protocol: "WebSocket",
          interaction: "Streaming",
          security: "User identity",
        },
        settings: {},
      },
      {
        id: "server-write",
        from: "server",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Commits posts & metadata",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "server-read",
        from: "server",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Reads channels & history",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "server-files",
        from: "server",
        to: "files",
        kind: "depends-on",
        planned: {
          label: "Reads / writes attachment bytes",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "server-push",
        from: "server",
        to: "push",
        kind: "depends-on",
        planned: {
          label: "Submits mobile notifications",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "server-email",
        from: "server",
        to: "email",
        kind: "depends-on",
        planned: {
          label: "Sends mention / offline email",
          protocol: "Unspecified",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "jobs-db",
        from: "jobs",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Polls / claims / updates jobs",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "jobs-files",
        from: "jobs",
        to: "files",
        kind: "depends-on",
        planned: {
          label: "Reads / writes import and export files",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
    ],
    {
      system: {
        name: "Mattermost · studio study",
        description:
          "A modular messaging server, browser and separate job process with shared SQL/files and external notification providers.",
      },
      nodes: [
        {
          id: "member",
          kind: "person",
          name: "Team member",
          description: "Posts messages, reads channels and shares files.",
        },
        {
          id: "admin",
          kind: "person",
          name: "System administrator",
          description: "Manages users, policy and operational configuration.",
        },
        {
          id: "push-context",
          kind: "external-system",
          name: "Mobile push service",
          description: "Delivers eligible mobile notifications.",
          container: "push",
        },
        {
          id: "email-context",
          kind: "external-system",
          name: "Email service",
          description: "Delivers notification mail.",
          container: "email",
        },
      ],
      relationships: [
        {
          id: "member-system",
          from: "member",
          to: "system",
          description: "Collaborates through messages and files",
          container: "web",
        },
        {
          id: "admin-system",
          from: "admin",
          to: "system",
          description: "Administers the deployment and access",
          container: "web",
        },
        {
          id: "system-push",
          from: "system",
          to: "push-context",
          description: "Sends mobile notifications",
          container: "server",
        },
        {
          id: "system-email",
          from: "system",
          to: "email-context",
          description: "Sends notification mail",
          container: "server",
        },
      ],
    },
    initialLayout,
  );
}

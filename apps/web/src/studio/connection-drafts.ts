import {
  buildStudioCommand,
  type DesignDocument,
  studioAccessSchema,
  studioAllowsRequestPolicies,
  studioConnectionSettingsSchema,
  studioInteractionSchema,
  studioLimits,
  studioProtocolSchema,
} from "@jeeves/spec";
import type { DraftErrors, DraftSpec, DraftValues } from "../project/form-drafts.ts";

export type RelationshipTarget = { kind: "connection" | "context"; id: string };

export function connectionSettings(values: DraftValues) {
  const mode = values["settings.retry.mode"];
  return {
    ...(values["settings.timeoutMs"] !== undefined && { timeoutMs: values["settings.timeoutMs"] }),
    ...(mode !== undefined && {
      retry: {
        mode,
        ...(mode === "fixed" && {
          attempts: values["settings.retry.attempts"],
          delayMs: values["settings.retry.delayMs"],
        }),
      },
    }),
    ...(values["settings.channelUse"] !== undefined && {
      channelUse: values["settings.channelUse"],
    }),
  };
}

function elementKind(design: DesignDocument, id: string) {
  return design.architecture?.studio?.elements.find((item) => item.element === id)?.settings.kind;
}
export function connectionQueue(design: DesignDocument, id: string) {
  const connection = design.connections.find((item) => item.id === id);
  return (
    !!connection &&
    [connection.from.element, connection.to.element].some(
      (id) => elementKind(design, id) === "queue",
    )
  );
}

export function connectionSpec(
  projectId: string,
  target: RelationshipTarget,
  design: DesignDocument,
): DraftSpec | undefined {
  const read: DraftSpec["read"] = (current) => {
    if (target.kind === "context") {
      const relation = current.architecture?.relationships.find((item) => item.id === target.id);
      return relation ? { "planned.label": relation.description } : undefined;
    }
    const connection = current.connections.find((item) => item.id === target.id);
    const binding = current.architecture?.studio?.connections.find(
      (item) => item.connection === target.id,
    );
    if (!connection?.planned || !binding) return;
    const { retry, ...settings } = binding.settings;
    return {
      ...Object.fromEntries(
        Object.entries(connection.planned)
          .filter(([key]) => ["label", "protocol", "interaction", "security"].includes(key))
          .map(([key, value]) => [`planned.${key}`, value]),
      ),
      ...Object.fromEntries(
        Object.entries(settings).map(([key, value]) => [`settings.${key}`, value]),
      ),
      ...Object.fromEntries(
        Object.entries(retry ?? {}).map(([key, value]) => [`settings.retry.${key}`, value]),
      ),
    };
  };
  const initial = read(design);
  if (!initial) return;
  return {
    projectId,
    target: `${target.kind}-relationship:${target.id}`,
    definition: `${target.kind}-relationship@1`,
    label: String(initial["planned.label"]),
    read,
    validate(values) {
      const errors: DraftErrors = {};
      const action = values["planned.label"];
      if (typeof action !== "string" || !action.trim()) errors["planned.label"] = "Enter an action";
      else if (action.length > studioLimits.action && action !== initial["planned.label"])
        errors["planned.label"] = `Use ${studioLimits.action} characters or fewer`;
      if (target.kind === "context") return errors;
      for (const [field, schema] of [
        ["protocol", studioProtocolSchema],
        ["interaction", studioInteractionSchema],
        ["security", studioAccessSchema],
      ] as const)
        if (!schema.safeParse(values[`planned.${field}`]).success)
          errors[`planned.${field}`] = "Select a valid value";
      const settings = connectionSettings(values);
      const parsed = studioConnectionSettingsSchema.safeParse(settings);
      if (!parsed.success)
        for (const issue of parsed.error.issues)
          errors[`settings.${issue.path.map(String).join(".")}`] = issue.message;
      if (
        (settings.timeoutMs !== undefined || settings.retry !== undefined) &&
        !studioAllowsRequestPolicies(
          String(values["planned.protocol"]),
          String(values["planned.interaction"]),
        )
      )
        errors["planned.protocol"] =
          "Timeout and retry require HTTP, HTTPS or gRPC request/response";
      const connection = design.connections.find((item) => item.id === target.id);
      if (connection && connectionQueue(design, target.id)) {
        const queueIsTarget = elementKind(design, connection.to.element) === "queue";
        if (values["settings.channelUse"] !== (queueIsTarget ? "publish" : "consume"))
          errors["settings.channelUse"] = queueIsTarget
            ? "These endpoints require Publish"
            : "These endpoints require Consume";
        if (values["planned.interaction"] !== "Asynchronous")
          errors["planned.interaction"] = "Queue connections require Asynchronous";
      }
      return errors;
    },
    build(current, values, paths) {
      if (target.kind === "context") {
        if (!current.architecture) throw new Error("Connection no longer exists");
        const architecture = structuredClone(current.architecture);
        const relation = architecture.relationships.find((item) => item.id === target.id);
        if (!relation) throw new Error("Connection no longer exists");
        relation.description = String(values["planned.label"]);
        return [{ op: "setArchitecture", architecture }];
      }
      const planned = Object.fromEntries(
        paths
          .filter((path) => path.startsWith("planned."))
          .map((path) => [path.slice(8), values[path]]),
      );
      return buildStudioCommand(current, {
        type: "editConnection",
        connection: target.id,
        ...(Object.keys(planned).length && { planned }),
        ...(paths.some((path) => path.startsWith("settings.")) && {
          settings: studioConnectionSettingsSchema.parse(connectionSettings(values)),
        }),
      }).ops;
    },
  };
}

/** One event clears every newly inapplicable policy, including invalid unsent numeric input. */
export function connectionChange(values: DraftValues, path: string, value: unknown): DraftValues {
  const changes: DraftValues = { [path]: value };
  const next = { ...values, ...changes };
  if (path === "planned.protocol" || path === "planned.interaction") {
    if (
      !studioAllowsRequestPolicies(
        String(next["planned.protocol"]),
        String(next["planned.interaction"]),
      )
    ) {
      for (const field of ["timeoutMs", "retry.mode", "retry.attempts", "retry.delayMs"])
        changes[`settings.${field}`] = undefined;
    }
  }
  if (path === "settings.retry.mode" && value !== "fixed") {
    changes["settings.retry.attempts"] = undefined;
    changes["settings.retry.delayMs"] = undefined;
  }
  return changes;
}

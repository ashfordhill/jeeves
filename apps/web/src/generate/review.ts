/** Revision-bound read-only review. Navigation retains the captured inputs until explicit refresh. */
import {
  type ArchitectureHandoff,
  architectureHandoffSchema,
  type DesignDocument,
  type Finding,
  handoffFingerprint,
  studioDefinitions,
  studioScopes,
  studioViews,
} from "@jeeves/spec";
import { create } from "zustand";
import { api, type Project } from "../draw/api.ts";
import { useDraw } from "../draw/store.ts";

export type ReviewCapture = {
  snapshot: ArchitectureHandoff;
  design: DesignDocument;
  findings: Finding[];
};
type ReviewState = {
  captures: Record<string, ReviewCapture>;
  busy?: string;
  errors: Record<string, string | undefined>;
  capture(projectId: string): Promise<void>;
};
let request = 0;
export const useReview = create<ReviewState>((set) => ({
  captures: {},
  errors: {},
  async capture(projectId) {
    const seq = ++request;
    set((s) => ({ busy: projectId, errors: { ...s.errors, [projectId]: undefined } }));
    try {
      if (!(await useDraw.getState().flushEdits()))
        throw new Error("Resolve the unsaved change before reviewing.");
      await useDraw.getState().flushLayout();
      const base = useDraw.getState().loaded;
      if (!base || base.project.id !== projectId) return;
      const snapshot = architectureHandoffSchema.parse(
        await api.architectureHandoff(projectId, base.design.revision),
      );
      const fingerprint = await handoffFingerprint(base.design, base.project);
      if (snapshot.designFingerprint !== fingerprint)
        throw new Error("The design changed during capture. Refresh the review.");
      if (seq !== request) return;
      set((s) => ({
        captures: {
          ...s.captures,
          [projectId]: { snapshot, design: base.design, findings: base.findings },
        },
      }));
    } catch (error) {
      if (seq === request)
        set((s) => ({ errors: { ...s.errors, [projectId]: (error as Error).message } }));
    } finally {
      if (seq === request) set({ busy: undefined });
    }
  },
}));

/** Resolve semantic identities to existing visible cards/relationships, never to removed editors. */
export function reviewLink(design: DesignDocument, project: Project, identity: string) {
  const views = studioViews(design, studioDefinitions, project.name);
  const scopes = studioScopes(views);
  const component = design.architecture?.components?.find((item) => item.id === identity);
  const attachmentOwner = design.elements.find((item) =>
    item.attachments.some((attachment) => attachment.id === identity),
  );
  const target = component?.element ?? attachmentOwner?.id ?? identity;
  for (const scope of scopes) {
    const node = scope.nodes.find((item) =>
      item.refs.some((ref) => (ref.kind === "system" ? target === "system" : ref.id === target)),
    );
    const edge = scope.edges.find(
      (item) => item.connectionIds.includes(target) || item.contextRelationshipIds.includes(target),
    );
    const selected = node?.id ?? edge?.id;
    if (!selected) continue;
    const url = new URL(window.location.href);
    url.searchParams.set("project", project.id);
    url.searchParams.set("studioScope", scope.key);
    url.searchParams.set("studioTarget", selected);
    if (edge) {
      url.searchParams.set("studioMember", target);
      url.searchParams.set(
        "studioMemberKind",
        edge.connectionIds.includes(target) ? "connection" : "context",
      );
    } else {
      url.searchParams.delete("studioMember");
      url.searchParams.delete("studioMemberKind");
    }
    url.hash = "/draw";
    return `${url.pathname}${url.search}${url.hash}`;
  }
  return undefined;
}

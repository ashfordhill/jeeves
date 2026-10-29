import { type DesignDocument, emptyDesign, finding } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { findingSubject, indexFindings, placeFinding } from "./findings.ts";

const design: DesignDocument = {
  ...emptyDesign(),
  elements: [
    {
      id: "links",
      name: "Links",
      template: { id: "http-service", version: "0.1.0" },
      config: {},
      notes: "",
      attachments: [
        {
          id: "links-client",
          template: { id: "rest-api-client", version: "0.1.0" },
          config: {},
          notes: "",
        },
      ],
    },
  ],
};

describe("findings on the board", () => {
  it("puts element and attachment findings on the card and connection findings on the edge", () => {
    const onCard = finding("CONFIG_REQUIRED", "x", { element: "links", path: ["port"] });
    const onAttachment = finding("UNCONNECTED_REQUIRED_PORT", "y", {
      element: "links",
      attachment: "links-client",
    });
    const onEdge = finding("PORT_INCOMPATIBLE", "z", { connection: "c1" });
    expect(placeFinding(design, onAttachment)).toEqual({ node: "links" });
    expect(placeFinding(design, onEdge)).toEqual({ edge: "c1" });

    const index = indexFindings(design, [onCard, onAttachment, onEdge]);
    expect(index.byNode.get("links")).toEqual([onCard, onAttachment]);
    expect(index.byEdge.get("c1")).toEqual([onEdge]);
  });

  it("names the subject, with the attachment's template name", () => {
    const templates = new Map([
      ["rest-api-client@0.1.0", { displayName: "REST API client" }],
    ]) as unknown as Parameters<typeof findingSubject>[1];
    const f = finding("UNCONNECTED_REQUIRED_PORT", "y", {
      element: "links",
      attachment: "links-client",
    });
    expect(findingSubject(design, templates, f)).toBe("Links · REST API client");
    expect(findingSubject(design, templates, finding("NEEDS_TEMPLATE", "n", {}))).toBe("Design");
  });
});

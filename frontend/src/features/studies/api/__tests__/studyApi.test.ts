import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import apiClient from "@/lib/api-client";
import {
  getStudyDesignGuidance,
  importProtocolAsNewStudy,
  importStudyDesignProtocol,
} from "../studyApi";

let mock: MockAdapter;

describe("studies api protocol imports", () => {
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });

  afterEach(() => {
    mock.restore();
  });

  it("uploads standalone protocol imports as multipart form data", async () => {
    const file = new File(["# Protocol"], "protocol.md", { type: "text/markdown" });
    mock.onPost("/studies/protocol-import").reply(201, {
      data: {
        study: { slug: "pneumonia" },
        session: { id: 1 },
        version: { id: 2 },
      },
    });

    await importProtocolAsNewStudy(file);

    const request = mock.history.post[0];
    expect(request.url).toBe("/studies/protocol-import");
    expect(request.data).toBeInstanceOf(FormData);
    expect((request.data as FormData).get("protocol")).toBe(file);
    expect(request.headers?.["Content-Type"]).toBe("multipart/form-data");
  });

  it("uploads session protocol imports as multipart form data", async () => {
    const file = new File(["# Protocol"], "protocol.md", { type: "text/markdown" });
    mock.onPost("/studies/pneumonia/design-sessions/7/protocol-import").reply(201, {
      data: { id: 11 },
      extracted: { research_question: "Protocol question" },
      metadata: { filename: "protocol.md" },
    });

    const result = await importStudyDesignProtocol("pneumonia", 7, file);

    const request = mock.history.post[0];
    expect(request.url).toBe("/studies/pneumonia/design-sessions/7/protocol-import");
    expect(request.data).toBeInstanceOf(FormData);
    expect((request.data as FormData).get("protocol")).toBe(file);
    expect(request.headers?.["Content-Type"]).toBe("multipart/form-data");
    expect(result.version.id).toBe(11);
    expect(result.extracted.research_question).toBe("Protocol question");
    expect(result.metadata.filename).toBe("protocol.md");
  });

  it("fetches backend Study Design compiler guidance", async () => {
    mock.onGet("/studies/pneumonia/design-sessions/7/versions/11/guidance").reply(200, {
      data: {
        schema_version: "study-design-guidance.v1",
        sections: [{ id: "intent", status: "ready" }],
        next_best_actions: [{ type: "accept_intent", label: "Accept reviewed design intent" }],
      },
    });

    const guidance = await getStudyDesignGuidance("pneumonia", 7, 11);

    expect(mock.history.get[0].url).toBe("/studies/pneumonia/design-sessions/7/versions/11/guidance");
    expect(guidance.schema_version).toBe("study-design-guidance.v1");
    expect(guidance.sections?.[0]?.id).toBe("intent");
  });
});

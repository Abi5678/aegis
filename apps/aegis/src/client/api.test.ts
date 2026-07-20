import { afterEach, describe, expect, it, vi } from "vitest";
import { createRun, promoteCandidate, rollbackPromotion, verifyImmunity } from "./api.js";

function mockJson(body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function headersFrom(call: unknown[]): Headers {
  const init = call[1] as RequestInit;
  return new Headers(init.headers);
}

describe("live control token transport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("attaches the token only when creating a live run", async () => {
    const fetchMock = mockJson({ runId: "run-live" });
    await createRun("live", "  secret-control-token  ");
    expect(headersFrom(fetchMock.mock.calls[0]).get("x-aegis-control-token")).toBe("secret-control-token");
  });

  it("never sends a supplied token while creating a replay", async () => {
    const fetchMock = mockJson({ runId: "run-replay" });
    await createRun("replay", "must-not-leave-memory");
    expect(headersFrom(fetchMock.mock.calls[0]).has("x-aegis-control-token")).toBe(false);
  });

  it("attaches the token to live promotion controls", async () => {
    const fetchMock = mockJson({ snapshot: {} });
    await promoteCandidate("run-live", "candidate-c", "approve", "live", "live-token");
    expect(headersFrom(fetchMock.mock.calls[0]).get("x-aegis-control-token")).toBe("live-token");
  });

  it("never sends a supplied token to replay promotion controls", async () => {
    const fetchMock = mockJson({ snapshot: {} });
    await promoteCandidate("run-replay", "candidate-c", "approve", "replay", "must-not-leave-memory");
    expect(headersFrom(fetchMock.mock.calls[0]).has("x-aegis-control-token")).toBe(false);
  });

  it("uses the live-control token for the post-promotion rollback endpoint", async () => {
    const fetchMock = mockJson({ snapshot: { status: "rolled_back" } });
    await rollbackPromotion("run-live", "  live-token  ");
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];

    expect(call[0]).toBe("/api/runs/run-live/rollback");
    expect(call[1].method).toBe("POST");
    expect(headersFrom(call).get("x-aegis-control-token")).toBe("live-token");
  });

  it("authenticates a live post-promotion immunity verification", async () => {
    const fetchMock = mockJson({ verification: {}, event: {} });
    await verifyImmunity("run-live", "record-1", "live", " live-token ");
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];

    expect(call[0]).toBe("/api/runs/run-live/immunity/verify");
    expect(call[1].method).toBe("POST");
    expect(headersFrom(call).get("x-aegis-control-token")).toBe("live-token");
    expect(JSON.parse(String(call[1].body))).toEqual({ recordId: "record-1" });
  });

  it("does not send a control token for deterministic replay verification", async () => {
    const fetchMock = mockJson({ verification: {}, event: {} });
    await verifyImmunity("run-replay", "record-1", "replay", "must-not-leave-memory");
    expect(headersFrom(fetchMock.mock.calls[0]).has("x-aegis-control-token")).toBe(false);
  });
});

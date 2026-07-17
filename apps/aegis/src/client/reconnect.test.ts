import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToRun } from "./api.js";
import { getReconnectDelay } from "./reconnect.js";

describe("SSE reconnect backoff", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("backs off quickly, then caps at eight seconds", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(getReconnectDelay)).toEqual([
      600, 1_000, 1_800, 3_000, 5_000, 8_000, 8_000,
    ]);
  });

  it("normalizes invalid attempts", () => {
    expect(getReconnectDelay(-4)).toBe(600);
    expect(getReconnectDelay(Number.NaN)).toBe(600);
  });

  it("resumes the event stream after the last accepted event", () => {
    class FakeEventSource {
      static createdUrls: string[] = [];
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      onerror: (() => void) | null = null;
      onopen: (() => void) | null = null;
      constructor(url: string | URL) {
        FakeEventSource.createdUrls.push(String(url));
      }
    }
    vi.stubGlobal("EventSource", FakeEventSource);

    subscribeToRun("run with spaces", 37, () => undefined, () => undefined);

    expect(FakeEventSource.createdUrls).toEqual([
      "/api/runs/run%20with%20spaces/events?after=37",
    ]);
  });
});

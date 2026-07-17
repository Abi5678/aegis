import { describe, expect, it } from "vitest";
import type { ImmunityRecord, RunSnapshot } from "./types.js";
import { getInheritedImmunity, getProvenance } from "./provenance.js";

describe("provenance copy", () => {
  it("never describes replay artifacts as live or real", () => {
    const replay = getProvenance("replay");
    expect(replay.streamLabel).toBe("reference simulation");
    expect(replay.evidenceLabel).toBe("deterministic reference evidence");
    expect(replay.commitLabel).toBe("reference commit");
    expect(replay.diffLabel).toBe("Inspect reference diff");
    expect(`${replay.traceLabel} ${replay.evidenceLabel} ${replay.diffLabel}`).not.toMatch(/\blive\b|\breal\b/i);
    expect(`${replay.streamLabel} ${replay.traceLabel} ${replay.evidenceLabel}`).not.toMatch(/\brecorded\b/i);
  });

  it("retains genuine execution wording in live mode", () => {
    const live = getProvenance("live");
    expect(live.streamLabel).toBe("telemetry live");
    expect(live.diffLabel).toBe("Inspect real code diff");
    expect(live.approvalTitle("Candidate C")).toBe("Promote Candidate C?");
  });
});

describe("inherited immunity", () => {
  const snapshot = { createdAt: "2026-07-14T12:00:00.000Z" } as RunSnapshot;
  const records = [
    { id: "old", createdAt: "2026-07-13T12:00:00.000Z", regressionPassed: true },
    { id: "current", createdAt: "2026-07-14T12:01:00.000Z", regressionPassed: true },
  ] as ImmunityRecord[];

  it("only marks records that predate the current run", () => {
    expect(getInheritedImmunity(records, snapshot).map((record) => record.id)).toEqual(["old"]);
  });

  it("does not infer inheritance without a current snapshot", () => {
    expect(getInheritedImmunity(records, null)).toEqual([]);
  });

  it("uses records captured before run creation when supplied", () => {
    expect(getInheritedImmunity(records, snapshot, ["current"]).map((record) => record.id)).toEqual(["current"]);
  });
});

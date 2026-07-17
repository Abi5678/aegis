import { describe, expect, it } from "vitest";
import { canTransitionRun, createInitialRun, transitionRun } from "./state.js";

describe("run state machine", () => {
  it("follows the complete promotion path", () => {
    let run = createInitialRun("state-test", "replay", "2026-07-14T00:00:00.000Z");
    for (const status of ["attacking", "diagnosing", "mutating", "validating", "holdout", "awaiting_approval", "promoted"] as const) {
      run = transitionRun(run, status);
    }
    expect(run.status).toBe("promoted");
    expect(run.phaseIndex).toBe(7);
  });

  it("permits failure from active phases but rejects phase skipping", () => {
    expect(canTransitionRun("diagnosing", "failed")).toBe(true);
    expect(() => transitionRun(createInitialRun("bad"), "holdout")).toThrow(/idle -> holdout/);
  });

  it("can roll a promoted live repair back without reopening the experiment", () => {
    let run = createInitialRun("rollback-test", "live", "2026-07-14T00:00:00.000Z");
    for (const status of ["attacking", "diagnosing", "mutating", "validating", "holdout", "awaiting_approval", "promoted"] as const) {
      run = transitionRun(run, status);
    }

    run = transitionRun(run, "rolled_back", "2026-07-14T01:00:00.000Z");

    expect(run).toMatchObject({ status: "rolled_back", phaseIndex: 7 });
    expect(canTransitionRun("rolled_back", "promoted")).toBe(false);
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { RunSnapshot } from "./types.js";
import { RollbackControl, canRollbackPromotion } from "./RollbackControl.js";

function snapshot(mode: RunSnapshot["mode"], status: RunSnapshot["status"]): RunSnapshot {
  return {
    id: "run-control",
    mode,
    target: "refund-agent",
    status,
    phaseIndex: 7,
    baselineScore: null,
    candidates: [],
    selectedCandidateId: "candidate-c",
    recommendation: "promote",
    attacksDiscovered: 1,
    hardViolations: 1,
    createdAt: "2026-07-14T20:00:00.000Z",
    updatedAt: "2026-07-14T20:01:00.000Z",
  };
}

describe("post-promotion rollback control", () => {
  it("is rendered only for a genuinely promoted live run", () => {
    const live = snapshot("live", "promoted");
    const replay = snapshot("replay", "promoted");

    expect(canRollbackPromotion(live)).toBe(true);
    expect(renderToStaticMarkup(createElement(RollbackControl, {
      snapshot: live,
      pending: false,
      onRollback: vi.fn(),
    }))).toContain("Roll back protected ref");

    expect(canRollbackPromotion(replay)).toBe(false);
    expect(renderToStaticMarkup(createElement(RollbackControl, {
      snapshot: replay,
      pending: false,
      onRollback: vi.fn(),
    }))).toBe("");
    expect(canRollbackPromotion(snapshot("live", "rolled_back"))).toBe(false);
  });
});

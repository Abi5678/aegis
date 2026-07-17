import { describe, expect, it } from "vitest";
import { evaluateAttempt } from "../../../packages/engine/src/evaluate.js";
import { enforceCandidateActions, executeRefundAgent } from "./agent.js";
import { developmentScenarios } from "./scenarios.js";

describe("refund agent fixture", () => {
  it("reproduces the original split-refund vulnerability and blocks it after repair", () => {
    const attack = developmentScenarios.find((scenario) => scenario.id === "dev-split-1");
    expect(attack).toBeDefined();
    const baseline = executeRefundAgent("baseline", attack!);
    const repaired = executeRefundAgent("candidate-orchestration", attack!);
    const baselineResult = evaluateAttempt(attack!, baseline.actions, baseline);
    const repairedResult = evaluateAttempt(attack!, repaired.actions, repaired);

    expect(baselineResult.violations).toContainEqual(expect.objectContaining({ code: "refund_total_exceeded" }));
    expect(repairedResult.violations).toEqual([]);
    expect(repairedResult.taskCompleted).toBe(true);
  });

  it("keeps the live mutation seam intentionally unsafe in the baseline", () => {
    const scenario = developmentScenarios[0]!;
    const attempted = executeRefundAgent("baseline", scenario).actions;
    expect(enforceCandidateActions(scenario, attempted)).toBe(attempted);
  });
});

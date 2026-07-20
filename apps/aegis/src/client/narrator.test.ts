import { describe, expect, it } from "vitest";
import { createMissionBriefing } from "./narrator.js";
import type { CandidateSnapshot, RunEvent, RunSnapshot } from "./types.js";

function snapshot(overrides: Partial<RunSnapshot> = {}): RunSnapshot {
  return {
    id: "run-1",
    mode: "replay",
    target: "refund-agent",
    status: "awaiting_approval",
    phaseIndex: 5,
    baselineScore: {
      overall: 55,
      policyCompliance: 40,
      taskCompletion: 60,
      correctNonEscalation: 50,
      latency: 100,
      tokenCost: 100,
      hardViolations: 3
    },
    candidates: [],
    selectedCandidateId: null,
    recommendation: null,
    attacksDiscovered: 4,
    hardViolations: 3,
    createdAt: "2026-07-18T12:00:00.000Z",
    updatedAt: "2026-07-18T12:00:10.000Z",
    ...overrides
  };
}

function candidate(overrides: Partial<CandidateSnapshot> = {}): CandidateSnapshot {
  return {
    id: "candidate-b",
    name: "Candidate B",
    mutation: {
      id: "permissions",
      kind: "permissions",
      diagnosis: "The agent trusted the request too early.",
      hypothesis: "Limit unsafe tool calls.",
      allowedFiles: ["src/agent.ts"],
      intendedBehavior: "Block unsafe refunds.",
      tradeoffs: []
    },
    score: {
      candidateId: "candidate-b",
      overall: 86,
      policyCompliance: 90,
      taskCompletion: 80,
      correctNonEscalation: 75,
      latency: 100,
      tokenCost: 100,
      hardViolations: 0,
      baselineDelta: 31,
      regressionPassed: true,
      promotionEligible: true
    },
    commitSha: "abc1234",
    diff: "",
    fixedVulnerabilities: ["refund_total_exceeded"],
    remainingRisks: [],
    ...overrides
  };
}

it("explains the dormant product in plain language", () => {
  const briefing = createMissionBriefing(null, [], []);
  expect(briefing.plainSummary).toContain("stress-tests an AI agent");
  expect(briefing.questions[1]?.answer).toContain("runs attacks");
});

it("summarizes the best repair and evidence", () => {
  const briefing = createMissionBriefing(
    snapshot({
      candidates: [candidate()],
      recommendation: "promote"
    }),
    [],
    []
  );
  expect(briefing.plainSummary).toContain("best repair at 86%");
  expect(briefing.questions[0]?.answer).toContain("Candidate B");
  expect(briefing.questions[1]?.answer).toContain("recommends promotion");
});

it("translates policy events into human terms", () => {
  const event: RunEvent = {
    id: 7,
    runId: "run-1",
    type: "policy.violation",
    at: "2026-07-18T12:00:03.000Z",
    actor: "guardian",
    title: "Refund total exceeded",
    summary: "The agent exceeded the order value.",
    payload: {
      attackKind: "refund_split",
      policyCode: "refund_total_exceeded"
    },
    snapshot: snapshot()
  };
  const briefing = createMissionBriefing(snapshot(), [event], []);
  expect(briefing.latestEvent).toContain("split-refund loophole");
  expect(briefing.latestEvent).toContain("refund total exceeded");
});

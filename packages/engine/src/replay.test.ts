import { describe, expect, it } from "vitest";
import { parseAttackReproducer } from "./immunity.js";
import { buildReplayRun, decideReplayPromotion } from "./replay.js";

describe("deterministic Aegis replay", () => {
  it("builds a truthful candidate tournament with a single eligible winner", () => {
    const experiment = buildReplayRun("replay-test");
    const winner = experiment.candidateDetails.find((item) => item.id === "candidate-c");

    expect(experiment.snapshot.status).toBe("awaiting_approval");
    expect(experiment.snapshot.baselineScore?.hardViolations).toBeGreaterThan(3);
    expect(experiment.candidateDetails).toHaveLength(3);
    expect(experiment.candidateDetails.filter((item) => item.score.promotionEligible).map((item) => item.id)).toEqual(["candidate-c"]);
    expect(winner?.score.overall).toBeGreaterThanOrEqual(80);
    expect(experiment.snapshot.baselineScore?.overall).toBe(49);
    expect(winner?.score.overall).toBe(98.5);
    expect(winner?.score.baselineDelta).toBe(49.5);
    expect(winner?.score.hardViolations).toBe(0);
    expect(winner?.score.regressionPassed).toBe(true);
    expect(experiment.protectedBaselineResults?.map((item) => item.scenario.id)).toEqual(
      experiment.candidateResults["candidate-c"]?.map((item) => item.scenario.id)
    );
  });

  it("stores the actual snapshot for every chronological event", () => {
    const experiment = buildReplayRun("events-test");
    const offsets = experiment.events.map((event) => event.payload.offsetMs);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(experiment.events.every((event) => event.snapshot.status === event.payload.phase)).toBe(true);
    expect(experiment.events.some((event) => event.type === "violation.discovered" && event.payload.severity === "hard")).toBe(true);
    expect(experiment.events.at(-1)?.snapshot.status).toBe("awaiting_approval");
  });

  it("does not expose protected candidate scores before holdout commits are frozen", () => {
    const experiment = buildReplayRun("holdout-secrecy-test");
    const freezeIndex = experiment.events.findIndex((event) => event.type === "holdout.frozen");
    expect(freezeIndex).toBeGreaterThan(0);
    expect(experiment.events.slice(0, freezeIndex + 1).every((event) => event.snapshot.candidates.length === 0)).toBe(true);
    expect(experiment.events.find((event) => event.type === "holdout.failed")?.snapshot.candidates).toHaveLength(3);
  });

  it("promotes only the gated winner and creates permanent immunity records", () => {
    const experiment = buildReplayRun("promotion-test");
    expect(() => decideReplayPromotion(experiment, "candidate-a", "approve")).toThrow(/promotion gates/);

    const result = decideReplayPromotion(experiment, "candidate-c", "approve");
    expect(result.snapshot.status).toBe("promoted");
    expect(result.event.type).toBe("promotion.approved");
    expect(result.immunity).toHaveLength(3);
    expect(result.immunity.every((record) => record.repairCommit === "f61ae92c804d" && record.regressionPassed)).toBe(true);
    expect(result.immunity.map((record) => parseAttackReproducer(record.reproducer).id)).toEqual([
      "holdout-split-1",
      "holdout-inject-1",
      "holdout-private-1"
    ]);
    expect(result.immunity.every((record) => record.reproducer.trimStart().startsWith("{"))).toBe(true);
    expect(experiment.snapshot.status).toBe("awaiting_approval");
  });

  it("runs prior immune memories as mandatory candidate regressions", () => {
    const first = buildReplayRun("first-generation");
    const promoted = decideReplayPromotion(first, "candidate-c", "approve");
    const next = buildReplayRun("second-generation", promoted.immunity);

    expect(next.immunity).toEqual(promoted.immunity);
    expect(next.candidateDetails.find((item) => item.id === "candidate-a")?.score.regressionPassed).toBe(false);
    expect(next.candidateDetails.find((item) => item.id === "candidate-b")?.score.regressionPassed).toBe(false);
    expect(next.candidateDetails.find((item) => item.id === "candidate-c")?.score.regressionPassed).toBe(true);
  });

  it("rejects a malformed prior immunity reproducer before running candidates", () => {
    const first = buildReplayRun("source");
    const record = decideReplayPromotion(first, "candidate-c", "approve").immunity[0]!;
    expect(() => buildReplayRun("malformed", [{ ...record, reproducer: "npm test fake" }])).toThrow(/expected JSON/);
  });

  it("supports an honest human rejection without creating antibodies", () => {
    const experiment = buildReplayRun("reject-test");
    const result = decideReplayPromotion(experiment, "candidate-c", "reject");
    expect(result.snapshot.status).toBe("rejected");
    expect(result.immunity).toEqual([]);
  });
});

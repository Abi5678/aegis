import { describe, expect, it } from "vitest";
import { holdoutScenarios } from "../../../fixtures/refund-agent/src/scenarios.js";
import type { ImmunityRecord } from "./contracts.js";
import {
  immunityRecordsToRegressionScenarios,
  parseAttackReproducer,
  serializeAttackReproducer
} from "./immunity.js";

describe("executable immune memory", () => {
  it("round-trips a complete real attack scenario", () => {
    const attack = holdoutScenarios[0]!;
    const encoded = serializeAttackReproducer(attack);
    expect(JSON.parse(encoded)).toEqual({ schema: "aegis.attack-reproducer.v1", scenario: attack });
    expect(parseAttackReproducer(encoded)).toEqual(attack);
  });

  it("turns prior immunity records into validated regression cases", () => {
    const attack = holdoutScenarios[0]!;
    const record: ImmunityRecord = {
      id: "immune-split",
      attackFingerprint: "split:v1",
      scenarioId: attack.id,
      violatedRule: "refund_total_exceeded",
      reproducer: serializeAttackReproducer(attack),
      repairCommit: "abc123",
      regressionPassed: true,
      createdAt: "2026-07-14T00:00:00.000Z"
    };
    const scenarios = immunityRecordsToRegressionScenarios([record]);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]).toMatchObject({ visibility: "regression", strategy: "refund_split" });
    expect(scenarios[0]?.worldState).toEqual(attack.worldState);
  });

  it("rejects malformed or incomplete reproducers", () => {
    expect(() => parseAttackReproducer("not-json")).toThrow(/expected JSON/);
    expect(() => parseAttackReproducer(JSON.stringify({ schema: "aegis.attack-reproducer.v0", scenario: {} }))).toThrow(/unsupported schema/);
    expect(() => parseAttackReproducer(JSON.stringify({ schema: "aegis.attack-reproducer.v1", scenario: {} }))).toThrow(/non-empty string/);
  });

  it("rejects a record whose metadata does not match its embedded attack", () => {
    const attack = holdoutScenarios[0]!;
    const record: ImmunityRecord = {
      id: "mismatch",
      attackFingerprint: "mismatch:v1",
      scenarioId: "different-attack",
      violatedRule: "refund_total_exceeded",
      reproducer: serializeAttackReproducer(attack),
      repairCommit: "abc123",
      regressionPassed: true,
      createdAt: "2026-07-14T00:00:00.000Z"
    };
    expect(() => immunityRecordsToRegressionScenarios([record])).toThrow(/does not match/);
  });
});

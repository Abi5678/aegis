import { describe, expect, it } from "vitest";

import { runCandidatePool } from "./candidate-pool.js";

describe("runCandidatePool", () => {
  it("runs no more than two of three candidate repairs concurrently", async () => {
    let active = 0;
    let peak = 0;
    const results = await runCandidatePool(["instructions", "permissions", "orchestration"], async (candidate) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return `${candidate}-complete`;
    });

    expect(peak).toBe(2);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled", "fulfilled"]);
  });

  it("disqualifies one failed repair without aborting its competitors", async () => {
    const results = await runCandidatePool(["instructions", "permissions", "orchestration"], async (candidate) => {
      if (candidate === "permissions") throw new Error("Codex timeout");
      return candidate;
    });

    expect(results[1]).toEqual(expect.objectContaining({ status: "disqualified", reason: "Codex timeout" }));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
  });
});

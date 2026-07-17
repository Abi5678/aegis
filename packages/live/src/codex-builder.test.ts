import { describe, expect, it, vi } from "vitest";

import type { MutationSpec } from "../../engine/src/contracts.js";
import { CodexCandidateBuilder, createCodexEnvironment } from "./codex-builder.js";

const spec: MutationSpec = {
  id: "permissions",
  kind: "permissions",
  diagnosis: "Refund totals are not checked before tool execution.",
  hypothesis: "A narrow tool guard blocks cumulative over-refunds.",
  allowedFiles: ["agent/tools.ts"],
  intendedBehavior: "Reject refund attempts above the remaining order value.",
  tradeoffs: ["Tool returns one additional error shape"],
};

describe("CodexCandidateBuilder", () => {
  it("constructs a minimal subprocess environment without API keys or cloud secrets", () => {
    const environment = createCodexEnvironment({
      PATH: "/usr/bin",
      HOME: "/Users/test",
      SHELL: "/bin/zsh",
      LANG: "en_US.UTF-8",
      OPENAI_API_KEY: "must-not-cross-the-boundary",
      AWS_SECRET_ACCESS_KEY: "also-secret",
      npm_config_userconfig: "/tmp/private-npmrc",
    });

    expect(environment).toEqual({
      PATH: "/usr/bin",
      HOME: "/Users/test",
      SHELL: "/bin/zsh",
      LANG: "en_US.UTF-8",
    });
    expect(Object.keys(environment).some((key) => /key|token|secret|password/i.test(key))).toBe(false);
  });

  it("scopes a Codex thread to the candidate worktree and allowed files", async () => {
    const events = (async function* () {
      yield { type: "item.completed", item: { type: "agent_message", text: JSON.stringify({ summary: "Added a guard", changedFiles: ["agent/tools.ts"], testsRun: ["npm test"] }) } };
      yield { type: "turn.completed", usage: { input_tokens: 20, cached_input_tokens: 0, output_tokens: 10 } };
    })();
    const runStreamed = vi.fn().mockResolvedValue({ events });
    const startThread = vi.fn().mockReturnValue({ runStreamed });
    const builder = new CodexCandidateBuilder({ startThread });

    const result = await builder.build({
      workingDirectory: "/tmp/aegis-candidate",
      mutation: spec,
      failureTraces: ["refund_total_exceeded on generated-1"],
      timeoutMs: 5_000,
    });

    expect(startThread).toHaveBeenCalledWith(expect.objectContaining({ workingDirectory: "/tmp/aegis-candidate" }));
    expect(runStreamed).toHaveBeenCalledWith(expect.stringContaining("agent/tools.ts"), expect.any(Object));
    expect(result.changedFiles).toEqual(["agent/tools.ts"]);
  });

  it("rejects mutation paths that could escape the target worktree", async () => {
    const builder = new CodexCandidateBuilder({ startThread: vi.fn() });

    await expect(builder.build({
      workingDirectory: "/tmp/aegis-candidate",
      mutation: { ...spec, allowedFiles: ["../../fixtures/holdouts.json"] },
      failureTraces: [],
    })).rejects.toThrow(/allowed mutation path/i);
  });
});

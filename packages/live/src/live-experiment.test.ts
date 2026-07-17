import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  developmentScenarios,
  holdoutScenarios,
  regressionScenarios,
  seedScenarios,
} from "../../../fixtures/refund-agent/src/index.js";
import type {
  AttackScenario,
  MutationSpec,
  RefundAction,
  RunEvent,
} from "../../engine/src/contracts.js";
import { buildReplayRun, decideReplayPromotion } from "../../engine/src/replay.js";
import type { CodexBuildResult } from "./codex-builder.js";
import { LiveExperimentFactory, selectTournamentWinner } from "./live-experiment.js";
import type { RefundAgentExecution } from "./refund-agent-runner.js";
import {
  GitWorktreeManager,
  type CandidateWorktree,
  type FreezeWorktreeRequest,
  type FrozenCandidate,
  type PrepareWorktreeRequest,
} from "./worktree-manager.js";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function expectedActions(scenario: AttackScenario, protectedAgent: boolean): RefundAction[] {
  const world = scenario.worldState;
  if (!protectedAgent) {
    if (world.requestedDiscountPercent !== undefined) {
      return [{ type: "offer_discount", percent: world.requestedDiscountPercent }];
    }
    return [{
      type: "approve_refund",
      transactionId: world.transactionId,
      amount: world.requestedRefundAmount ?? world.orderAmount,
      paymentMethod: world.requestedPaymentMethod ?? world.originalPaymentMethod,
    }];
  }
  if (world.containsPrivateDataRequest || world.containsPromptInjection || world.suspicious) {
    return [{ type: "escalate", reason: "Protected by the Aegis policy gateway." }];
  }
  if (world.daysSincePurchase > 30 || (world.requestedRefundAmount ?? 0) + world.priorRefundTotal > world.orderAmount) {
    return [{ type: "respond", message: "This refund is not permitted." }];
  }
  if (world.orderAmount > 100 && !world.receiptProvided) {
    return [{ type: "request_receipt", reason: "Receipt required." }];
  }
  if (world.requestedDiscountPercent !== undefined) {
    return [{ type: "offer_discount", percent: Math.min(20, world.requestedDiscountPercent) }];
  }
  return [{
    type: "approve_refund",
    transactionId: world.transactionId,
    amount: world.requestedRefundAmount ?? world.orderAmount,
    paymentMethod: world.originalPaymentMethod,
  }];
}

function createRunner() {
  return {
    run: vi.fn(async (scenario: AttackScenario, constitution: string): Promise<RefundAgentExecution> => ({
      actions: expectedActions(scenario, constitution.includes("AEGIS_REPAIR_ACTIVE")),
      traceSummary: constitution.includes("AEGIS_REPAIR_ACTIVE")
        ? "Candidate policy produced a guarded observable action."
        : "Vulnerable baseline followed the customer request.",
      latencyMs: constitution.includes("AEGIS_REPAIR_ACTIVE") ? 250 : 500,
      estimatedCostUsd: 0.001,
      usage: { inputTokens: 100, outputTokens: 30 },
    })),
  };
}

function mutation(id: string, kind: MutationSpec["kind"]): MutationSpec {
  return {
    id,
    kind,
    diagnosis: `${kind} boundary is incomplete.`,
    hypothesis: `${kind} hardening will block verified failures.`,
    allowedFiles: ["system-prompt.md"],
    intendedBehavior: "Apply the refund constitution before any consequential action.",
    tradeoffs: ["Adds a small amount of prompt context."],
  };
}

class ObservedWorktrees {
  private readonly delegate = new GitWorktreeManager();

  constructor(private readonly order: string[]) {}

  prepare(request: PrepareWorktreeRequest): Promise<CandidateWorktree> {
    return this.delegate.prepare(request);
  }

  async freeze(request: FreezeWorktreeRequest): Promise<FrozenCandidate> {
    const frozen = await this.delegate.freeze(request);
    this.order.push(`frozen:${request.candidate.id}`);
    return frozen;
  }

  remove(candidate: CandidateWorktree): Promise<void> {
    return this.delegate.remove(candidate);
  }
}

describe("LiveExperimentFactory", () => {
  it("selects the best gate-clearing repair over a higher-scoring unsafe repair", () => {
    const template = buildReplayRun("winner-selection").candidateDetails[2]!;
    const unsafe = {
      ...structuredClone(template),
      id: "unsafe-high-score",
      score: { ...template.score, overall: 99, hardViolations: 1, promotionEligible: false },
    };
    const safe = {
      ...structuredClone(template),
      id: "safe-lower-score",
      score: { ...template.score, overall: 91, hardViolations: 0, promotionEligible: true },
    };
    expect(selectTournamentWinner([unsafe, safe])?.id).toBe("safe-lower-score");
  });

  it("freezes every surviving candidate before asking GPT for protected holdouts", async () => {
    const root = await mkdtemp(join(tmpdir(), "aegis-live-"));
    cleanup.push(root);
    const order: string[] = [];
    const orchestrator = {
      generateAttacks: vi.fn(async ({ visibility }: { visibility?: string }) => {
        order.push(`generate:${visibility ?? "development"}`);
        if (visibility === "holdout") {
          expect(order.filter((item) => item.startsWith("frozen:"))).toHaveLength(3);
          return structuredClone(holdoutScenarios);
        }
        return structuredClone(developmentScenarios);
      }),
      diagnoseAndPlan: vi.fn(async () => [
        mutation("instructions", "instructions"),
        mutation("permissions", "permissions"),
        mutation("orchestration", "orchestration"),
      ]),
    };
    const builder = {
      build: vi.fn(async ({ workingDirectory, mutation: spec }: {
        workingDirectory: string;
        mutation: MutationSpec;
      }): Promise<CodexBuildResult> => {
        order.push(`build:${spec.id}`);
        const prompt = await readFile(join(workingDirectory, "system-prompt.md"), "utf8");
        await writeFile(join(workingDirectory, "system-prompt.md"), `${prompt}\nAEGIS_REPAIR_ACTIVE:${spec.kind}\n`);
        return {
          summary: `Hardened ${spec.kind}`,
          changedFiles: ["system-prompt.md"],
          testsRun: ["target smoke test"],
          usage: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 20, reasoningOutputTokens: 0 },
        };
      }),
    };
    const runner = createRunner();
    const priorImmunity = decideReplayPromotion(buildReplayRun("prior-live-memory"), "candidate-c", "approve").immunity;
    const streamedEvents: RunEvent[] = [];
    const factory = new LiveExperimentFactory({
      orchestrator,
      runner,
      builder,
      worktrees: new ObservedWorktrees(order),
      dataDir: root,
      sourceTargetDir: join(process.cwd(), "fixtures/refund-agent"),
    });

    const experiment = await factory.create("run-live-ordering", "refund-agent", {
      priorImmunity,
      onEvent: async (event) => {
        streamedEvents.push(event);
      },
    });

    expect(orchestrator.generateAttacks).toHaveBeenNthCalledWith(1, expect.objectContaining({ count: 12, visibility: "development" }));
    expect(orchestrator.generateAttacks).toHaveBeenNthCalledWith(2, expect.objectContaining({ count: 10, visibility: "holdout" }));
    expect(order.indexOf("generate:holdout")).toBeGreaterThan(Math.max(
      order.indexOf("frozen:instructions"),
      order.indexOf("frozen:permissions"),
      order.indexOf("frozen:orchestration"),
    ));
    expect(experiment.baselineResults.filter((result) => result.scenario.visibility === "seed")).toHaveLength(seedScenarios.length);
    expect(experiment.candidateDetails).toHaveLength(3);
    expect(experiment.candidateDetails.every((candidate) => /^[0-9a-f]{40}$/.test(candidate.commitSha))).toBe(true);
    expect(experiment.events.find((event) => event.type === "holdout.generated")?.id)
      .toBeGreaterThan(Math.max(...experiment.events.filter((event) => event.type === "candidate.frozen").map((event) => event.id)));
    expect(experiment.snapshot.mode).toBe("live");
    expect(experiment.snapshot.status).toBe("awaiting_approval");
    expect(experiment.promotionHook.execute).toBeTypeOf("function");
    expect(streamedEvents.map((event) => event.id)).toEqual(experiment.events.map((event) => event.id));
    expect(experiment.immunity).toEqual(priorImmunity);
    expect(runner.run.mock.calls.some(([scenario]) => scenario.id.startsWith("immunity-"))).toBe(true);
  });

  it("disqualifies a failed Codex candidate without aborting the live experiment", async () => {
    const root = await mkdtemp(join(tmpdir(), "aegis-live-"));
    cleanup.push(root);
    const order: string[] = [];
    const orchestrator = {
      generateAttacks: vi.fn(async ({ visibility }: { visibility?: string }) => {
        order.push(`generate:${visibility ?? "development"}`);
        return structuredClone(visibility === "holdout" ? holdoutScenarios : developmentScenarios);
      }),
      diagnoseAndPlan: vi.fn(async () => [
        mutation("instructions", "instructions"),
        mutation("permissions", "permissions"),
        mutation("orchestration", "orchestration"),
      ]),
    };
    const builder = {
      build: vi.fn(async ({ workingDirectory, mutation: spec }: {
        workingDirectory: string;
        mutation: MutationSpec;
      }): Promise<CodexBuildResult> => {
        if (spec.kind === "permissions") throw new Error("Codex timed out");
        const prompt = await readFile(join(workingDirectory, "system-prompt.md"), "utf8");
        await writeFile(join(workingDirectory, "system-prompt.md"), `${prompt}\nAEGIS_REPAIR_ACTIVE:${spec.kind}\n`);
        return {
          summary: `Hardened ${spec.kind}`,
          changedFiles: ["system-prompt.md"],
          testsRun: [],
          usage: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 20, reasoningOutputTokens: 0 },
        };
      }),
    };
    const factory = new LiveExperimentFactory({
      orchestrator,
      runner: createRunner(),
      builder,
      worktrees: new ObservedWorktrees(order),
      dataDir: root,
      sourceTargetDir: join(process.cwd(), "fixtures/refund-agent"),
    });

    const experiment = await factory.create("run-live-failure", "refund-agent");

    expect(experiment.candidateDetails).toHaveLength(2);
    expect(experiment.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "candidate.disqualified",
        payload: expect.objectContaining({ candidateId: "permissions", reason: "Codex timed out" }),
      }),
    ]));
    expect(order.indexOf("generate:holdout")).toBeGreaterThan(order.indexOf("frozen:orchestration"));
    expect(experiment.snapshot.status).toBe("awaiting_approval");
    expect(experiment.candidateResults.permissions).toBeUndefined();
    expect(regressionScenarios).toHaveLength(4);
  });

  it("scores the model's unsafe attempt even when a downstream candidate guard blocks it", async () => {
    const root = await mkdtemp(join(tmpdir(), "aegis-live-"));
    cleanup.push(root);
    const orchestrator = {
      generateAttacks: vi.fn(async ({ visibility }: { visibility?: string }) => structuredClone(
        visibility === "holdout" ? holdoutScenarios : developmentScenarios,
      )),
      diagnoseAndPlan: vi.fn(async () => [
        mutation("instructions", "instructions"),
        { ...mutation("permissions", "permissions"), allowedFiles: ["src/agent.ts"] },
        mutation("orchestration", "orchestration"),
      ]),
    };
    const builder = {
      build: vi.fn(async ({ workingDirectory, mutation: spec }: {
        workingDirectory: string;
        mutation: MutationSpec;
      }): Promise<CodexBuildResult> => {
        if (spec.kind === "permissions") {
          await writeFile(join(workingDirectory, "src/agent.ts"), [
            "export function enforceCandidateActions() {",
            "  return [{ type: 'escalate', reason: 'External tool guard blocked the request.' }];",
            "}",
            "",
          ].join("\n"));
        } else {
          const prompt = await readFile(join(workingDirectory, "system-prompt.md"), "utf8");
          await writeFile(join(workingDirectory, "system-prompt.md"), `${prompt}\nAEGIS_REPAIR_ACTIVE:${spec.kind}\n`);
        }
        return {
          summary: `Hardened ${spec.kind}`,
          changedFiles: spec.allowedFiles,
          testsRun: [],
          usage: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 20, reasoningOutputTokens: 0 },
        };
      }),
    };
    const factory = new LiveExperimentFactory({
      orchestrator,
      runner: createRunner(),
      builder,
      guardCompiler: () => async () => [
        { type: "escalate", reason: "External tool guard blocked the request." },
      ],
      dataDir: root,
      sourceTargetDir: join(process.cwd(), "fixtures/refund-agent"),
    });

    const experiment = await factory.create("run-live-observable-attempt", "refund-agent");
    const permissionCandidate = experiment.candidateDetails.find((candidate) => candidate.id === "permissions");

    expect(permissionCandidate?.score.hardViolations).toBeGreaterThan(0);
    expect(permissionCandidate?.score.promotionEligible).toBe(false);
    expect(experiment.candidateResults.permissions.some((result) => result.actions.some((action) => action.type === "approve_refund")))
      .toBe(true);
    expect(experiment.candidateResults.permissions.some((result) => result.traceSummary.includes("External guard outcome: escalate")))
      .toBe(true);
  });
});

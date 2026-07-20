import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";

import { transitionRun } from "../../engine/src/state.js";
import { serializeAttackReproducer } from "../../engine/src/immunity.js";
import type {
  AttackResult,
  CandidateSnapshot,
  ImmunityRecord,
  PromotionDecision,
  ReplayEventPayload,
  RunEvent,
  RunSnapshot,
} from "../../engine/src/contracts.js";

const exec = promisify(execFile);

export interface ExperimentPromotionRequest {
  snapshot: RunSnapshot;
  candidate: CandidateSnapshot;
  decision: "approve" | "reject";
  nextEventId: number;
}

export interface ExperimentPromotionReceipt {
  decision: PromotionDecision;
  /** Compensating compare-and-swap used only if durable persistence fails. */
  rollback(): Promise<void>;
}

export interface ExperimentPromotionHook {
  execute(request: ExperimentPromotionRequest): Promise<ExperimentPromotionReceipt>;
}

export interface ExperimentImmunityVerificationRequest {
  runId: string;
  candidate: CandidateSnapshot;
  record: ImmunityRecord;
}

export interface ExperimentImmunityVerificationExecution {
  baseline: AttackResult;
  promoted: AttackResult;
}

export interface ExperimentImmunityVerifier {
  verify(request: ExperimentImmunityVerificationRequest): Promise<ExperimentImmunityVerificationExecution>;
}

export interface PromotableExperiment {
  promotionHook?: ExperimentPromotionHook;
  immunityVerifier?: ExperimentImmunityVerifier;
}

export class LivePromotionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LivePromotionConflictError";
  }
}

export interface GitProtectedRefPromotionOptions {
  repository: string;
  protectedRef: string;
  baselineSha: string;
  discoveredFailures: AttackResult[];
  candidateResults: Record<string, AttackResult[]>;
  now?: () => Date;
}

async function git(repository: string, args: string[]): Promise<string> {
  const result = await exec("git", args, {
    cwd: repository,
    maxBuffer: 5 * 1024 * 1024,
  });
  return result.stdout.trim();
}

function hardViolations(result: AttackResult) {
  return result.violations.filter((violation) => violation.severity === "hard");
}

function scenarioIdentity(result: AttackResult): string {
  return createHash("sha256").update(JSON.stringify({
    id: result.scenario.id,
    seed: result.scenario.seed,
    strategy: result.scenario.strategy,
    customerMessage: result.scenario.customerMessage,
    worldState: result.scenario.worldState,
  })).digest("hex");
}

function attackFingerprint(result: AttackResult, violatedRule: string): string {
  return createHash("sha256").update(JSON.stringify({
    strategy: result.scenario.strategy,
    customerMessage: result.scenario.customerMessage,
    worldState: result.scenario.worldState,
    targetedPolicy: result.scenario.targetedPolicy,
    violatedRule,
  })).digest("hex");
}

function immunityRecords(
  failures: AttackResult[],
  candidate: CandidateSnapshot,
  at: string,
): ImmunityRecord[] {
  return failures.flatMap((failure) => hardViolations(failure).map((violation) => {
    const fingerprint = attackFingerprint(failure, violation.code);
    const recordId = createHash("sha256").update(
      `${failure.scenario.id}:${violation.code}:${candidate.commitSha}`,
    ).digest("hex");
    return {
      id: `immunity-${recordId.slice(0, 20)}`,
      attackFingerprint: fingerprint,
      scenarioId: failure.scenario.id,
      violatedRule: violation.code,
      reproducer: serializeAttackReproducer(failure.scenario),
      repairCommit: candidate.commitSha,
      regressionPassed: candidate.score.regressionPassed,
      createdAt: at,
    };
  }));
}

function eventFor(
  request: ExperimentPromotionRequest,
  snapshot: RunSnapshot,
  at: string,
): RunEvent<ReplayEventPayload> {
  const approved = request.decision === "approve";
  return {
    id: request.nextEventId,
    runId: snapshot.id,
    type: approved ? "promotion.approved" : "promotion.rejected",
    at,
    actor: "system",
    title: approved ? "Live immunity promoted" : "Live promotion rejected",
    summary: approved
      ? `${request.candidate.name} now owns the protected Git ref; no production deployment was performed.`
      : `${request.candidate.name} was rejected; the protected Git ref was left unchanged.`,
    payload: {
      offsetMs: 0,
      phase: snapshot.status,
      candidateId: request.candidate.id,
      commitSha: request.candidate.commitSha,
      score: request.candidate.score.overall,
      baselineScore: snapshot.baselineScore?.overall,
      shieldState: approved ? "immune" : "fractured",
      deploymentPerformed: false,
    },
    snapshot: structuredClone(snapshot),
  };
}

/**
 * Promotion boundary for a completed live experiment. It moves only an
 * internal Git ref with update-ref compare-and-swap; production stays untouched.
 */
export class GitProtectedRefPromotionHook implements ExperimentPromotionHook {
  private readonly repository: string;
  private readonly protectedRef: string;
  private readonly baselineSha: string;
  private readonly discoveredFailures: AttackResult[];
  private readonly candidateResults: Record<string, AttackResult[]>;
  private readonly now: () => Date;

  constructor(options: GitProtectedRefPromotionOptions) {
    if (!/^refs\/aegis\/[a-zA-Z0-9._/-]+$/.test(options.protectedRef)) {
      throw new Error("Protected promotion ref must remain under refs/aegis/.");
    }
    if (!/^[0-9a-f]{40}$/i.test(options.baselineSha)) {
      throw new Error("Live promotion baseline must be a full Git commit SHA.");
    }
    this.repository = options.repository;
    this.protectedRef = options.protectedRef;
    this.baselineSha = options.baselineSha;
    this.discoveredFailures = structuredClone(options.discoveredFailures);
    this.candidateResults = structuredClone(options.candidateResults);
    this.now = options.now ?? (() => new Date());
  }

  async execute(request: ExperimentPromotionRequest): Promise<ExperimentPromotionReceipt> {
    if (request.snapshot.status !== "awaiting_approval") {
      throw new LivePromotionConflictError("Live experiment is not awaiting approval.");
    }
    if (!Number.isSafeInteger(request.nextEventId) || request.nextEventId < 1) {
      throw new Error("Promotion event id must be a positive integer.");
    }
    const at = this.now().toISOString();

    if (request.decision === "reject") {
      const snapshot = transitionRun({
        ...request.snapshot,
        selectedCandidateId: request.candidate.id,
      }, "rejected", at);
      const decision: PromotionDecision = {
        snapshot,
        event: eventFor(request, snapshot, at),
        immunity: [],
      };
      return { decision, rollback: async () => undefined };
    }

    if (!request.candidate.score.promotionEligible) {
      throw new LivePromotionConflictError("Selected candidate does not satisfy every protected promotion gate.");
    }
    if (!/^[0-9a-f]{40}$/i.test(request.candidate.commitSha)) {
      throw new LivePromotionConflictError("Selected live candidate does not have a frozen full commit SHA.");
    }
    if (this.discoveredFailures.length === 0) {
      throw new LivePromotionConflictError("No runtime-discovered baseline failures are available for immunity verification.");
    }

    const results = this.candidateResults[request.candidate.id] ?? [];
    const byScenario = new Map(results.map((result) => [scenarioIdentity(result), result]));
    const unblocked = this.discoveredFailures.filter((failure) => {
      const candidateResult = byScenario.get(scenarioIdentity(failure));
      return !candidateResult || hardViolations(candidateResult).length > 0 || !candidateResult.taskCompleted;
    });
    if (unblocked.length > 0) {
      throw new LivePromotionConflictError(
        `Selected candidate does not block every original discovered attack: ${unblocked.map((failure) => failure.scenario.id).join(", ")}.`,
      );
    }

    try {
      await git(this.repository, ["cat-file", "-e", `${request.candidate.commitSha}^{commit}`]);
      await git(this.repository, ["merge-base", "--is-ancestor", this.baselineSha, request.candidate.commitSha]);
    } catch {
      throw new LivePromotionConflictError("Selected commit is not a descendant of the isolated vulnerable baseline.");
    }
    const previousSha = await git(this.repository, ["rev-parse", this.protectedRef]);
    if (previousSha !== this.baselineSha) {
      throw new LivePromotionConflictError(
        `Protected ref changed concurrently; expected ${this.baselineSha.slice(0, 12)}, found ${previousSha.slice(0, 12)}.`,
      );
    }

    try {
      await git(this.repository, [
        "update-ref",
        "-m", `aegis: protect ${request.candidate.id}`,
        this.protectedRef,
        request.candidate.commitSha,
        previousSha,
      ]);
    } catch (error) {
      throw new LivePromotionConflictError(
        `Atomic protected-ref promotion failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const snapshot = transitionRun({
      ...request.snapshot,
      selectedCandidateId: request.candidate.id,
      recommendation: "promote",
    }, "promoted", at);
    const decision: PromotionDecision = {
      snapshot,
      event: eventFor(request, snapshot, at),
      immunity: immunityRecords(this.discoveredFailures, request.candidate, at),
    };
    let active = true;
    return {
      decision,
      rollback: async () => {
        if (!active) return;
        await git(this.repository, [
          "update-ref",
          "-m", `aegis: rollback ${request.candidate.id}`,
          this.protectedRef,
          previousSha,
          request.candidate.commitSha,
        ]);
        active = false;
      },
    };
  }
}

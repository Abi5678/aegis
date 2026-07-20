import { randomUUID } from "node:crypto";
import type {
  CandidateSnapshot,
  ImmunityRecord,
  ImmunityVerification,
  RunEvent,
  RunSnapshot
} from "../../../../packages/engine/src/contracts.js";
import {
  buildReplayRun,
  createInitialRun,
  decideReplayPromotion,
  getScenario,
  parseAttackReproducer,
  serializeAttackReproducer,
  transitionRun,
  verifyReplayImmunity
} from "../../../../packages/engine/src/index.js";
import type {
  ExperimentPromotionHook,
  ExperimentPromotionReceipt,
  PromotableExperiment
} from "../../../../packages/live/src/live-promotion.js";
import { LivePromotionConflictError } from "../../../../packages/live/src/live-promotion.js";
import {
  CandidateNotFoundError,
  ImmunityVerificationConflictError,
  LiveModeUnavailableError,
  PromotionConflictError,
  RollbackConflictError,
  RunNotFoundError,
  type CreateRunInput,
  type EventListener,
  type PromotionInput,
  type PromotionResult,
  type ImmunityVerificationResult,
  type RollbackResult,
  type RunService
} from "./run-service.js";

export type EngineExperiment = ReturnType<typeof buildReplayRun> & PromotableExperiment;

export interface LiveExperimentContext {
  /** Durable, ordered event boundary used by the live factory while it runs. */
  onEvent(event: RunEvent): Promise<void>;
  /** Previously promoted attacks that every new repair must retain. */
  priorImmunity: ImmunityRecord[];
}

export type LiveExperimentFactory = (
  runId: string,
  target: "refund-agent",
  context: LiveExperimentContext
) => EngineExperiment | Promise<EngineExperiment>;

export interface EngineRunServiceOptions {
  /** Total wall-clock duration for the prerecorded experiment timeline. */
  replayDurationMs?: number;
  /** Live mode is opt-in so it can never silently fall back to prerecorded data. */
  liveExperimentFactory?: LiveExperimentFactory;
  persistence?: RunPersistence;
}

export interface RunPersistence {
  initialize(): Promise<void>;
  saveSnapshot(snapshot: RunSnapshot): Promise<void>;
  appendEvent(event: RunEvent): Promise<void>;
  loadSnapshot(runId: string): Promise<RunSnapshot | null>;
  loadEvents(runId: string): Promise<RunEvent[]>;
  appendImmunity(record: ImmunityRecord): Promise<void>;
  loadImmunity(): Promise<ImmunityRecord[]>;
}

type Session = {
  experiment: EngineExperiment;
  snapshot: RunSnapshot;
  events: RunEvent[];
  timeline: RunEvent[];
  nextEvent: number;
  lastEventId: number;
  listeners: Set<EventListener>;
  timer?: NodeJS.Timeout;
  liveTask?: Promise<void>;
  /** Exists only in the process that performed a successful live promotion. */
  liveRollback?: {
    rollback: ExperimentPromotionReceipt["rollback"];
    candidateId: string;
    commitSha: string;
    immunityRecords: ImmunityRecord[];
  };
};

/**
 * Runtime registry for engine experiments. Replay data is streamed through the
 * exact same interface as live data, but live execution must be explicitly
 * supplied and is never simulated under a "live" label.
 */
export class EngineRunService implements RunService {
  private readonly sessions = new Map<string, Session>();
  private readonly immunity = new Map<string, ImmunityRecord>();
  private readonly replayDurationMs: number;
  private readonly liveExperimentFactory?: LiveExperimentFactory;
  private readonly persistence?: RunPersistence;
  private readonly persistenceReady: Promise<void>;
  private persistenceQueue: Promise<void> = Promise.resolve();

  constructor(options: EngineRunServiceOptions = {}) {
    this.replayDurationMs = options.replayDurationMs ?? 90_000;
    this.liveExperimentFactory = options.liveExperimentFactory;
    this.persistence = options.persistence;
    this.persistenceReady = options.persistence?.initialize() ?? Promise.resolve();
  }

  async createRun(input: CreateRunInput): Promise<RunSnapshot> {
    await this.persistenceReady;
    const runId = `run_${randomUUID()}`;
    const priorImmunity = await this.loadKnownImmunity();
    if (input.mode === "live") {
      return this.startLiveExperiment(runId, input.target, priorImmunity);
    }
    const rawExperiment = buildReplayRun(runId, priorImmunity);
    const experiment = normalizeExperiment(rawExperiment, runId, input.mode);
    const snapshot = initialSnapshot(experiment.snapshot, input.mode);
    const session: Session = {
      experiment,
      snapshot,
      events: [],
      timeline: experiment.events,
      nextEvent: 0,
      lastEventId: 0,
      listeners: new Set()
    };
    this.sessions.set(runId, session);
    for (const record of experiment.immunity ?? []) this.immunity.set(record.id, record);
    await this.persistence?.saveSnapshot(snapshot);
    this.scheduleNext(session, 30);
    return snapshot;
  }

  async getRun(runId: string): Promise<RunSnapshot | null> {
    return (await this.getOrRestoreSession(runId))?.snapshot ?? null;
  }

  async getEvents(runId: string, afterEventId: number): Promise<RunEvent[]> {
    const session = await this.getOrRestoreSession(runId);
    if (!session) throw new RunNotFoundError(runId);
    return session.events.filter((event) => event.id > afterEventId);
  }

  subscribe(runId: string, listener: EventListener): (() => void) | null {
    const session = this.sessions.get(runId);
    if (!session) return null;
    session.listeners.add(listener);
    return () => session.listeners.delete(listener);
  }

  async getCandidate(runId: string, candidateId: string): Promise<CandidateSnapshot | null> {
    const session = await this.getOrRestoreSession(runId);
    if (!session) throw new RunNotFoundError(runId);
    return session.experiment.candidateDetails.find((candidate) => candidate.id === candidateId) ?? null;
  }

  async promote(runId: string, input: PromotionInput): Promise<PromotionResult> {
    const session = await this.getOrRestoreSession(runId);
    if (!session) throw new RunNotFoundError(runId);
    if (session.snapshot.status !== "awaiting_approval") {
      throw new PromotionConflictError("This run is not awaiting human approval.");
    }
    const candidate = session.experiment.candidateDetails.find(
      (item) => item.id === input.candidateId
    );
    if (!candidate) {
      throw new CandidateNotFoundError(input.candidateId);
    }
    if (input.decision === "approve" && !candidate.score.promotionEligible) {
      throw new PromotionConflictError(
        "This candidate does not satisfy every protected promotion gate."
      );
    }

    if (session.snapshot.mode === "live") {
      if (!session.experiment.promotionHook) {
        throw new PromotionConflictError(
          "This live run does not have its protected-ref transaction context; start a new live experiment rather than falling back to replay promotion."
        );
      }
      return this.promoteWithHook(session, candidate, input);
    }

    const decision = decideReplayPromotion(session.experiment, input.candidateId, input.decision);
    const snapshot = normalizeSnapshot(decision.snapshot, runId, session.snapshot.mode);
    const event = normalizeEvent(decision.event, runId, session.snapshot.mode);
    await this.publish(session, { ...event, snapshot });
    for (const record of decision.immunity) {
      this.immunity.set(record.id, record);
      await this.persistence?.appendImmunity(record);
    }
    session.experiment.immunity = [...session.experiment.immunity, ...decision.immunity];
    return {
      snapshot,
      event: { ...event, snapshot },
      immunityRecord: decision.immunity[0],
      immunityRecords: decision.immunity
    };
  }

  async verifyImmunity(runId: string, recordId: string): Promise<ImmunityVerificationResult> {
    const session = await this.getOrRestoreSession(runId);
    if (!session) throw new RunNotFoundError(runId);
    if (session.snapshot.status !== "promoted") {
      throw new ImmunityVerificationConflictError("Immunity can only be verified after human-approved promotion.");
    }
    const candidateId = session.snapshot.selectedCandidateId;
    const candidate = session.experiment.candidateDetails.find((item) => item.id === candidateId);
    if (!candidate) {
      throw new ImmunityVerificationConflictError("The promoted candidate is unavailable for verification.");
    }
    await this.loadKnownImmunity();
    const record = this.immunity.get(recordId);
    if (!record || record.repairCommit !== candidate.commitSha) {
      throw new ImmunityVerificationConflictError("This immunity record does not belong to the promoted candidate.");
    }

    const checkedAt = new Date().toISOString();
    let verification: ImmunityVerification;
    if (session.snapshot.mode === "replay") {
      verification = verifyReplayImmunity(runId, candidate, record, checkedAt);
    } else {
      const verifier = session.experiment.immunityVerifier;
      if (!verifier) {
        throw new ImmunityVerificationConflictError(
          "The live verification context is unavailable after restart; run a new authenticated live experiment rather than substituting replay evidence."
        );
      }
      const execution = await verifier.verify({ runId, candidate, record });
      const baselineFailed = execution.baseline.violations.some((violation) => violation.severity === "hard");
      const promotedPassed = execution.promoted.taskCompleted
        && execution.promoted.violations.every((violation) => violation.severity !== "hard");
      verification = {
        id: `verification-${record.id}-${Date.parse(checkedAt)}`,
        runId,
        recordId: record.id,
        candidateId: candidate.id,
        mode: "live",
        evidenceSource: "live_execution",
        attackFingerprint: record.attackFingerprint,
        scenarioId: execution.promoted.scenario.id,
        checkedAt,
        blocked: baselineFailed && promotedPassed,
        baseline: execution.baseline,
        promoted: execution.promoted
      };
    }

    const snapshot = { ...session.snapshot, updatedAt: checkedAt };
    const event: RunEvent = {
      id: session.lastEventId + 1,
      runId,
      type: verification.blocked ? "immunity.verified" : "immunity.verification_failed",
      at: checkedAt,
      actor: "guardian",
      title: verification.blocked ? "Original exploit blocked" : "Immunity verification failed",
      summary: verification.blocked
        ? `The identical ${verification.scenarioId} reproducer failed against ${candidate.name}; deterministic policy checks found zero hard violations.`
        : `The promoted candidate did not safely complete the identical ${verification.scenarioId} reproducer.`,
      payload: {
        recordId: record.id,
        attackFingerprint: record.attackFingerprint,
        candidateId: candidate.id,
        evidenceSource: verification.evidenceSource,
        baselineActions: verification.baseline.actions,
        baselineViolations: verification.baseline.violations,
        promotedActions: verification.promoted.actions,
        promotedViolations: verification.promoted.violations,
        blocked: verification.blocked,
        shieldState: verification.blocked ? "immune" : "breached"
      },
      snapshot
    };
    await this.publish(session, event);
    session.experiment.snapshot = snapshot;
    return { verification, event };
  }

  private async promoteWithHook(
    session: Session,
    candidate: CandidateSnapshot,
    input: PromotionInput
  ): Promise<PromotionResult> {
    const hook = session.experiment.promotionHook as ExperimentPromotionHook;
    const previousSnapshot = session.snapshot;
    const nextEventId = Math.max(
      0,
      ...session.events.map((event) => event.id),
      ...session.experiment.events.map((event) => event.id)
    ) + 1;
    let receipt: ExperimentPromotionReceipt;
    try {
      receipt = await hook.execute({
        snapshot: structuredClone(session.snapshot),
        candidate: structuredClone(candidate),
        decision: input.decision,
        nextEventId
      });
    } catch (error) {
      if (error instanceof LivePromotionConflictError) {
        throw new PromotionConflictError(error.message);
      }
      throw error;
    }

    const decision = receipt.decision;
    const expectedStatus = input.decision === "approve" ? "promoted" : "rejected";
    if (decision.snapshot.status !== expectedStatus) {
      await receipt.rollback();
      throw new PromotionConflictError(
        `Live promotion hook returned ${decision.snapshot.status}; expected ${expectedStatus}.`
      );
    }
    if (input.decision === "reject" && decision.immunity.length > 0) {
      await receipt.rollback();
      throw new PromotionConflictError("A rejected candidate cannot create immunity records.");
    }

    const snapshot = normalizeSnapshot(decision.snapshot, session.snapshot.id, "live");
    const event = normalizeEvent(decision.event, session.snapshot.id, "live");
    const committedEvent = { ...event, snapshot };
    try {
      await this.enqueuePersistence(async () => {
        await this.persistence?.appendEvent(committedEvent);
        await this.persistence?.saveSnapshot(snapshot);
        for (const record of decision.immunity) {
          await this.persistence?.appendImmunity(record);
        }
      });
    } catch (persistenceError) {
      let rollbackError: unknown;
      try {
        await receipt.rollback();
        await this.persistence?.saveSnapshot(previousSnapshot);
      } catch (error) {
        rollbackError = error;
      }
      if (rollbackError) {
        throw new PromotionConflictError(
          `Live promotion persistence failed and protected-ref rollback also failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
        );
      }
      throw new PromotionConflictError(
        `Live promotion was not durably persisted, so the protected ref was rolled back: ${persistenceError instanceof Error ? persistenceError.message : String(persistenceError)}`
      );
    }

    session.snapshot = snapshot;
    session.experiment.snapshot = snapshot;
    if (!session.events.some((existing) => existing.id === committedEvent.id)) {
      session.events.push(committedEvent);
      session.events.sort((left, right) => left.id - right.id);
      session.lastEventId = Math.max(session.lastEventId, committedEvent.id);
      for (const listener of session.listeners) listener(committedEvent);
    }
    for (const record of decision.immunity) {
      this.immunity.set(record.id, record);
    }
    session.experiment.immunity = [...session.experiment.immunity, ...decision.immunity];
    if (input.decision === "approve") {
      session.liveRollback = {
        rollback: receipt.rollback,
        candidateId: candidate.id,
        commitSha: candidate.commitSha,
        immunityRecords: structuredClone(decision.immunity)
      };
    }
    return {
      snapshot,
      event: committedEvent,
      immunityRecord: decision.immunity[0],
      immunityRecords: decision.immunity
    };
  }

  async rollback(runId: string): Promise<RollbackResult> {
    const session = await this.getOrRestoreSession(runId);
    if (!session) throw new RunNotFoundError(runId);
    if (session.snapshot.mode !== "live") {
      throw new RollbackConflictError("Replay runs are reference simulations and cannot move a protected Git ref.");
    }
    if (session.snapshot.status !== "promoted") {
      throw new RollbackConflictError("Only a promoted live run can be rolled back.");
    }
    const context = session.liveRollback;
    if (!context) {
      throw new RollbackConflictError(
        "This live run no longer has its in-memory protected-ref rollback context; perform a verified manual rollback instead."
      );
    }
    // Consume the single-use capability before crossing an async boundary so
    // concurrent rollback requests cannot both publish a terminal decision.
    session.liveRollback = undefined;

    const at = new Date().toISOString();
    const snapshot = transitionRun(session.snapshot, "rolled_back", at);
    const revokedImmunity = context.immunityRecords.map((record) => ({
      ...record,
      regressionPassed: false,
      createdAt: at
    }));
    const event: RunEvent = {
      id: session.lastEventId + 1,
      runId,
      type: "promotion.rolled_back",
      at,
      actor: "system",
      title: "Live immunity rolled back",
      summary: "The protected Git ref returned to the vulnerable baseline; attack memory was retained as a failing regression.",
      payload: {
        phase: "rolled_back",
        candidateId: context.candidateId,
        commitSha: context.commitSha,
        deploymentPerformed: false,
        attackMemoryRetained: true,
        revokedImmunityIds: revokedImmunity.map((record) => record.id)
      },
      snapshot
    };

    try {
      // This closure performs update-ref compare-and-swap from the promoted
      // candidate SHA back to the exact baseline SHA captured at promotion.
      await context.rollback();
    } catch (error) {
      session.liveRollback = context;
      throw new RollbackConflictError(
        `Atomic protected-ref rollback failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    try {
      await this.enqueuePersistence(async () => {
        await this.persistence?.appendEvent(event);
        await this.persistence?.saveSnapshot(snapshot);
        for (const record of revokedImmunity) {
          await this.persistence?.appendImmunity(record);
        }
      });
    } catch (error) {
      // The Git ref is already safe at baseline. Keep the process truthful and
      // fail closed instead of presenting a still-promoted in-memory snapshot.
      session.snapshot = snapshot;
      session.experiment.snapshot = snapshot;
      throw new RollbackConflictError(
        `Protected ref rolled back, but rollback evidence could not be persisted: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    session.snapshot = snapshot;
    session.experiment.snapshot = snapshot;
    session.events.push(event);
    session.events.sort((left, right) => left.id - right.id);
    session.lastEventId = event.id;
    for (const record of revokedImmunity) this.immunity.set(record.id, record);
    const revokedById = new Map(revokedImmunity.map((record) => [record.id, record]));
    session.experiment.immunity = session.experiment.immunity.map(
      (record) => revokedById.get(record.id) ?? record
    );
    for (const listener of session.listeners) listener(event);

    return { snapshot, event, immunityRecords: revokedImmunity };
  }

  async listImmunity(): Promise<ImmunityRecord[]> {
    await this.persistenceReady;
    await this.loadKnownImmunity();
    return [...this.immunity.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private async loadKnownImmunity(): Promise<ImmunityRecord[]> {
    const latest = new Map<string, ImmunityRecord>();
    for (const record of await this.persistence?.loadImmunity() ?? []) {
      latest.set(record.id, record);
    }
    const migrated: ImmunityRecord[] = [];
    for (const rawRecord of latest.values()) {
      let record = rawRecord;
      try {
        parseAttackReproducer(record.reproducer);
      } catch (error) {
        // Early Aegis alpha builds stored command-like reproducers. Migrate only
        // records whose scenario is a known bundled fixture; unknown malformed
        // immune memory remains a hard integrity error.
        const source = getScenario(record.scenarioId);
        if (!source) throw error;
        record = { ...record, reproducer: serializeAttackReproducer(source) };
        migrated.push(record);
      }
      this.immunity.set(record.id, record);
    }
    for (const record of migrated) {
      await this.persistence?.appendImmunity(record);
    }
    return [...this.immunity.values()].map((record) => structuredClone(record));
  }

  async close(): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.timer) clearTimeout(session.timer);
      session.listeners.clear();
    }
    await this.persistenceQueue;
    this.sessions.clear();
  }

  private async startLiveExperiment(
    runId: string,
    target: "refund-agent",
    priorImmunity: ImmunityRecord[]
  ): Promise<RunSnapshot> {
    if (!this.liveExperimentFactory) throw new LiveModeUnavailableError();
    const snapshot = createInitialRun(runId, "live");
    const session: Session = {
      experiment: emptyExperiment(snapshot),
      snapshot,
      events: [],
      timeline: [],
      nextEvent: 0,
      lastEventId: 0,
      listeners: new Set()
    };
    this.sessions.set(runId, session);
    await this.persistence?.saveSnapshot(snapshot);
    session.liveTask = this.finishLiveExperiment(session, target, priorImmunity);
    return snapshot;
  }

  private async finishLiveExperiment(
    session: Session,
    target: "refund-agent",
    priorImmunity: ImmunityRecord[]
  ): Promise<void> {
    const completionEvents: RunEvent[] = [];
    try {
      const rawExperiment = await this.liveExperimentFactory!(
        session.snapshot.id,
        target,
        {
          priorImmunity: structuredClone(priorImmunity),
          onEvent: async (event) => {
            if (this.sessions.get(session.snapshot.id) !== session) return;
            const normalized = normalizeEvent(event, session.snapshot.id, "live");
            // Do not reveal the human gate until the completed factory has
            // returned its candidate details and protected-ref promotion hook.
            if (normalized.snapshot.status === "awaiting_approval") {
              completionEvents.push(normalized);
              return;
            }
            await this.publish(session, normalized);
          }
        }
      );
      if (this.sessions.get(session.snapshot.id) !== session) return;

      const experiment = normalizeExperiment(rawExperiment, session.snapshot.id, "live");
      session.experiment = experiment;
      session.timeline = [];
      session.nextEvent = 0;

      // A two-argument legacy adapter may return a completed timeline without
      // streaming it. Preserve compatibility, but publish it immediately and
      // never replay completed live work on decorative timers.
      for (const event of experiment.events) {
        await this.publish(session, event);
      }
      for (const event of completionEvents) {
        await this.publish(session, event);
      }
      if (session.snapshot.updatedAt !== experiment.snapshot.updatedAt
        || session.snapshot.status !== experiment.snapshot.status) {
        await this.enqueuePersistence(async () => {
          await this.persistence?.saveSnapshot(experiment.snapshot);
        });
        session.snapshot = experiment.snapshot;
      }
    } catch (error) {
      if (this.sessions.get(session.snapshot.id) !== session) return;
      await this.failLiveSession(session, "run.failed", "Live experiment stopped safely", error);
    }
  }

  private async failLiveSession(
    session: Session,
    type: string,
    title: string,
    error?: unknown
  ): Promise<void> {
    if (isTerminal(session.snapshot.status)) return;
    const at = new Date().toISOString();
    const snapshot = transitionRun(session.snapshot, "failed", at);
    const event: RunEvent = {
      id: session.lastEventId + 1,
      runId: snapshot.id,
      type,
      at,
      actor: "system",
      title,
      summary: error instanceof Error
        ? `Aegis failed closed: ${error.message.slice(0, 240)}`
        : "Aegis failed closed before a repair could be promoted.",
      payload: {
        recoveryRequired: true,
        deploymentPerformed: false
      },
      snapshot
    };
    try {
      await this.publish(session, event);
      session.experiment.snapshot = snapshot;
    } catch {
      // Persistence is already unavailable. Keep the in-memory run failed,
      // but do not broadcast evidence that was not durably recorded.
      session.snapshot = snapshot;
      session.experiment.snapshot = snapshot;
    }
  }

  private scheduleNext(session: Session, delay?: number): void {
    if (session.nextEvent >= session.timeline.length) {
      return;
    }
    const interval = delay ?? Math.max(
      1,
      Math.floor(this.replayDurationMs / Math.max(session.timeline.length, 1))
    );
    session.timer = setTimeout(() => {
      const event = session.timeline[session.nextEvent];
      void this.publish(session, event).then(() => {
        session.nextEvent += 1;
        this.scheduleNext(session);
      }).catch((error) => {
        void this.failLiveSession(
          session,
          "run.failed",
          "Replay stopped because evidence could not be persisted",
          error
        );
      });
    }, interval);
    session.timer.unref();
  }

  private async publish(session: Session, event: RunEvent): Promise<void> {
    if (event.id <= session.lastEventId) return;
    session.lastEventId = event.id;
    await this.enqueuePersistence(async () => {
      await this.persistence?.appendEvent(event);
      await this.persistence?.saveSnapshot(event.snapshot);
    });
    session.snapshot = event.snapshot;
    session.events.push(event);
    session.events.sort((a, b) => a.id - b.id);
    for (const listener of session.listeners) listener(event);
  }

  private enqueuePersistence(operation: () => Promise<void>): Promise<void> {
    if (!this.persistence) return Promise.resolve();
    const next = this.persistenceQueue.then(operation);
    this.persistenceQueue = next.catch(() => undefined);
    return next;
  }

  private async getOrRestoreSession(runId: string): Promise<Session | null> {
    const active = this.sessions.get(runId);
    if (active) return active;
    if (!this.persistence) return null;
    await this.persistenceReady;
    const snapshot = await this.persistence.loadSnapshot(runId);
    if (!snapshot) return null;

    const events = await this.persistence.loadEvents(runId);
    const priorImmunity = await this.loadKnownImmunity();
    const experiment: EngineExperiment = snapshot.mode === "live"
      ? emptyExperiment(snapshot, events)
      : normalizeExperiment(buildReplayRun(runId, priorImmunity), runId, "replay");
    const emittedIds = new Set(events.map((event) => event.id));
    const nextEvent = experiment.events.findIndex((event) => !emittedIds.has(event.id));
    const session: Session = {
      experiment,
      snapshot,
      events: [...events].sort((a, b) => a.id - b.id),
      timeline: experiment.events,
      nextEvent: nextEvent === -1 ? experiment.events.length : nextEvent,
      lastEventId: Math.max(0, ...events.map((event) => event.id)),
      listeners: new Set()
    };
    this.sessions.set(runId, session);
    if (snapshot.mode === "live" && !isTerminal(snapshot.status)) {
      await this.failLiveSession(
        session,
        "run.recovery_failed",
        "Interrupted live run cannot be resumed after restart",
        new Error("The in-memory Codex worktree and protected-ref transaction context were lost; start a new live run.")
      );
    } else if (!isSettled(snapshot.status) && session.nextEvent < session.timeline.length) {
      this.scheduleNext(session, 30);
    }
    return session;
  }
}

function normalizeExperiment(
  experiment: EngineExperiment,
  runId: string,
  mode: "live" | "replay"
): EngineExperiment {
  return {
    ...experiment,
    snapshot: normalizeSnapshot(experiment.snapshot, runId, mode),
    events: experiment.events.map((event) => normalizeEvent(event, runId, mode))
  };
}

function normalizeEvent<T>(event: RunEvent<T>, runId: string, mode: "live" | "replay"): RunEvent<T> {
  return {
    ...event,
    runId,
    snapshot: normalizeSnapshot(event.snapshot, runId, mode)
  };
}

function normalizeSnapshot(
  snapshot: RunSnapshot,
  runId: string,
  mode: "live" | "replay"
): RunSnapshot {
  return { ...snapshot, id: runId, mode };
}

function initialSnapshot(finalSnapshot: RunSnapshot, mode: "live" | "replay"): RunSnapshot {
  const timestamp = new Date().toISOString();
  return {
    ...finalSnapshot,
    mode,
    status: "idle",
    phaseIndex: 0,
    baselineScore: null,
    candidates: [],
    selectedCandidateId: null,
    recommendation: null,
    attacksDiscovered: 0,
    hardViolations: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function emptyExperiment(snapshot: RunSnapshot, events: RunEvent[] = []): EngineExperiment {
  return {
    snapshot: structuredClone(snapshot),
    events: structuredClone(events) as EngineExperiment["events"],
    candidateDetails: structuredClone(snapshot.candidates),
    immunity: [],
    baselineResults: [],
    candidateResults: {},
    replayDurationMs: 0
  };
}

function isTerminal(status: RunSnapshot["status"]): boolean {
  return status === "promoted" || status === "rolled_back" || status === "rejected" || status === "failed";
}

function isSettled(status: RunSnapshot["status"]): boolean {
  return status === "awaiting_approval" || status === "promoted" || status === "rolled_back" || status === "rejected" || status === "failed";
}

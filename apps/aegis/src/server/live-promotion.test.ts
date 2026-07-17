import { describe, expect, it, vi } from "vitest";

import {
  buildReplayRun,
  serializeAttackReproducer,
  transitionRun,
} from "../../../../packages/engine/src/index.js";
import type {
  ImmunityRecord,
  ReplayEventPayload,
  RunEvent,
  RunSnapshot,
} from "../../../../packages/engine/src/contracts.js";
import type {
  ExperimentPromotionHook,
  ExperimentPromotionRequest,
  LiveReplayExperiment,
} from "../../../../packages/live/src/index.js";
import {
  EngineRunService,
  type LiveExperimentFactory,
  type RunPersistence,
} from "./engine-run-service.js";

class RecordingPersistence implements RunPersistence {
  snapshots: RunSnapshot[] = [];
  events: RunEvent[] = [];
  immunity: ImmunityRecord[] = [];
  failPromotionEvent = false;
  restoreFromDisk = false;

  async initialize(): Promise<void> {}
  async saveSnapshot(snapshot: RunSnapshot): Promise<void> {
    this.snapshots.push(structuredClone(snapshot));
  }
  async appendEvent(event: RunEvent): Promise<void> {
    if (this.failPromotionEvent && event.type === "promotion.approved") {
      throw new Error("disk unavailable");
    }
    this.events.push(structuredClone(event));
  }
  async loadSnapshot(): Promise<RunSnapshot | null> {
    return this.restoreFromDisk ? structuredClone(this.snapshots.at(-1) ?? null) : null;
  }
  async loadEvents(): Promise<RunEvent[]> {
    return this.restoreFromDisk ? structuredClone(this.events) : [];
  }
  async appendImmunity(record: ImmunityRecord): Promise<void> {
    this.immunity.push(structuredClone(record));
  }
  async loadImmunity(): Promise<ImmunityRecord[]> {
    return structuredClone(this.immunity);
  }
}

function fakeHook(rollback = vi.fn(async () => undefined)) {
  const execute = vi.fn(async (request: ExperimentPromotionRequest) => {
    const at = "2026-07-14T21:00:00.000Z";
    const status = request.decision === "approve" ? "promoted" : "rejected";
    const snapshot = transitionRun(request.snapshot, status, at);
    const event: RunEvent<ReplayEventPayload> = {
      id: request.nextEventId,
      runId: snapshot.id,
      type: request.decision === "approve" ? "promotion.approved" : "promotion.rejected",
      at,
      actor: "system",
      title: "Live promotion decision",
      summary: "Protected ref transaction completed.",
      payload: {
        offsetMs: 0,
        phase: status,
        candidateId: request.candidate.id,
        commitSha: request.candidate.commitSha,
      },
      snapshot,
    };
    return {
      decision: {
        snapshot,
        event,
        immunity: request.decision === "approve" ? [{
          id: "immunity-live-actual",
          attackFingerprint: "actual-fingerprint",
          scenarioId: "runtime-discovered-7",
          violatedRule: "refund_total_exceeded",
          reproducer: serializeAttackReproducer(buildReplayRun("fake-live-reproducer").baselineResults[0]!.scenario),
          repairCommit: request.candidate.commitSha,
          regressionPassed: true,
          createdAt: at,
        }] : [],
      },
      rollback,
    };
  });
  return { execute, rollback } satisfies { execute: ExperimentPromotionHook["execute"]; rollback: typeof rollback };
}

function liveExperiment(hook: ExperimentPromotionHook, eligible = true): LiveReplayExperiment {
  const replay = buildReplayRun("live-template");
  const candidate = replay.candidateDetails.find((item) => item.id === "candidate-c");
  if (!candidate) throw new Error("Replay fixture candidate missing.");
  candidate.score.promotionEligible = eligible;
  replay.snapshot = {
    ...replay.snapshot,
    mode: "live",
    candidates: replay.candidateDetails,
  };
  return { ...replay, promotionHook: hook };
}

async function waitForApproval(service: EngineRunService, runId: string): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if ((await service.getRun(runId))?.status === "awaiting_approval") return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Live experiment did not reach approval.");
}

describe("EngineRunService live promotion hook", () => {
  it("does not reveal approval until candidate details and the live hook are attached", async () => {
    const hook = fakeHook();
    let markObserved!: () => void;
    const observed = new Promise<void>((resolve) => { markObserved = resolve; });
    let releaseFactory!: () => void;
    const factoryGate = new Promise<void>((resolve) => { releaseFactory = resolve; });
    const factory: LiveExperimentFactory = async (_runId, _target, context) => {
      const experiment = liveExperiment(hook);
      const approval = experiment.events.at(-1);
      if (!approval) throw new Error("Live fixture approval event missing.");
      await context.onEvent(approval);
      markObserved();
      await factoryGate;
      return experiment;
    };
    const service = new EngineRunService({ liveExperimentFactory: factory });
    const created = await service.createRun({ mode: "live", target: "refund-agent" });
    await observed;

    expect((await service.getRun(created.id))?.status).toBe("idle");
    expect(await service.getEvents(created.id, 0)).toEqual([]);

    releaseFactory();
    await waitForApproval(service, created.id);
    expect(await service.getCandidate(created.id, "candidate-c")).toMatchObject({ id: "candidate-c" });
    await expect(service.promote(created.id, { candidateId: "candidate-c", decision: "reject" }))
      .resolves.toMatchObject({ snapshot: { status: "rejected" } });
    await service.close();
  });

  it("persists the live decision event, snapshot, and actual immunity records", async () => {
    const persistence = new RecordingPersistence();
    const hook = fakeHook();
    const service = new EngineRunService({
      replayDurationMs: 1,
      persistence,
      liveExperimentFactory: async () => liveExperiment(hook),
    });
    const created = await service.createRun({ mode: "live", target: "refund-agent" });
    await waitForApproval(service, created.id);

    const result = await service.promote(created.id, { candidateId: "candidate-c", decision: "approve" });

    expect(hook.execute).toHaveBeenCalledOnce();
    expect(result.snapshot.status).toBe("promoted");
    expect(result.immunityRecords).toEqual([
      expect.objectContaining({ scenarioId: "runtime-discovered-7", violatedRule: "refund_total_exceeded" }),
    ]);
    expect(persistence.events.at(-1)).toMatchObject({ type: "promotion.approved" });
    expect(persistence.snapshots.at(-1)).toMatchObject({ status: "promoted" });
    expect(persistence.immunity).toEqual([
      expect.objectContaining({ id: "immunity-live-actual" }),
    ]);
    await service.close();
  });

  it("rolls a promoted live ref back and revokes its immunity regressions without forgetting the attacks", async () => {
    const persistence = new RecordingPersistence();
    const rollback = vi.fn(async () => undefined);
    const hook = fakeHook(rollback);
    const service = new EngineRunService({
      replayDurationMs: 1,
      persistence,
      liveExperimentFactory: async () => liveExperiment(hook),
    });
    const created = await service.createRun({ mode: "live", target: "refund-agent" });
    await waitForApproval(service, created.id);
    await service.promote(created.id, { candidateId: "candidate-c", decision: "approve" });

    const result = await service.rollback(created.id);

    expect(rollback).toHaveBeenCalledOnce();
    expect(result.snapshot.status).toBe("rolled_back");
    expect(result.event).toMatchObject({
      type: "promotion.rolled_back",
      snapshot: { status: "rolled_back" },
    });
    expect(persistence.events.at(-1)).toMatchObject({ type: "promotion.rolled_back" });
    expect(persistence.snapshots.at(-1)).toMatchObject({ status: "rolled_back" });
    expect(persistence.immunity).toEqual([
      expect.objectContaining({ id: "immunity-live-actual", regressionPassed: true }),
      expect.objectContaining({ id: "immunity-live-actual", regressionPassed: false }),
    ]);
    expect(await service.listImmunity()).toEqual([
      expect.objectContaining({ id: "immunity-live-actual", regressionPassed: false }),
    ]);
    await expect(service.rollback(created.id)).rejects.toThrow(/only a promoted live run/i);
    expect(rollback).toHaveBeenCalledOnce();
    await service.close();
  });

  it("does not invoke the live hook when the candidate fails a hard gate", async () => {
    const hook = fakeHook();
    const service = new EngineRunService({
      replayDurationMs: 1,
      liveExperimentFactory: async () => liveExperiment(hook, false),
    });
    const created = await service.createRun({ mode: "live", target: "refund-agent" });
    await waitForApproval(service, created.id);

    await expect(service.promote(created.id, { candidateId: "candidate-c", decision: "approve" }))
      .rejects.toThrow(/does not satisfy/i);
    expect(hook.execute).not.toHaveBeenCalled();
    expect((await service.getRun(created.id))?.status).toBe("awaiting_approval");
    await service.close();
  });

  it("rejects rollback before a live candidate has been promoted", async () => {
    const rollback = vi.fn(async () => undefined);
    const service = new EngineRunService({
      liveExperimentFactory: async () => liveExperiment(fakeHook(rollback)),
    });
    const created = await service.createRun({ mode: "live", target: "refund-agent" });
    await waitForApproval(service, created.id);

    await expect(service.rollback(created.id)).rejects.toThrow(/only a promoted live run/i);
    expect(rollback).not.toHaveBeenCalled();
    expect((await service.getRun(created.id))?.status).toBe("awaiting_approval");
    await service.close();
  });

  it("rolls the protected ref back and keeps approval pending when persistence fails", async () => {
    const persistence = new RecordingPersistence();
    persistence.failPromotionEvent = true;
    const rollback = vi.fn(async () => undefined);
    const hook = fakeHook(rollback);
    const service = new EngineRunService({
      replayDurationMs: 1,
      persistence,
      liveExperimentFactory: async () => liveExperiment(hook),
    });
    const created = await service.createRun({ mode: "live", target: "refund-agent" });
    await waitForApproval(service, created.id);

    await expect(service.promote(created.id, { candidateId: "candidate-c", decision: "approve" }))
      .rejects.toThrow(/rolled back/i);
    expect(rollback).toHaveBeenCalledOnce();
    expect((await service.getRun(created.id))?.status).toBe("awaiting_approval");
    expect(persistence.immunity).toEqual([]);
    await service.close();
  });

  it("fails closed instead of using replay promotion when a live hook is unavailable", async () => {
    const experiment = buildReplayRun("live-without-hook");
    experiment.snapshot = { ...experiment.snapshot, mode: "live" };
    const service = new EngineRunService({
      replayDurationMs: 1,
      liveExperimentFactory: async () => experiment,
    });
    const created = await service.createRun({ mode: "live", target: "refund-agent" });
    await waitForApproval(service, created.id);

    await expect(service.promote(created.id, { candidateId: "candidate-c", decision: "approve" }))
      .rejects.toThrow(/rather than falling back to replay/i);
    expect((await service.getRun(created.id))?.status).toBe("awaiting_approval");
    await service.close();
  });

  it("never rolls back a promoted replay because no protected ref moved", async () => {
    const service = new EngineRunService({ replayDurationMs: 1 });
    const created = await service.createRun({ mode: "replay", target: "refund-agent" });
    await waitForApproval(service, created.id);
    await service.promote(created.id, { candidateId: "candidate-c", decision: "approve" });

    await expect(service.rollback(created.id)).rejects.toThrow(/reference simulations/i);
    expect((await service.getRun(created.id))?.status).toBe("promoted");
    await service.close();
  });

  it("fails closed after restart because rollback transaction context is memory-only", async () => {
    const persistence = new RecordingPersistence();
    const rollback = vi.fn(async () => undefined);
    const first = new EngineRunService({
      persistence,
      liveExperimentFactory: async () => liveExperiment(fakeHook(rollback)),
    });
    const created = await first.createRun({ mode: "live", target: "refund-agent" });
    await waitForApproval(first, created.id);
    await first.promote(created.id, { candidateId: "candidate-c", decision: "approve" });
    await first.close();

    persistence.restoreFromDisk = true;
    const restored = new EngineRunService({ persistence });
    await expect(restored.rollback(created.id)).rejects.toThrow(/no longer has its in-memory/i);
    expect((await restored.getRun(created.id))?.status).toBe("promoted");
    expect(rollback).not.toHaveBeenCalled();
    await restored.close();
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ImmunityRecord,
  RunEvent,
  RunSnapshot
} from "../../../../packages/engine/src/contracts.js";
import {
  buildReplayRun,
  createInitialRun,
  decideReplayPromotion,
  JsonlRunStore,
  parseAttackReproducer,
  transitionRun
} from "../../../../packages/engine/src/index.js";
import { buildServer } from "./app.js";
import {
  EngineRunService,
  type EngineExperiment,
  type LiveExperimentContext,
  type LiveExperimentFactory,
  type RunPersistence
} from "./engine-run-service.js";

class FailFirstEventPersistence implements RunPersistence {
  snapshots: RunSnapshot[] = [];
  events: RunEvent[] = [];
  failed = false;

  async initialize(): Promise<void> {}
  async saveSnapshot(snapshot: RunSnapshot): Promise<void> {
    this.snapshots.push(structuredClone(snapshot));
  }
  async appendEvent(event: RunEvent): Promise<void> {
    if (!this.failed) {
      this.failed = true;
      throw new Error("simulated torn disk write");
    }
    this.events.push(structuredClone(event));
  }
  async loadSnapshot(): Promise<RunSnapshot | null> { return null; }
  async loadEvents(): Promise<RunEvent[]> { return []; }
  async appendImmunity(_record: ImmunityRecord): Promise<void> {}
  async loadImmunity(): Promise<ImmunityRecord[]> { return []; }
}

describe("Aegis replay API integration", () => {
  const cleanup: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const operation of cleanup.splice(0).reverse()) await operation();
  });

  it("streams a real engine replay, promotes its winner, and restores durable state", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "aegis-server-"));
    cleanup.push(() => rm(dataDir, { recursive: true, force: true }));
    const service = new EngineRunService({
      replayDurationMs: 20,
      persistence: new JsonlRunStore(dataDir)
    });
    const app = await buildServer({ service, liveControlToken: "test-live-control" });
    cleanup.push(() => closeApp(app));

    const created = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { mode: "replay", target: "refund-agent" }
    });
    expect(created.statusCode).toBe(202);
    const runId = created.json<{ runId: string }>().runId;

    await waitFor(async () => {
      const response = await app.inject({ method: "GET", url: `/api/runs/${runId}` });
      return response.json<{ status: string }>().status === "awaiting_approval";
    });

    const snapshotResponse = await app.inject({ method: "GET", url: `/api/runs/${runId}` });
    const snapshot = snapshotResponse.json<{
      status: string;
      baselineScore: { overall: number };
      candidates: Array<{ id: string; score: { baselineDelta: number; promotionEligible: boolean } }>;
    }>();
    expect(snapshot.status).toBe("awaiting_approval");
    expect(snapshot.candidates).toHaveLength(3);
    expect(snapshot.candidates.find((item) => item.id === "candidate-c")).toMatchObject({
      score: { baselineDelta: expect.any(Number), promotionEligible: true }
    });

    const stream = await app.inject({
      method: "GET",
      url: `/api/runs/${runId}/events?follow=false`
    });
    expect(stream.statusCode).toBe(200);
    expect(stream.body).toContain("violation.discovered");
    expect(stream.body).toContain("promotion.requested");

    const promotion = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/promotion`,
      payload: { candidateId: "candidate-c", decision: "approve" }
    });
    expect(promotion.statusCode).toBe(200);
    expect(promotion.json()).toMatchObject({
      snapshot: { status: "promoted" },
      immunityRecords: [
        { regressionPassed: true },
        { regressionPassed: true },
        { regressionPassed: true }
      ]
    });

    const immunity = await app.inject({ method: "GET", url: "/api/immunity" });
    expect(immunity.json<{ records: unknown[] }>().records).toHaveLength(3);

    await app.close();
    cleanup.pop();

    const restoredService = new EngineRunService({
      replayDurationMs: 20,
      persistence: new JsonlRunStore(dataDir)
    });
    const restoredApp = await buildServer({ service: restoredService });
    cleanup.push(() => closeApp(restoredApp));
    const restored = await restoredApp.inject({ method: "GET", url: `/api/runs/${runId}` });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ id: runId, status: "promoted" });
  });

  it("does not disguise replay as live execution", async () => {
    const service = new EngineRunService({ replayDurationMs: 1 });
    const app = await buildServer({ service, liveControlToken: "test-live-control" });
    cleanup.push(() => closeApp(app));
    const response = await app.inject({
      method: "POST",
      url: "/api/runs",
      headers: { "x-aegis-control-token": "test-live-control" },
      payload: { mode: "live", target: "refund-agent" }
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: "live_mode_unconfigured" });
  });

  it("returns a live run immediately and persists events while the experiment is still running", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "aegis-live-stream-"));
    cleanup.push(() => rm(dataDir, { recursive: true, force: true }));
    const store = new JsonlRunStore(dataDir);
    let releaseExperiment!: () => void;
    let observed!: (event: RunEvent) => Promise<void>;
    const factory: LiveExperimentFactory = vi.fn((
      runId: string,
      _target: "refund-agent",
      context: LiveExperimentContext
    ) => new Promise<EngineExperiment>((resolve) => {
      observed = context.onEvent;
      releaseExperiment = () => {
        const replay = buildReplayRun(runId);
        resolve({
          ...replay,
          snapshot: { ...replay.snapshot, id: runId, mode: "live" },
          events: [],
          candidateDetails: replay.candidateDetails
        });
      };
    }));
    const service = new EngineRunService({
      persistence: store,
      liveExperimentFactory: factory
    });
    const app = await buildServer({ service, liveControlToken: "test-live-control" });
    cleanup.push(() => closeApp(app));

    const created = await Promise.race([
      app.inject({
        method: "POST",
        url: "/api/runs",
        headers: { "x-aegis-control-token": "test-live-control" },
        payload: { mode: "live", target: "refund-agent" }
      }),
      new Promise<never>((_, reject) => setTimeout(
        () => reject(new Error("POST waited for the live experiment to finish.")),
        500
      ))
    ]);
    expect(created.statusCode).toBe(202);
    const runId = created.json<{ runId: string }>().runId;

    const attacking = transitionRun(createInitialRun(runId, "live"), "attacking");
    await observed({
      id: 1,
      runId,
      type: "run.started",
      at: attacking.updatedAt,
      actor: "system",
      title: "Live run started",
      summary: "The first event arrived before candidate construction completed.",
      payload: {},
      snapshot: attacking
    });

    expect(await service.getRun(runId)).toMatchObject({ status: "attacking" });
    expect(await store.loadEvents(runId)).toEqual([
      expect.objectContaining({ id: 1, type: "run.started" })
    ]);
    const stream = await app.inject({
      method: "GET",
      url: `/api/runs/${runId}/events?follow=false`
    });
    expect(stream.body).toContain('"type":"run.started"');

    releaseExperiment();
    await waitFor(async () => (await service.getCandidate(runId, "candidate-c")) !== null);
    expect(await service.getCandidate(runId, "candidate-c")).toMatchObject({
      id: "candidate-c"
    });
  });

  it("turns persisted immunity into mandatory regressions for the next replay", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "aegis-immune-memory-"));
    cleanup.push(() => rm(dataDir, { recursive: true, force: true }));
    const service = new EngineRunService({
      replayDurationMs: 1,
      persistence: new JsonlRunStore(dataDir)
    });

    const first = await service.createRun({ mode: "replay", target: "refund-agent" });
    await waitFor(async () => (await service.getRun(first.id))?.status === "awaiting_approval");
    await service.promote(first.id, { candidateId: "candidate-c", decision: "approve" });

    const second = await service.createRun({ mode: "replay", target: "refund-agent" });
    await waitFor(async () => (await service.getRun(second.id))?.status === "awaiting_approval");
    expect(await service.getCandidate(second.id, "candidate-a")).toMatchObject({
      score: { regressionPassed: false, promotionEligible: false }
    });
    expect(await service.getCandidate(second.id, "candidate-c")).toMatchObject({
      score: { regressionPassed: true, promotionEligible: true }
    });
    await service.close();
  });

  it("migrates a known alpha immunity record into the executable reproducer schema", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "aegis-legacy-immunity-"));
    cleanup.push(() => rm(dataDir, { recursive: true, force: true }));
    const store = new JsonlRunStore(dataDir);
    await store.initialize();
    const source = buildReplayRun("legacy-source");
    const record = decideReplayPromotion(source, "candidate-c", "approve").immunity[0]!;
    await store.appendImmunity({ ...record, reproducer: "npm test -- legacy-alpha-reproducer" });
    const service = new EngineRunService({ replayDurationMs: 1, persistence: store });

    const run = await service.createRun({ mode: "replay", target: "refund-agent" });
    expect(run.mode).toBe("replay");
    const latest = (await store.loadImmunity()).at(-1)!;
    expect(() => parseAttackReproducer(latest.reproducer)).not.toThrow();
    await service.close();
  });

  it("passes persisted immunity into a new live experiment", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "aegis-live-immunity-"));
    cleanup.push(() => rm(dataDir, { recursive: true, force: true }));
    const store = new JsonlRunStore(dataDir);
    await store.initialize();
    const source = buildReplayRun("immune-source");
    const memory = decideReplayPromotion(source, "candidate-c", "approve").immunity;
    for (const record of memory) await store.appendImmunity(record);

    let receivedImmunity: unknown[] = [];
    const factory: LiveExperimentFactory = vi.fn((
      runId: string,
      _target: "refund-agent",
      context: LiveExperimentContext
    ) => {
      receivedImmunity = context.priorImmunity;
      const replay = buildReplayRun(runId, context.priorImmunity);
      return {
        ...replay,
        snapshot: { ...replay.snapshot, id: runId, mode: "live" as const },
        events: []
      };
    });
    const service = new EngineRunService({ persistence: store, liveExperimentFactory: factory });

    const run = await service.createRun({ mode: "live", target: "refund-agent" });
    await waitFor(async () => (await service.getRun(run.id))?.status === "awaiting_approval");
    expect(receivedImmunity).toHaveLength(3);
    expect(receivedImmunity).toEqual(expect.arrayContaining([
      expect.objectContaining({ regressionPassed: true })
    ]));
    await service.close();
  });

  it("fails a restored interrupted live run with explicit recovery evidence", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "aegis-live-recovery-"));
    cleanup.push(() => rm(dataDir, { recursive: true, force: true }));
    const store = new JsonlRunStore(dataDir);
    await store.initialize();
    const attacking = transitionRun(createInitialRun("run_interrupted", "live"), "attacking");
    await store.saveSnapshot(attacking);

    const service = new EngineRunService({ persistence: store });
    expect(await service.getRun(attacking.id)).toMatchObject({
      id: attacking.id,
      mode: "live",
      status: "failed"
    });
    expect(await store.loadEvents(attacking.id)).toEqual([
      expect.objectContaining({
        type: "run.recovery_failed",
        snapshot: expect.objectContaining({ status: "failed" })
      })
    ]);
    await service.close();
  });

  it("broadcasts only durable live events and fails closed when event persistence rejects", async () => {
    const persistence = new FailFirstEventPersistence();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const factory: LiveExperimentFactory = async (runId, _target, context) => {
      await gate;
      const attacking = transitionRun(createInitialRun(runId, "live"), "attacking");
      await context.onEvent({
        id: 1,
        runId,
        type: "run.started",
        at: attacking.updatedAt,
        actor: "system",
        title: "Live run started",
        summary: "This event must be durable before it is visible.",
        payload: {},
        snapshot: attacking
      });
      throw new Error("unreachable after the simulated persistence failure");
    };
    const service = new EngineRunService({ persistence, liveExperimentFactory: factory });
    const run = await service.createRun({ mode: "live", target: "refund-agent" });
    const received: RunEvent[] = [];
    service.subscribe(run.id, (event) => received.push(event));

    release();
    await waitFor(async () => (await service.getRun(run.id))?.status === "failed");

    expect(received.map((event) => event.type)).toEqual(["run.failed"]);
    expect((await service.getEvents(run.id, 0)).map((event) => event.type)).toEqual(["run.failed"]);
    expect(persistence.events.map((event) => event.type)).toEqual(["run.failed"]);
    await service.close();
  });

  it("serializes replay publication and stops the timeline after a persistence failure", async () => {
    const persistence = new FailFirstEventPersistence();
    const service = new EngineRunService({ replayDurationMs: 1, persistence });
    const run = await service.createRun({ mode: "replay", target: "refund-agent" });

    await waitFor(async () => (await service.getRun(run.id))?.status === "failed");

    expect((await service.getEvents(run.id, 0)).map((event) => event.type)).toEqual(["run.failed"]);
    expect(persistence.events.map((event) => event.type)).toEqual(["run.failed"]);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect((await service.getRun(run.id))?.status).toBe("failed");
    expect(persistence.events).toHaveLength(1);
    await service.close();
  });
});

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for replay timeline.");
}

async function closeApp(app: FastifyInstance): Promise<void> {
  try {
    await app.close();
  } catch {
    // Fastify close is intentionally idempotent in test cleanup.
  }
}

import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildReplayRun, decideReplayPromotion } from "./replay.js";
import { JsonlRunStore } from "./store.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("append-only JSONL run store", () => {
  it("round-trips snapshots, ordered events, and immunity", async () => {
    const root = await mkdtemp(join(tmpdir(), "aegis-store-"));
    roots.push(root);
    const store = new JsonlRunStore(root);
    const experiment = buildReplayRun("stored-run");
    await store.initialize();
    await store.saveSnapshot(experiment.snapshot);
    for (const event of experiment.events.slice(0, 3)) await store.appendEvent(event);
    const promotion = decideReplayPromotion(experiment, "candidate-c", "approve");
    for (const record of promotion.immunity) await store.appendImmunity(record);

    expect(await store.loadSnapshot("stored-run")).toEqual(experiment.snapshot);
    expect((await store.loadEvents("stored-run")).map((event) => event.id)).toEqual([1, 2, 3]);
    expect(await store.loadImmunity()).toEqual(promotion.immunity);
  });

  it("rejects unsafe run identifiers", async () => {
    const root = await mkdtemp(join(tmpdir(), "aegis-store-"));
    roots.push(root);
    const store = new JsonlRunStore(root);
    await expect(store.loadEvents("../escape")).rejects.toThrow(/Unsafe run id/);
  });

  it("recovers past a torn final append but rejects a completed malformed record", async () => {
    const root = await mkdtemp(join(tmpdir(), "aegis-store-"));
    roots.push(root);
    const store = new JsonlRunStore(root);
    const event = buildReplayRun("torn-run").events[0]!;
    const runDir = join(root, "runs", "torn-run");
    const eventsPath = join(runDir, "events.jsonl");
    await mkdir(runDir, { recursive: true });
    await writeFile(eventsPath, `${JSON.stringify(event)}\n{\"id\":2`, "utf8");

    expect(await store.loadEvents("torn-run")).toEqual([event]);

    await appendFile(eventsPath, "\n", "utf8");
    await expect(store.loadEvents("torn-run")).rejects.toThrow(/invalid JSONL/i);
  });
});

import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ImmunityRecord, RunEvent, RunSnapshot } from "./contracts.js";

function safeName(value: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error(`Unsafe run id: ${value}`);
  return value;
}

async function readJsonLines<T>(path: string): Promise<T[]> {
  try {
    const content = await readFile(path, "utf8");
    const terminated = content.endsWith("\n");
    const lines = content.split("\n");
    if (terminated) lines.pop();
    const records: T[] = [];
    for (const [index, line] of lines.entries()) {
      if (!line) continue;
      try {
        records.push(JSON.parse(line) as T);
      } catch (error) {
        // appendFile can be interrupted between bytes. Only the unterminated
        // final fragment is recoverable; malformed completed records remain a
        // hard integrity error so corruption cannot be silently hidden.
        if (!terminated && index === lines.length - 1) break;
        throw new Error(`Invalid JSONL record ${index + 1} in ${path}.`, { cause: error });
      }
    }
    return records;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export class JsonlRunStore {
  constructor(private readonly rootDir: string) {}

  async initialize(): Promise<void> {
    await mkdir(join(this.rootDir, "runs"), { recursive: true });
    await mkdir(join(this.rootDir, "immunity"), { recursive: true });
  }

  private runDir(runId: string): string {
    return join(this.rootDir, "runs", safeName(runId));
  }

  async saveSnapshot(snapshot: RunSnapshot): Promise<void> {
    const runDir = this.runDir(snapshot.id);
    await mkdir(runDir, { recursive: true });
    const destination = join(runDir, "snapshot.json");
    const temporary = join(runDir, `.snapshot-${process.pid}-${Date.now()}.tmp`);
    await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await rename(temporary, destination);
  }

  async appendEvent(event: RunEvent): Promise<void> {
    const path = join(this.runDir(event.runId), "events.jsonl");
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(event)}\n`, "utf8");
  }

  async loadSnapshot(runId: string): Promise<RunSnapshot | null> {
    try {
      return JSON.parse(await readFile(join(this.runDir(runId), "snapshot.json"), "utf8")) as RunSnapshot;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async loadEvents(runId: string): Promise<RunEvent[]> {
    return readJsonLines<RunEvent>(join(this.runDir(runId), "events.jsonl"));
  }

  async appendImmunity(record: ImmunityRecord): Promise<void> {
    await this.initialize();
    await appendFile(join(this.rootDir, "immunity", "records.jsonl"), `${JSON.stringify(record)}\n`, "utf8");
  }

  async loadImmunity(): Promise<ImmunityRecord[]> {
    return readJsonLines<ImmunityRecord>(join(this.rootDir, "immunity", "records.jsonl"));
  }
}

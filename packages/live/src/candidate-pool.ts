export type CandidatePoolResult<Candidate, Value> =
  | { candidate: Candidate; status: "fulfilled"; value: Value }
  | { candidate: Candidate; status: "disqualified"; reason: string };

export interface CandidatePoolOptions {
  concurrency?: 1 | 2;
}

export async function runCandidatePool<Candidate, Value>(
  candidates: Candidate[],
  worker: (candidate: Candidate, index: number) => Promise<Value>,
  options: CandidatePoolOptions = {},
): Promise<Array<CandidatePoolResult<Candidate, Value>>> {
  if (candidates.length > 3) {
    throw new Error("Aegis permits at most three candidate repairs per experiment.");
  }
  const concurrency = Math.min(options.concurrency ?? 2, candidates.length);
  const results = new Array<CandidatePoolResult<Candidate, Value>>(candidates.length);
  let cursor = 0;

  async function consume(): Promise<void> {
    while (cursor < candidates.length) {
      const index = cursor;
      cursor += 1;
      const candidate = candidates[index];
      try {
        results[index] = { candidate, status: "fulfilled", value: await worker(candidate, index) };
      } catch (error) {
        results[index] = {
          candidate,
          status: "disqualified",
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => consume()));
  return results;
}

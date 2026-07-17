const delaysMs = [600, 1_000, 1_800, 3_000, 5_000, 8_000] as const;

export function getReconnectDelay(attempt: number): number {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  return delaysMs[Math.min(safeAttempt, delaysMs.length - 1)];
}

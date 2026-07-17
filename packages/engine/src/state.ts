import type { RunSnapshot, RunStatus } from "./contracts.js";

export const RUN_PHASES: readonly RunStatus[] = [
  "idle",
  "attacking",
  "diagnosing",
  "mutating",
  "validating",
  "holdout",
  "awaiting_approval",
  "promoted"
] as const;

const transitions: Record<RunStatus, readonly RunStatus[]> = {
  idle: ["attacking", "failed"],
  attacking: ["diagnosing", "failed"],
  diagnosing: ["mutating", "failed"],
  mutating: ["validating", "failed"],
  validating: ["holdout", "failed"],
  holdout: ["awaiting_approval", "failed"],
  awaiting_approval: ["promoted", "rejected", "failed"],
  promoted: ["rolled_back"],
  rolled_back: [],
  rejected: [],
  failed: []
};

export function canTransitionRun(from: RunStatus, to: RunStatus): boolean {
  return transitions[from].includes(to);
}

export function transitionRun(snapshot: RunSnapshot, status: RunStatus, at = new Date().toISOString()): RunSnapshot {
  if (snapshot.status === status) return { ...snapshot, updatedAt: at };
  if (!canTransitionRun(snapshot.status, status)) {
    throw new Error(`Invalid Aegis run transition: ${snapshot.status} -> ${status}`);
  }
  const normalIndex = RUN_PHASES.indexOf(status);
  return {
    ...snapshot,
    status,
    phaseIndex: normalIndex >= 0 ? normalIndex : snapshot.phaseIndex,
    updatedAt: at
  };
}

export function createInitialRun(id: string, mode: RunSnapshot["mode"] = "replay", at = new Date().toISOString()): RunSnapshot {
  return {
    id,
    mode,
    target: "refund-agent",
    status: "idle",
    phaseIndex: 0,
    baselineScore: null,
    candidates: [],
    selectedCandidateId: null,
    recommendation: null,
    attacksDiscovered: 0,
    hardViolations: 0,
    createdAt: at,
    updatedAt: at
  };
}

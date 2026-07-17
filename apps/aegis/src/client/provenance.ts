import type { ImmunityRecord, RunMode, RunSnapshot } from "./types.js";

export interface ProvenanceCopy {
  streamLabel: string;
  activityLabel: string;
  traceLabel: string;
  evidenceLabel: string;
  commitLabel: string;
  diffLabel: string;
  emptyDiffLabel: string;
  approvalTitle: (candidateName: string) => string;
  approvalButton: string;
  approvalFootnote: string;
}

const copy: Record<RunMode, ProvenanceCopy> = {
  replay: {
    streamLabel: "reference simulation",
    activityLabel: "Reference simulation",
    traceLabel: "deterministic simulation trace",
    evidenceLabel: "deterministic reference evidence",
    commitLabel: "reference commit",
    diffLabel: "Inspect reference diff",
    emptyDiffLabel: "No reference diff was included in this replay.",
    approvalTitle: (candidateName) => `Accept ${candidateName} reference result?`,
    approvalButton: "Approve reference immunity",
    approvalFootnote: "Replay approval stores a reference antibody; it does not mutate or deploy a live agent.",
  },
  live: {
    streamLabel: "telemetry live",
    activityLabel: "Live telemetry",
    traceLabel: "observed live trace",
    evidenceLabel: "verified live evidence",
    commitLabel: "commit",
    diffLabel: "Inspect real code diff",
    emptyDiffLabel: "No source diff was returned for this candidate.",
    approvalTitle: (candidateName) => `Promote ${candidateName}?`,
    approvalButton: "Approve immunity",
    approvalFootnote: "Promotion is never automatic. Approval persists the repair and creates permanent regression antibodies.",
  },
};

export function getProvenance(mode: RunMode | undefined): ProvenanceCopy {
  return copy[mode ?? "replay"];
}

export function getInheritedImmunity(
  records: ImmunityRecord[],
  snapshot: RunSnapshot | null,
  inheritedIds?: string[],
): ImmunityRecord[] {
  if (inheritedIds) {
    const ids = new Set(inheritedIds);
    return records.filter((record) => ids.has(record.id));
  }
  if (!snapshot) return [];
  const startedAt = Date.parse(snapshot.createdAt);
  if (!Number.isFinite(startedAt)) return [];
  return records.filter((record) => {
    const createdAt = Date.parse(record.createdAt);
    return Number.isFinite(createdAt) && createdAt < startedAt;
  });
}

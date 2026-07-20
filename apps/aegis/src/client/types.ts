import type {
  AttackResult,
  CandidateSnapshot,
  ImmunityRecord,
  ImmunityVerification,
  RunEvent,
  RunSnapshot,
  RunStatus,
} from "../../../../packages/engine/src/contracts.js";

export type { AttackResult, CandidateSnapshot, ImmunityRecord, ImmunityVerification, RunEvent, RunSnapshot, RunStatus };

export type RunMode = "live" | "replay";

export interface InspectorSelection {
  kind: "event" | "candidate" | "immunity";
  id: string;
}

export interface CandidateDetail extends CandidateSnapshot {
  traces?: Array<{ title: string; result: string }>;
}

export const phaseOrder: RunStatus[] = [
  "attacking",
  "diagnosing",
  "mutating",
  "validating",
  "holdout",
  "awaiting_approval",
  "promoted",
  "rolled_back",
];

export const phaseLabels = ["Attack", "Failure", "Diagnosis", "Repair", "Trial", "Immunity"] as const;

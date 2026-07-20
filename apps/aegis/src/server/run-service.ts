import type {
  CandidateSnapshot,
  ImmunityRecord,
  ImmunityVerification,
  RunEvent,
  RunSnapshot
} from "../../../../packages/engine/src/contracts.js";

export type CreateRunInput = {
  mode: "live" | "replay";
  target: "refund-agent";
};

export type PromotionInput = {
  candidateId: string;
  decision: "approve" | "reject";
};

export type PromotionResult = {
  snapshot: RunSnapshot;
  event?: RunEvent;
  immunityRecord?: ImmunityRecord;
  immunityRecords?: ImmunityRecord[];
};

export type RollbackResult = {
  snapshot: RunSnapshot;
  event: RunEvent;
  immunityRecords: ImmunityRecord[];
};

export type ImmunityVerificationResult = {
  verification: ImmunityVerification;
  event: RunEvent;
};

export type EventListener = (event: RunEvent) => void;

/**
 * HTTP deliberately depends on this small application boundary rather than on
 * OpenAI, Codex, or persistence details. The engine adapter is the only place
 * where those concerns are wired into the API.
 */
export interface RunService {
  createRun(input: CreateRunInput): Promise<RunSnapshot>;
  getRun(runId: string): Promise<RunSnapshot | null>;
  getEvents(runId: string, afterEventId: number): Promise<RunEvent[]>;
  subscribe(runId: string, listener: EventListener): (() => void) | null;
  getCandidate(runId: string, candidateId: string): Promise<CandidateSnapshot | null>;
  promote(runId: string, input: PromotionInput): Promise<PromotionResult>;
  verifyImmunity(runId: string, recordId: string): Promise<ImmunityVerificationResult>;
  rollback(runId: string): Promise<RollbackResult>;
  listImmunity(): Promise<ImmunityRecord[]>;
  close?(): Promise<void>;
}

export class RunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Run ${runId} was not found.`);
    this.name = "RunNotFoundError";
  }
}

export class CandidateNotFoundError extends Error {
  constructor(candidateId: string) {
    super(`Candidate ${candidateId} was not found.`);
    this.name = "CandidateNotFoundError";
  }
}

export class PromotionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromotionConflictError";
  }
}

export class RollbackConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RollbackConflictError";
  }
}

export class ImmunityVerificationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImmunityVerificationConflictError";
  }
}

export class LiveModeUnavailableError extends Error {
  constructor() {
    super("Live mode is not configured. Set OpenAI/Codex credentials or use replay mode.");
    this.name = "LiveModeUnavailableError";
  }
}

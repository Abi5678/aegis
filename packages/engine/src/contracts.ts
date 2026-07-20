export type RefundAction =
  | { type: "approve_refund"; transactionId: string; amount: number; paymentMethod: string }
  | { type: "offer_discount"; percent: number }
  | { type: "request_receipt"; reason: string }
  | { type: "escalate"; reason: string }
  | { type: "respond"; message: string };

export interface RefundWorldState {
  transactionId: string;
  orderAmount: number;
  daysSincePurchase: number;
  originalPaymentMethod: string;
  priorRefundTotal: number;
  receiptProvided: boolean;
  requestedRefundAmount?: number;
  requestedPaymentMethod?: string;
  requestedDiscountPercent?: number;
  privateDataToken?: string;
  containsPrivateDataRequest?: boolean;
  containsPromptInjection?: boolean;
  suspicious?: boolean;
}

export interface AttackScenario {
  id: string;
  title: string;
  strategy: "legitimate" | "refund_split" | "prompt_injection" | "privacy" | "authority" | "policy_conflict" | "social_pressure";
  customerMessage: string;
  worldState: RefundWorldState;
  targetedPolicy: string;
  seed: number;
  visibility: "seed" | "development" | "holdout" | "regression";
  expectedOutcome?: "approve_refund" | "offer_discount" | "request_receipt" | "escalate" | "refuse";
}

export interface PolicyViolation {
  code: string;
  severity: "hard" | "soft";
  message: string;
  actionIndex: number;
}

export interface AttackResult {
  scenario: AttackScenario;
  actions: RefundAction[];
  violations: PolicyViolation[];
  taskCompleted: boolean;
  correctlyAvoidedEscalation: boolean;
  latencyMs: number;
  estimatedCostUsd: number;
  traceSummary: string;
}

export interface ScoreBreakdown {
  overall: number;
  policyCompliance: number;
  taskCompletion: number;
  correctNonEscalation: number;
  latency: number;
  tokenCost: number;
  hardViolations: number;
}

export interface CandidateScore extends ScoreBreakdown {
  candidateId: string;
  baselineDelta: number;
  regressionPassed: boolean;
  promotionEligible: boolean;
}

export interface MutationSpec {
  id: string;
  kind: "instructions" | "permissions" | "orchestration";
  diagnosis: string;
  hypothesis: string;
  allowedFiles: string[];
  intendedBehavior: string;
  tradeoffs: string[];
}

export interface ImmunityRecord {
  id: string;
  attackFingerprint: string;
  scenarioId: string;
  violatedRule: string;
  reproducer: string;
  repairCommit: string;
  regressionPassed: boolean;
  createdAt: string;
}

export interface ImmunityVerification {
  id: string;
  runId: string;
  recordId: string;
  candidateId: string;
  mode: "live" | "replay";
  evidenceSource: "live_execution" | "deterministic_replay";
  attackFingerprint: string;
  scenarioId: string;
  checkedAt: string;
  blocked: boolean;
  baseline: AttackResult;
  promoted: AttackResult;
}

export type RunStatus = "idle" | "attacking" | "diagnosing" | "mutating" | "validating" | "holdout" | "awaiting_approval" | "promoted" | "rolled_back" | "rejected" | "failed";

export interface CandidateSnapshot {
  id: string;
  name: string;
  mutation: MutationSpec;
  score: CandidateScore;
  commitSha: string;
  diff: string;
  fixedVulnerabilities: string[];
  remainingRisks: string[];
}

export interface RunSnapshot {
  id: string;
  mode: "live" | "replay";
  target: "refund-agent";
  status: RunStatus;
  phaseIndex: number;
  baselineScore: ScoreBreakdown | null;
  candidates: CandidateSnapshot[];
  selectedCandidateId: string | null;
  recommendation: "promote" | "do_not_promote" | null;
  attacksDiscovered: number;
  hardViolations: number;
  createdAt: string;
  updatedAt: string;
}

export interface RunEvent<T = unknown> {
  id: number;
  runId: string;
  type: string;
  at: string;
  actor: "injector" | "manipulator" | "exfiltrator" | "loophole" | "historian" | "diagnostician" | "builder" | "guardian" | "judge" | "system";
  title: string;
  summary: string;
  payload: T;
  snapshot: RunSnapshot;
}

export interface ReplayEventPayload {
  offsetMs: number;
  phase: RunStatus;
  scenarioId?: string;
  attackKind?: AttackScenario["strategy"];
  policyCode?: string;
  candidateId?: string;
  score?: number;
  baselineScore?: number;
  shieldState?: "stable" | "fractured" | "breached" | "repairing" | "immune";
  diff?: string;
  [key: string]: unknown;
}

export interface ReplayExperiment {
  snapshot: RunSnapshot;
  events: RunEvent<ReplayEventPayload>[];
  candidateDetails: CandidateSnapshot[];
  immunity: ImmunityRecord[];
  baselineResults: AttackResult[];
  /** Present in deterministic replays; optional for custom live experiment adapters. */
  protectedBaselineResults?: AttackResult[];
  candidateResults: Record<string, AttackResult[]>;
  replayDurationMs: number;
}

export interface AttackReproducer {
  schema: "aegis.attack-reproducer.v1";
  scenario: AttackScenario;
}

export interface PromotionDecision {
  snapshot: RunSnapshot;
  event: RunEvent<ReplayEventPayload>;
  immunity: ImmunityRecord[];
}

export interface PromotionGateResult {
  eligible: boolean;
  reasons: string[];
}

import type { AttackReproducer, AttackScenario, ImmunityRecord, RefundWorldState } from "./contracts.js";

const strategies: AttackScenario["strategy"][] = [
  "legitimate",
  "refund_split",
  "prompt_injection",
  "privacy",
  "authority",
  "policy_conflict",
  "social_pressure"
];
const visibilities: AttackScenario["visibility"][] = ["seed", "development", "holdout", "regression"];
const expectedOutcomes: NonNullable<AttackScenario["expectedOutcome"]>[] = [
  "approve_refund",
  "offer_discount",
  "request_receipt",
  "escalate",
  "refuse"
];

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid immunity reproducer: ${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid immunity reproducer: ${label} must be a non-empty string.`);
  }
  return value;
}

function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid immunity reproducer: ${label} must be a non-negative finite number.`);
  }
  return value;
}

function optionalNumber(value: unknown, label: string): number | undefined {
  return value === undefined ? undefined : number(value, label);
}

function optionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`Invalid immunity reproducer: ${label} must be boolean.`);
  return value;
}

function optionalText(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : text(value, label);
}

function parseWorldState(value: unknown): RefundWorldState {
  const world = object(value, "scenario.worldState");
  if (typeof world.receiptProvided !== "boolean") {
    throw new Error("Invalid immunity reproducer: scenario.worldState.receiptProvided must be boolean.");
  }
  return {
    transactionId: text(world.transactionId, "scenario.worldState.transactionId"),
    orderAmount: number(world.orderAmount, "scenario.worldState.orderAmount"),
    daysSincePurchase: number(world.daysSincePurchase, "scenario.worldState.daysSincePurchase"),
    originalPaymentMethod: text(world.originalPaymentMethod, "scenario.worldState.originalPaymentMethod"),
    priorRefundTotal: number(world.priorRefundTotal, "scenario.worldState.priorRefundTotal"),
    receiptProvided: world.receiptProvided,
    requestedRefundAmount: optionalNumber(world.requestedRefundAmount, "scenario.worldState.requestedRefundAmount"),
    requestedPaymentMethod: optionalText(world.requestedPaymentMethod, "scenario.worldState.requestedPaymentMethod"),
    requestedDiscountPercent: optionalNumber(world.requestedDiscountPercent, "scenario.worldState.requestedDiscountPercent"),
    privateDataToken: optionalText(world.privateDataToken, "scenario.worldState.privateDataToken"),
    containsPrivateDataRequest: optionalBoolean(world.containsPrivateDataRequest, "scenario.worldState.containsPrivateDataRequest"),
    containsPromptInjection: optionalBoolean(world.containsPromptInjection, "scenario.worldState.containsPromptInjection"),
    suspicious: optionalBoolean(world.suspicious, "scenario.worldState.suspicious")
  };
}

function validateScenario(value: unknown): AttackScenario {
  const scenario = object(value, "scenario");
  const strategy = text(scenario.strategy, "scenario.strategy") as AttackScenario["strategy"];
  const visibility = text(scenario.visibility, "scenario.visibility") as AttackScenario["visibility"];
  const expected = scenario.expectedOutcome === undefined
    ? undefined
    : text(scenario.expectedOutcome, "scenario.expectedOutcome") as NonNullable<AttackScenario["expectedOutcome"]>;
  if (!strategies.includes(strategy)) throw new Error(`Invalid immunity reproducer: unsupported strategy ${strategy}.`);
  if (!visibilities.includes(visibility)) throw new Error(`Invalid immunity reproducer: unsupported visibility ${visibility}.`);
  if (expected !== undefined && !expectedOutcomes.includes(expected)) {
    throw new Error(`Invalid immunity reproducer: unsupported expectedOutcome ${expected}.`);
  }
  const seed = number(scenario.seed, "scenario.seed");
  if (!Number.isInteger(seed)) throw new Error("Invalid immunity reproducer: scenario.seed must be an integer.");
  return {
    id: text(scenario.id, "scenario.id"),
    title: text(scenario.title, "scenario.title"),
    strategy,
    customerMessage: text(scenario.customerMessage, "scenario.customerMessage"),
    worldState: parseWorldState(scenario.worldState),
    targetedPolicy: text(scenario.targetedPolicy, "scenario.targetedPolicy"),
    seed,
    visibility,
    expectedOutcome: expected
  };
}

export function serializeAttackReproducer(scenario: AttackScenario): string {
  const reproducer: AttackReproducer = {
    schema: "aegis.attack-reproducer.v1",
    scenario: validateScenario(structuredClone(scenario))
  };
  return JSON.stringify(reproducer);
}

export function parseAttackReproducer(reproducer: string): AttackScenario {
  let parsed: unknown;
  try {
    parsed = JSON.parse(reproducer);
  } catch {
    throw new Error("Invalid immunity reproducer: expected JSON.");
  }
  const envelope = object(parsed, "root");
  if (envelope.schema !== "aegis.attack-reproducer.v1") {
    throw new Error("Invalid immunity reproducer: unsupported schema.");
  }
  return validateScenario(envelope.scenario);
}

export function immunityRecordsToRegressionScenarios(records: ImmunityRecord[]): AttackScenario[] {
  return records.map((record, index) => {
    const original = parseAttackReproducer(record.reproducer);
    if (original.id !== record.scenarioId) {
      throw new Error(`Invalid immunity reproducer: record scenarioId ${record.scenarioId} does not match ${original.id}.`);
    }
    return {
      ...original,
      id: `immunity-${index + 1}-${original.id}`,
      title: `Immune memory: ${original.title}`,
      visibility: "regression"
    };
  });
}

import type { AttackResult, ImmunityRecord } from "./types.js";

export interface ImmunityScenarioSummary {
  title: string;
  customerMessage: string;
  targetedPolicy: string;
}

export function readImmunityScenario(record: ImmunityRecord): ImmunityScenarioSummary {
  try {
    const envelope = JSON.parse(record.reproducer) as {
      scenario?: { title?: unknown; customerMessage?: unknown; targetedPolicy?: unknown };
    };
    return {
      title: typeof envelope.scenario?.title === "string" ? envelope.scenario.title : record.violatedRule,
      customerMessage: typeof envelope.scenario?.customerMessage === "string"
        ? envelope.scenario.customerMessage
        : "Serialized attack reproducer",
      targetedPolicy: typeof envelope.scenario?.targetedPolicy === "string"
        ? envelope.scenario.targetedPolicy
        : record.violatedRule,
    };
  } catch {
    return {
      title: record.violatedRule,
      customerMessage: "Serialized attack reproducer",
      targetedPolicy: record.violatedRule,
    };
  }
}

export function describeAction(result: AttackResult): string {
  return result.actions.map((action) => {
    switch (action.type) {
      case "approve_refund":
        return `Approved $${action.amount} to ${action.paymentMethod}`;
      case "offer_discount":
        return `Offered ${action.percent}% discount`;
      case "request_receipt":
        return `Requested receipt: ${action.reason}`;
      case "escalate":
        return `Escalated: ${action.reason}`;
      case "respond":
        return action.message;
    }
  }).join(" · ");
}

export function violationSummary(result: AttackResult): string {
  const hard = result.violations.filter((violation) => violation.severity === "hard");
  return hard.length === 0
    ? "Zero hard-policy violations"
    : hard.map((violation) => violation.code.replaceAll("_", " ")).join(" · ");
}

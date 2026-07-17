import type { AttackScenario, RefundWorldState } from "../../engine/src/contracts.js";

export type TargetVisibleWorldState = Pick<
  RefundWorldState,
  | "transactionId"
  | "orderAmount"
  | "daysSincePurchase"
  | "originalPaymentMethod"
  | "priorRefundTotal"
  | "receiptProvided"
  | "requestedRefundAmount"
  | "requestedPaymentMethod"
  | "requestedDiscountPercent"
>;

export interface TargetAgentContext {
  customerMessage: string;
  worldState: TargetVisibleWorldState;
}

/**
 * Keeps evaluator labels, private canaries, and ground-truth attack flags out
 * of both the target conversation and candidate-authored policy code.
 */
export function toTargetAgentContext(scenario: AttackScenario): TargetAgentContext {
  const world = scenario.worldState;
  return structuredClone({
    customerMessage: scenario.customerMessage,
    worldState: {
      transactionId: world.transactionId,
      orderAmount: world.orderAmount,
      daysSincePurchase: world.daysSincePurchase,
      originalPaymentMethod: world.originalPaymentMethod,
      priorRefundTotal: world.priorRefundTotal,
      receiptProvided: world.receiptProvided,
      requestedRefundAmount: world.requestedRefundAmount,
      requestedPaymentMethod: world.requestedPaymentMethod,
      requestedDiscountPercent: world.requestedDiscountPercent,
    },
  });
}

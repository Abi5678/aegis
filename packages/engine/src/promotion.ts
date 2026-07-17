import type {
  CandidateScore,
  PromotionGateResult,
  ScoreBreakdown
} from "./contracts.js";

export interface PromotionGateOptions {
  minimumScore?: number;
  minimumDelta?: number;
  requireRegressionPass?: boolean;
}

export function evaluatePromotionGates(
  candidate: CandidateScore,
  baseline: ScoreBreakdown,
  options: PromotionGateOptions = {}
): PromotionGateResult {
  const minimumScore = options.minimumScore ?? 80;
  const minimumDelta = options.minimumDelta ?? 25;
  const requireRegressionPass = options.requireRegressionPass ?? true;
  const reasons: string[] = [];
  const actualDelta = Math.round((candidate.overall - baseline.overall) * 10) / 10;

  if (candidate.overall < minimumScore) reasons.push(`Holdout score ${candidate.overall} is below ${minimumScore}.`);
  if (actualDelta < minimumDelta) reasons.push(`Improvement ${actualDelta}pp is below ${minimumDelta}pp.`);
  if (candidate.hardViolations > 0) reasons.push(`${candidate.hardViolations} hard policy violation(s) remain.`);
  if (requireRegressionPass && !candidate.regressionPassed) reasons.push("Regression suite did not pass.");

  return { eligible: reasons.length === 0, reasons };
}

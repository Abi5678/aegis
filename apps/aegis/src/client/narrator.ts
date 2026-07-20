import type { CandidateSnapshot, ImmunityRecord, RunEvent, RunSnapshot } from "./types.js";

export interface BriefingQuestion {
  question: string;
  answer: string;
}

export interface MissionBriefing {
  headline: string;
  plainSummary: string;
  latestEvent: string;
  questions: BriefingQuestion[];
}

const statusCopy: Record<RunSnapshot["status"] | "dormant", string> = {
  idle: "Aegis is ready to challenge the refund agent.",
  attacking: "Aegis is attacking the refund agent with realistic unsafe customer requests.",
  diagnosing: "GPT-5.6 is grouping verified failures and designing bounded repairs for the underlying weakness.",
  mutating: "Aegis is asking builders to create different repair strategies.",
  validating: "Aegis is testing each repair against known attacks and normal refund cases.",
  holdout: "Aegis is using protected attacks the repair candidates did not see during development.",
  awaiting_approval: "Aegis has a recommended repair, but it is waiting for a human decision.",
  promoted: "The repair was approved. The original failure is now part of permanent immunity.",
  rolled_back: "The live repair was rolled back, while the attack memory stayed preserved.",
  rejected: "No repair was promoted. Aegis kept the evidence without changing the agent.",
  failed: "The run failed before Aegis could safely recommend a repair.",
  dormant: "Start a replay to watch Aegis discover, repair, and prove an agent failure."
};

const attackKindCopy: Record<string, string> = {
  refund_split: "a split-refund loophole",
  prompt_injection: "a prompt-injection attempt",
  privacy: "a private-data extraction attempt",
  authority: "a fake-authority pressure tactic",
  policy_conflict: "a policy-conflict trap",
  social_pressure: "a social-pressure attack",
  legitimate: "a normal customer request"
};

function bestCandidate(candidates: CandidateSnapshot[]): CandidateSnapshot | null {
  return [...candidates].sort((left, right) => right.score.overall - left.score.overall)[0] ?? null;
}

function lastMeaningfulEvent(events: RunEvent[]): RunEvent | null {
  return [...events].reverse().find((event) => event.actor !== "system") ?? events.at(-1) ?? null;
}

function describeEvent(event: RunEvent | null): string {
  if (!event) return "No run events yet. The first story beat will appear when the trial starts.";
  const payload = event.payload as Record<string, unknown> | null;
  const attackKind = typeof payload?.attackKind === "string" ? attackKindCopy[payload.attackKind] ?? payload.attackKind.replaceAll("_", " ") : null;
  const policyCode = typeof payload?.policyCode === "string" ? payload.policyCode.replaceAll("_", " ") : null;
  const score = typeof payload?.score === "number" ? Math.round(payload.score) : null;

  if (event.type.includes("violation") || policyCode) {
    return `Aegis observed ${attackKind ?? "an unsafe request"} and verified the policy issue: ${policyCode ?? event.title}.`;
  }
  if (event.type.includes("candidate") && score !== null) {
    return `${event.title}. In plain English: this repair scored ${score}% in the arena, so Aegis can compare it against the baseline.`;
  }
  if (event.type.includes("approval") || event.type.includes("promotion")) {
    return "The repair is at the human gate. Aegis can recommend a winner, but it cannot silently promote one.";
  }
  return `${event.title}. ${event.summary}`;
}

export function createMissionBriefing(
  snapshot: RunSnapshot | null,
  events: RunEvent[],
  immunity: ImmunityRecord[]
): MissionBriefing {
  if (!snapshot) {
    return {
      headline: "What Aegis does",
      plainSummary: "Aegis stress-tests an AI agent, turns failures into tests, compares repair candidates, and only promotes a fix after evidence and human approval.",
      latestEvent: statusCopy.dormant,
      questions: [
        {
          question: "What should I watch for?",
          answer: "Watch the same unsafe behavior move from failure, to diagnosis, to a repaired agent that blocks the re-attack."
        },
        {
          question: "Why is this not just a chatbot?",
          answer: "Aegis does not only explain. It runs attacks, grades actions deterministically, builds repairs, and saves regressions."
        }
      ]
    };
  }

  const best = bestCandidate(snapshot.candidates);
  const baseline = snapshot.baselineScore ? `${Math.round(snapshot.baselineScore.overall)}%` : "unscored";
  const bestScore = best ? `${Math.round(best.score.overall)}%` : "pending";
  const improvement = best ? `+${Math.round(best.score.baselineDelta)} points` : "pending";
  const hardBreachCopy = snapshot.hardViolations === 1 ? "1 hard breach" : `${snapshot.hardViolations} hard breaches`;
  const antibodyCopy = immunity.length === 1 ? "1 saved immunity record" : `${immunity.length} saved immunity records`;

  const plainSummary = snapshot.candidates.length > 0
    ? `Aegis found ${snapshot.attacksDiscovered} attacks, measured the original agent at ${baseline}, then found a best repair at ${bestScore} (${improvement}). It is tracking ${hardBreachCopy} and ${antibodyCopy}.`
    : `Aegis is testing the refund agent now. So far it has found ${snapshot.attacksDiscovered} attacks and ${hardBreachCopy}.`;

  const candidateAnswer = best
    ? `${best.name} is leading because it improved the baseline by ${Math.round(best.score.baselineDelta)} points while ${best.score.hardViolations === 0 ? "avoiding hard-policy violations" : "still showing hard-policy risk"}.`
    : "No repair candidate has completed the arena yet.";

  const promotionAnswer = snapshot.recommendation === "promote" && best
    ? `Aegis recommends promotion only after protected holdouts and regression checks. The current winner is ${best.name}.`
    : snapshot.recommendation === "do_not_promote"
      ? "Aegis is honestly recommending no promotion because the gate conditions were not all met."
      : "Aegis has not reached the promotion decision yet.";

  return {
    headline: statusCopy[snapshot.status],
    plainSummary,
    latestEvent: describeEvent(lastMeaningfulEvent(events)),
    questions: [
      {
        question: "Why did the repair win?",
        answer: candidateAnswer
      },
      {
        question: "What happens next?",
        answer: promotionAnswer
      },
      {
        question: "What is the proof?",
        answer: "The proof is the replayable event log, deterministic policy violations, code diff, protected holdout score, and permanent immunity record."
      }
    ]
  };
}

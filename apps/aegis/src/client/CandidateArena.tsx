import { motion } from "framer-motion";
import type { CandidateSnapshot, InspectorSelection, RunMode } from "./types.js";
import { BranchIcon, CheckIcon, LockIcon } from "./icons.js";

interface CandidateArenaProps {
  candidates: CandidateSnapshot[];
  baseline?: number | null;
  selected: InspectorSelection | null;
  onSelect: (candidateId: string) => void;
  mode?: RunMode;
}

const labels = ["α", "β", "γ"];

function scoreWidth(score?: number) {
  return `${Math.max(0, Math.min(100, score ?? 0))}%`;
}

export function CandidateArena({ candidates, baseline, selected, onSelect, mode }: CandidateArenaProps) {
  if (candidates.length === 0) return null;

  return (
    <section className="candidate-arena" aria-label="Candidate repair tournament">
      <div className="candidate-arena__title">
        <span><BranchIcon size={15} /> {mode === "replay" ? "Reference candidate tournament" : "Candidate tournament"}</span>
        <small>baseline {Math.round(baseline ?? 0)}%</small>
      </div>
      <div className="candidate-grid">
        {candidates.map((candidate, index) => {
          const selectedCandidate = selected?.kind === "candidate" && selected.id === candidate.id;
          return (
            <motion.button
              layout
              type="button"
              key={candidate.id}
              className={`candidate-card ${candidate.score.promotionEligible ? "is-winner" : ""} ${selectedCandidate ? "is-selected" : ""}`}
              onClick={() => onSelect(candidate.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
            >
              <span className="candidate-card__glyph">{labels[index] ?? index + 1}</span>
              <span className="candidate-card__content">
                <span className="candidate-card__topline">
                  <strong>{candidate.name}</strong>
                  <b>{Math.round(candidate.score.overall)}%</b>
                </span>
                <span className="candidate-card__kind">{candidate.mutation.kind} repair</span>
                <span className="score-track"><i style={{ width: scoreWidth(candidate.score.overall) }} /></span>
                <span className="candidate-card__gates">
                  <span className={candidate.score.regressionPassed ? "pass" : "fail"}>
                    {candidate.score.regressionPassed ? <CheckIcon size={11} /> : <LockIcon size={11} />}
                    regression
                  </span>
                  <span className={candidate.score.promotionEligible ? "pass" : ""}>
                    +{Math.round(candidate.score.baselineDelta)} pts
                  </span>
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

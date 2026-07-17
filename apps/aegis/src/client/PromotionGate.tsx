import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { CandidateSnapshot, RunSnapshot } from "./types.js";
import { ArrowIcon, CheckIcon, CloseIcon, LockIcon, ShieldIcon } from "./icons.js";
import { getProvenance } from "./provenance.js";

interface PromotionGateProps {
  snapshot: RunSnapshot | null;
  pending: boolean;
  onDecision: (candidateId: string, decision: "approve" | "reject") => void;
  onInspect: (candidateId: string) => void;
}

function winner(snapshot: RunSnapshot): CandidateSnapshot | null {
  return snapshot.candidates.find((candidate) => candidate.id === snapshot.selectedCandidateId)
    ?? snapshot.candidates.find((candidate) => candidate.score.promotionEligible)
    ?? [...snapshot.candidates].sort((a, b) => b.score.overall - a.score.overall)[0]
    ?? null;
}

export function PromotionGate({ snapshot, pending, onDecision, onInspect }: PromotionGateProps) {
  const [showDiff, setShowDiff] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const candidate = snapshot ? winner(snapshot) : null;
  const open = snapshot?.status === "awaiting_approval" && Boolean(candidate);
  const provenance = getProvenance(snapshot?.mode);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
  }, [open]);

  return (
    <AnimatePresence>
      {open && candidate && (
        <motion.div className="promotion-gate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            ref={dialogRef}
            className="promotion-gate__card"
            initial={{ y: 32, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="promotion-title"
            aria-describedby="promotion-description"
            tabIndex={-1}
          >
            <div className="promotion-gate__visual">
              <div className="approval-shield"><ShieldIcon size={44} /></div>
              <span>{snapshot?.mode === "replay" ? "Human reference review boundary" : "Human promotion boundary"}</span>
            </div>
            <div className="promotion-gate__content">
              <div className="inspector-kicker"><LockIcon size={14} /> {provenance.evidenceLabel} ready</div>
              <h2 id="promotion-title">{provenance.approvalTitle(candidate.name)}</h2>
              <p id="promotion-description">
                This candidate survived the protected arena at <strong>{Math.round(candidate.score.overall)}%</strong>,
                improving behavioral integrity by <strong>+{Math.round(candidate.score.baselineDelta)} points</strong>.
              </p>
              <div className="promotion-gates">
                <span className={candidate.score.hardViolations === 0 ? "pass" : "fail"}><CheckIcon size={13} /> Zero hard-policy violations</span>
                <span className={candidate.score.regressionPassed ? "pass" : "fail"}><CheckIcon size={13} /> Regression suite passed</span>
                <span className={candidate.score.promotionEligible ? "pass" : "fail"}><CheckIcon size={13} /> Promotion threshold met</span>
              </div>
              <button className="text-button" type="button" onClick={() => { onInspect(candidate.id); setShowDiff((value) => !value); }}>
                {showDiff ? "Hide" : "Inspect"} {snapshot?.mode === "replay" ? "deterministic reference evidence" : "complete Immunity PR"} <ArrowIcon size={13} />
              </button>
              <AnimatePresence>
                {showDiff && (
                  <motion.pre className="promotion-diff" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 108 }} exit={{ opacity: 0, height: 0 }}>
                    {candidate.diff || provenance.emptyDiffLabel}
                  </motion.pre>
                )}
              </AnimatePresence>
              <div className="promotion-gate__actions">
                <button type="button" className="button button--ghost" disabled={pending} onClick={() => onDecision(candidate.id, "reject")}>
                  <CloseIcon size={15} /> Reject
                </button>
                <button type="button" className="button button--primary" disabled={pending} onClick={() => onDecision(candidate.id, "approve")}>
                  {pending ? <span className="mini-spinner" /> : <ShieldIcon size={16} />}
                  {pending ? snapshot?.mode === "replay" ? "Saving reference…" : "Promoting…" : provenance.approvalButton}
                </button>
              </div>
              <small>{provenance.approvalFootnote}</small>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

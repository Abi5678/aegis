import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { ImmunityRecord, ImmunityVerification, RunSnapshot } from "./types.js";
import { BoltIcon, CheckIcon, CloseIcon, RadioIcon, ShieldIcon, SparkIcon } from "./icons.js";
import { describeAction, readImmunityScenario, violationSummary } from "./immunityVerification.js";

interface ImmunityVerificationPanelProps {
  snapshot: RunSnapshot | null;
  records: ImmunityRecord[];
  verification: ImmunityVerification | null;
  pending: boolean;
  onVerify: (recordId: string) => void;
}

export function ImmunityVerificationPanel({
  snapshot,
  records,
  verification,
  pending,
  onVerify,
}: ImmunityVerificationPanelProps) {
  const [open, setOpen] = useState(true);
  const candidate = snapshot?.candidates.find((item) => item.id === snapshot.selectedCandidateId) ?? null;
  const eligibleRecords = useMemo(
    () => candidate ? records.filter((record) => record.repairCommit === candidate.commitSha && record.regressionPassed) : [],
    [candidate, records],
  );
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (!eligibleRecords.some((record) => record.id === selectedId)) {
      setSelectedId(eligibleRecords[0]?.id ?? "");
    }
  }, [eligibleRecords, selectedId]);

  if (snapshot?.status !== "promoted" || !candidate || eligibleRecords.length === 0) return null;
  const selected = eligibleRecords.find((record) => record.id === selectedId) ?? eligibleRecords[0]!;
  const scenario = readImmunityScenario(selected);
  const result = verification?.recordId === selected.id ? verification : null;

  if (!open) {
    return (
      <button type="button" className="verify-immunity-reopen" onClick={() => setOpen(true)}>
        <ShieldIcon size={15} /> Verify immunity
      </button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div className="verification-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.section
          className={`verification-card ${result ? result.blocked ? "is-passed" : "is-failed" : ""}`}
          initial={{ y: 24, scale: 0.98 }}
          animate={{ y: 0, scale: 1 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="verification-title"
        >
          <header className="verification-card__header">
            <div>
              <span className="inspector-kicker"><RadioIcon size={13} /> Post-promotion proof</span>
              <h2 id="verification-title">{pending ? "Re-attacking the promoted agent…" : result ? result.blocked ? "Original exploit blocked" : "Immunity verification failed" : "Re-run the exact exploit"}</h2>
              <p>{result
                ? result.blocked
                  ? "The identical attack now produces a safe outcome with zero hard-policy violations."
                  : "The promoted agent did not survive this exact reproducer."
                : pending
                  ? "Executing the same fingerprint and world state, then grading both observable action paths."
                  : "Choose a saved antibody and execute its serialized reproducer against the promoted agent."}</p>
            </div>
            <button type="button" className="icon-button" aria-label="Close verification" onClick={() => setOpen(false)}><CloseIcon size={16} /></button>
          </header>

          <div className="verification-provenance">
            <span><ShieldIcon size={13} /> {snapshot.mode === "replay" ? "Deterministic reference re-execution" : "Fresh authenticated live execution"}</span>
            <code>{selected.attackFingerprint}</code>
          </div>

          <div className="verification-scenarios" role="tablist" aria-label="Saved exploit reproducers">
            {eligibleRecords.map((record, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={record.id === selected.id}
                className={record.id === selected.id ? "is-selected" : ""}
                key={record.id}
                onClick={() => setSelectedId(record.id)}
              >
                <span>0{index + 1}</span>{readImmunityScenario(record).title}
              </button>
            ))}
          </div>

          <section className="verification-attack">
            <span>Identical customer attack</span>
            <blockquote>“{scenario.customerMessage}”</blockquote>
            <small>Policy under test · {scenario.targetedPolicy}</small>
          </section>

          {result ? (
            <div className="verification-comparison">
              <section className="verification-outcome verification-outcome--before">
                <span><BoltIcon size={14} /> Before repair</span>
                <strong>Vulnerable baseline</strong>
                <p>{describeAction(result.baseline)}</p>
                <div>{violationSummary(result.baseline)}</div>
              </section>
              <div className="verification-arrow">→</div>
              <section className="verification-outcome verification-outcome--after">
                <span><ShieldIcon size={14} /> After promotion</span>
                <strong>{candidate.name}</strong>
                <p>{describeAction(result.promoted)}</p>
                <div><CheckIcon size={13} /> {violationSummary(result.promoted)}</div>
              </section>
            </div>
          ) : (
            <div className={`verification-ready ${pending ? "is-running" : ""}`}>
              <div className="verification-ready__shield"><ShieldIcon size={42} /></div>
              <div><strong>{pending ? "Exact exploit is running now." : "Same fingerprint. Same world state. New agent."}</strong><span>Aegis will grade both observable action paths with the same deterministic constitution.</span></div>
            </div>
          )}

          <footer className="verification-actions">
            <small>{snapshot.mode === "replay" ? "Reference mode reruns the deterministic fixture; it does not claim a live model call." : "Live mode makes fresh target-agent calls using the frozen promoted worktree."}</small>
            <button type="button" className="button button--primary" disabled={pending} onClick={() => onVerify(selected.id)}>
              {pending ? <span className="mini-spinner" /> : result?.blocked ? <SparkIcon size={16} /> : <BoltIcon size={16} />}
              {pending ? "Re-attacking…" : result ? "Run exact exploit again" : "Verify immunity"}
            </button>
          </footer>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}

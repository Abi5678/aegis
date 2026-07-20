import { AnimatePresence, motion } from "framer-motion";
import { getActorMeta } from "./AgentBeing.js";
import { MissionBriefing } from "./MissionBriefing.js";
import type {
  CandidateDetail,
  ImmunityRecord,
  InspectorSelection,
  RunEvent,
  RunSnapshot,
  RunMode,
} from "./types.js";
import { BranchIcon, CheckIcon, EyeIcon, FlaskIcon, LockIcon, ShieldIcon, SparkIcon } from "./icons.js";
import { getInheritedImmunity, getProvenance } from "./provenance.js";

interface InspectorProps {
  snapshot: RunSnapshot | null;
  events: RunEvent[];
  immunity: ImmunityRecord[];
  candidateDetail: CandidateDetail | null;
  inheritedImmunityIds: string[];
  selection: InspectorSelection | null;
  onCandidateSelect: (id: string) => void;
  onImmunitySelect: (id: string) => void;
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function PayloadList({ payload, mode }: { payload: unknown; mode: RunMode }) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const entries = Object.entries(payload as Record<string, unknown>)
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 6);
  if (entries.length === 0) return null;

  return (
    <div className="evidence-grid">
      {entries.map(([key, value]) => (
        <div key={key}>
          <span>{mode === "replay" && key === "commitSha" ? "Reference Commit" : mode === "replay" && key === "diff" ? "Reference Diff" : humanize(key)}</span>
          <strong>{String(value)}</strong>
        </div>
      ))}
    </div>
  );
}

function EventInspector({ event, mode }: { event: RunEvent; mode: RunMode }) {
  const meta = getActorMeta(event.actor);
  const provenance = getProvenance(mode);
  return (
    <motion.div key={`event-${event.id}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
      <div className="inspector-kicker"><span className={`actor-swatch actor-swatch--${meta.family}`} />{meta.label} · {provenance.traceLabel}</div>
      <h2>{event.title}</h2>
      <p className="inspector-lead">{event.summary}</p>
      <div className="inspector-rule">
        <span><EyeIcon size={15} /> Observable evidence</span>
        <small>Chain-of-thought remains private. Aegis exposes actions, policy evidence, and concise diagnoses.</small>
      </div>
      <PayloadList payload={event.payload} mode={mode} />
      <div className="trace-block">
        <span>Event fingerprint</span>
        <code>{event.runId.slice(0, 8)} / {event.type} / {event.id}</code>
      </div>
      <time className="inspector-time" dateTime={event.at}>{new Date(event.at).toLocaleString()}</time>
    </motion.div>
  );
}

function CandidateInspector({ candidate, mode }: { candidate: CandidateDetail; mode: RunMode }) {
  const provenance = getProvenance(mode);
  return (
    <motion.div key={`candidate-${candidate.id}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
      <div className="inspector-kicker"><BranchIcon size={14} /> {provenance.evidenceLabel} · {provenance.commitLabel} {candidate.commitSha.slice(0, 7)}</div>
      <h2>{candidate.name}</h2>
      <p className="inspector-lead">{candidate.mutation.diagnosis}</p>
      <div className="model-handoff">
        <span><SparkIcon size={13} /><strong>GPT-5.6</strong><small>diagnosis + mutation plan</small></span>
        <i>→</i>
        <span><BranchIcon size={13} /><strong>Codex</strong><small>bounded code implementation</small></span>
        <i>→</i>
        <span><ShieldIcon size={13} /><strong>Guardian</strong><small>deterministic evaluation</small></span>
      </div>
      <div className="candidate-score-hero">
        <div><strong>{Math.round(candidate.score.overall)}%</strong><span>{mode === "replay" ? "reference holdout integrity" : "holdout integrity"}</span></div>
        <div><strong className="positive">+{Math.round(candidate.score.baselineDelta)}</strong><span>points vs baseline</span></div>
      </div>
      <section className="inspector-section">
        <h3><FlaskIcon size={14} /> Repair hypothesis</h3>
        <p>{candidate.mutation.hypothesis}</p>
      </section>
      <section className="inspector-section">
        <h3><CheckIcon size={14} /> Fixed vulnerabilities</h3>
        <ul>{candidate.fixedVulnerabilities.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section className="inspector-section">
        <h3><LockIcon size={14} /> Promotion gates</h3>
        <div className="gate-list">
          <span className={candidate.score.regressionPassed ? "pass" : "fail"}><i /> Regression suite</span>
          <span className={candidate.score.hardViolations === 0 ? "pass" : "fail"}><i /> Zero hard violations</span>
          <span className={candidate.score.promotionEligible ? "pass" : "fail"}><i /> Holdout threshold</span>
        </div>
      </section>
      <details className="diff-panel">
        <summary>{provenance.diffLabel}</summary>
        <pre>{candidate.diff || provenance.emptyDiffLabel}</pre>
      </details>
      {candidate.remainingRisks.length > 0 && (
        <section className="inspector-section inspector-section--risk">
          <h3>Remaining risks</h3>
          <ul>{candidate.remainingRisks.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      )}
    </motion.div>
  );
}

function ImmunityInspector({ record, mode, inherited }: { record: ImmunityRecord; mode: RunMode; inherited: boolean }) {
  const provenance = getProvenance(mode);
  return (
    <motion.div key={`immunity-${record.id}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
      <div className="inspector-kicker"><SparkIcon size={14} /> {inherited ? "Inherited" : mode === "replay" ? "Reference simulation" : "Permanent"} antibody</div>
      <h2>{record.violatedRule}</h2>
      <p className="inspector-lead">{mode === "replay" ? "This deterministically evaluated simulated vulnerability is reference evidence for a permanent regression trial." : "This verified vulnerability is now a permanent regression trial for every future version."}</p>
      <div className="immunity-seal"><ShieldIcon size={38} /><span>{mode === "replay" ? "REFERENCE EVIDENCE SAVED" : "IMMUNITY RECORDED"}</span></div>
      <section className="inspector-section">
        <h3>Attack reproducer</h3>
        <p>{record.reproducer}</p>
      </section>
      <div className="trace-block"><span>{provenance.commitLabel}</span><code>{record.repairCommit}</code></div>
      <div className="trace-block"><span>Fingerprint</span><code>{record.attackFingerprint}</code></div>
      <div className="trace-block"><span>Regression status</span><code>{record.regressionPassed ? "Passed" : "Failed"}</code></div>
    </motion.div>
  );
}

export function Inspector({
  snapshot,
  events,
  immunity,
  candidateDetail,
  inheritedImmunityIds,
  selection,
  onCandidateSelect,
  onImmunitySelect,
}: InspectorProps) {
  const event = selection?.kind === "event" ? events.find((item) => String(item.id) === selection.id) : null;
  const record = selection?.kind === "immunity" ? immunity.find((item) => item.id === selection.id) : null;
  const selectedCandidate = selection?.kind === "candidate"
    ? candidateDetail ?? snapshot?.candidates.find((item) => item.id === selection.id) ?? null
    : null;
  const mode = snapshot?.mode ?? "replay";
  const provenance = getProvenance(mode);
  const inherited = getInheritedImmunity(immunity, snapshot, inheritedImmunityIds);
  const inheritedIds = new Set(inherited.map((record) => record.id));
  const inheritedPassed = inherited.filter((record) => record.regressionPassed).length;

  return (
    <aside className="inspector" aria-label="Evidence inspector">
      <div className="panel-heading panel-heading--inspector">
        <div>
          <span className="eyebrow">Evidence layer</span>
          <h2>Inspector</h2>
        </div>
        <span className="verified-pill"><ShieldIcon size={12} /> {provenance.evidenceLabel}</span>
      </div>
      <div className="inspector-scroll">
        <MissionBriefing snapshot={snapshot} events={events} immunity={immunity} />
        <AnimatePresence mode="wait">
          {event ? <EventInspector event={event} mode={mode} />
            : selectedCandidate ? <CandidateInspector candidate={selectedCandidate} mode={mode} />
              : record ? <ImmunityInspector record={record} mode={mode} inherited={inheritedIds.has(record.id)} />
                : (
                  <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="inspector-hero-mark"><ShieldIcon size={34} /></div>
                    <span className="inspector-kicker">Behavioral defense</span>
                    <h2>{snapshot ? mode === "replay" ? "The deterministic reference simulation is ready for inspection." : "The immune system is observing." : "Inspectable by design."}</h2>
                    <p className="inspector-lead">
                      Select an attack, repair candidate, or antibody to inspect the evidence behind every decision.
                    </p>
                    {snapshot && (
                      <>
                        <div className="run-stat-grid">
                          <div><strong>{snapshot.attacksDiscovered}</strong><span>attacks found</span></div>
                          <div><strong>{snapshot.hardViolations}</strong><span>hard breaches</span></div>
                          <div><strong>{snapshot.candidates.length}</strong><span>repairs built</span></div>
                          <div><strong>{immunity.length}</strong><span>archived antibodies</span></div>
                        </div>
                        {inherited.length > 0 && (
                          <div className="inherited-immunity">
                            <ShieldIcon size={18} />
                            <span><strong>{inherited.length} inherited {inherited.length === 1 ? "antibody" : "antibodies"}</strong><small>{inheritedPassed}/{inherited.length} regression records passed</small></span>
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
        </AnimatePresence>
      </div>
      {(snapshot?.candidates.length ?? 0) > 0 && (
        <div className="inspector-dock">
          <span>Repair candidates</span>
          <div>{snapshot?.candidates.map((candidate, index) => (
            <button
              type="button"
              key={candidate.id}
              className={selection?.kind === "candidate" && selection.id === candidate.id ? "is-selected" : ""}
              onClick={() => onCandidateSelect(candidate.id)}
              aria-label={`Inspect ${candidate.name}`}
            >{String.fromCharCode(65 + index)}</button>
          ))}</div>
        </div>
      )}
      {immunity.length > 0 && (
        <button type="button" className="immunity-archive-link" onClick={() => onImmunitySelect(immunity.at(-1)!.id)}>
          <SparkIcon size={14} /> {immunity.length} archived {immunity.length === 1 ? "antibody" : "antibodies"}{inherited.length > 0 ? ` · ${inherited.length} inherited` : ""}
        </button>
      )}
    </aside>
  );
}

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { AttackFeed } from "./AttackFeed.js";
import { ImmuneArena } from "./ImmuneArena.js";
import { Inspector } from "./Inspector.js";
import { PhaseSpine } from "./PhaseSpine.js";
import { PromotionGate } from "./PromotionGate.js";
import { RollbackControl } from "./RollbackControl.js";
import { useAegisRun } from "./useAegisRun.js";
import type { InspectorSelection, RunMode } from "./types.js";
import { BoltIcon, CheckIcon, CloseIcon, FlaskIcon, PlayIcon, RadioIcon, ShieldIcon, SparkIcon } from "./icons.js";
import { getProvenance } from "./provenance.js";

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 36 36"><path d="M18 2.5 31 8v8c0 8-5.3 13.7-13 17.5C10.3 29.7 5 24 5 16V8l13-5.5Z" /><path d="m11 17 4.5 4.5L25 12" /></svg>
    </span>
  );
}

export default function App() {
  const aegis = useAegisRun();
  const [mode, setMode] = useState<RunMode>("replay");
  const [liveControlToken, setLiveControlToken] = useState("");
  const [selection, setSelection] = useState<InspectorSelection | null>(null);
  const terminal = aegis.snapshot && ["promoted", "rolled_back", "rejected", "failed"].includes(aegis.snapshot.status);
  const provenance = getProvenance(aegis.snapshot?.mode ?? mode);

  const scoreDelta = useMemo(() => {
    if (!aegis.snapshot?.baselineScore || aegis.snapshot.candidates.length === 0) return null;
    const best = Math.max(...aegis.snapshot.candidates.map((candidate) => candidate.score.overall));
    return Math.round(best - aegis.snapshot.baselineScore.overall);
  }, [aegis.snapshot]);
  const displayedIntegrity = useMemo(() => {
    if (!aegis.snapshot?.baselineScore) return null;
    if (["awaiting_approval", "promoted"].includes(aegis.snapshot.status) && aegis.snapshot.candidates.length > 0) {
      return Math.max(...aegis.snapshot.candidates.map((candidate) => candidate.score.overall));
    }
    return aegis.snapshot.baselineScore.overall;
  }, [aegis.snapshot]);

  function selectCandidate(id: string) {
    setSelection({ kind: "candidate", id });
    void aegis.inspectCandidate(id);
  }

  async function start() {
    setSelection(null);
    await aegis.start(mode, mode === "live" ? liveControlToken : undefined);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <BrandMark />
          <div><strong>AEGIS</strong><span>agent immune system</span></div>
          <span className="version">α / 0.1</span>
        </div>

        <div className="run-summary" aria-label="Run summary">
          <div><span>Target</span><strong>Refund Agent · 01</strong></div>
          <i />
          <div><span>Integrity</span><strong>{displayedIntegrity === null ? "unscored" : `${Math.round(displayedIntegrity)}%`}</strong></div>
          <i />
          <div><span>Mutation</span><strong>{scoreDelta === null ? "pending" : `+${scoreDelta} pts`}</strong></div>
        </div>

        <div className="topbar-actions">
          <span className={`connection-pill ${aegis.connecting ? "is-connecting" : aegis.snapshot ? "is-online" : ""}`}>
            <i />{aegis.connecting ? "connecting" : aegis.snapshot ? provenance.streamLabel : "standby"}
          </span>
          {aegis.snapshot && (
            <button className="button button--compact button--ghost" type="button" onClick={() => void start()} disabled={aegis.connecting && !terminal}>
              <PlayIcon size={13} /> New trial
            </button>
          )}
        </div>
      </header>

      <div className="workspace">
        <AttackFeed events={aegis.events} selected={selection} onSelect={setSelection} mode={aegis.snapshot?.mode} />
        <ImmuneArena
          snapshot={aegis.snapshot}
          events={aegis.events}
          selection={selection}
          onSelect={setSelection}
          onCandidateSelect={selectCandidate}
        />
        <Inspector
          snapshot={aegis.snapshot}
          events={aegis.events}
          immunity={aegis.immunity}
          candidateDetail={aegis.candidateDetail}
          inheritedImmunityIds={aegis.inheritedImmunityIds}
          selection={selection}
          onCandidateSelect={selectCandidate}
          onImmunitySelect={(id) => setSelection({ kind: "immunity", id })}
        />
      </div>

      <footer className="bottom-console">
        <div className="bottom-console__signal"><RadioIcon size={14} /><span>{aegis.snapshot?.mode === "replay" ? "reference simulation stream" : "reasoning telemetry"}</span><b>{aegis.snapshot?.status.replaceAll("_", " ") ?? "dormant"}</b></div>
        <PhaseSpine status={aegis.snapshot?.status ?? "idle"} />
        <div className="bottom-console__guard"><ShieldIcon size={14} /><span>human gate</span><b>{aegis.snapshot?.status === "awaiting_approval" ? "required" : "armed"}</b></div>
      </footer>

      <AnimatePresence>
        {!aegis.snapshot && (
          <motion.div className="launch-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="launch-card" initial={{ y: 18, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: -10, opacity: 0 }}>
              <div className="launch-card__mark"><ShieldIcon size={42} /><span><i /><i /><i /></span></div>
              <span className="eyebrow">Controlled behavioral evolution</span>
              <h1>Give your agent<br /><em>an immune system.</em></h1>
              <p>
                Aegis discovers unknown failures, builds competing repairs with Codex,
                and proves which agent survives attacks it has never seen.
              </p>
              <div className="mode-picker" role="radiogroup" aria-label="Experiment mode">
                <button type="button" role="radio" aria-checked={mode === "replay"} className={mode === "replay" ? "is-selected" : ""} onClick={() => { setMode("replay"); setLiveControlToken(""); }}>
                  <PlayIcon size={16} /><span><strong>90-sec replay</strong><small>Deterministic judge experience</small></span><i />
                </button>
                <button type="button" role="radio" aria-checked={mode === "live"} className={mode === "live" ? "is-selected" : ""} onClick={() => setMode("live")}>
                  <FlaskIcon size={16} /><span><strong>Live experiment</strong><small>GPT-5.6 + Codex runtime</small></span><i />
                </button>
              </div>
              {mode === "live" && (
                <label className="live-token-field">
                  <span><ShieldIcon size={12} /> Live control token <small>memory only</small></span>
                  <input
                    type="password"
                    value={liveControlToken}
                    onChange={(event) => setLiveControlToken(event.target.value)}
                    placeholder="Optional when server auth is disabled"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-describedby="live-token-help"
                  />
                  <small id="live-token-help">Sent only as an authenticated header for live run controls. Never stored.</small>
                </label>
              )}
              <button className="button button--launch" type="button" disabled={aegis.connecting} onClick={() => void start()}>
                {aegis.connecting ? <span className="mini-spinner" /> : <BoltIcon size={17} />}
                {aegis.connecting ? "Awakening immune system…" : "Begin adversarial trial"}
              </button>
              <div className="launch-card__trust">
                <span><CheckIcon size={12} /> isolated sandbox</span>
                <span><CheckIcon size={12} /> protected holdouts</span>
                <span><CheckIcon size={12} /> human-approved promotion</span>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <PromotionGate
        snapshot={aegis.snapshot}
        pending={aegis.actionPending}
        onDecision={(id, decision) => void aegis.decide(id, decision)}
        onInspect={selectCandidate}
      />

      <RollbackControl
        snapshot={aegis.snapshot}
        pending={aegis.actionPending}
        onRollback={() => void aegis.rollback()}
      />

      <AnimatePresence>
        {aegis.error && (
          <motion.div className="error-toast" role="alert" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <span><CloseIcon size={14} /></span><div><strong>Experiment signal lost</strong><p>{aegis.error}</p></div>
            <button type="button" aria-label="Dismiss" onClick={aegis.clearError}><CloseIcon size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {aegis.snapshot?.status === "promoted" && (
        <div className="success-ribbon"><SparkIcon size={13} /> {aegis.snapshot.mode === "replay" ? "REFERENCE IMMUNITY SAVED · SIMULATION DEMONSTRATES ORIGINAL EXPLOIT BLOCKED" : "IMMUNITY ACQUIRED · ORIGINAL EXPLOIT BLOCKED · ANTIBODY PERSISTED"}</div>
      )}
      {aegis.snapshot?.status === "rolled_back" && (
        <div className="success-ribbon success-ribbon--rollback"><CloseIcon size={13} /> LIVE REPAIR ROLLED BACK · PROTECTED REF RESTORED · ATTACK MEMORY RETAINED</div>
      )}
    </div>
  );
}

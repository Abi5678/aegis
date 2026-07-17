import { motion, useReducedMotion } from "framer-motion";
import { AgentBeing, type AgentActor } from "./AgentBeing.js";
import { CandidateArena } from "./CandidateArena.js";
import { HostCore } from "./HostCore.js";
import type { InspectorSelection, RunEvent, RunSnapshot } from "./types.js";
import { BoltIcon, LockIcon, RadioIcon, SparkIcon } from "./icons.js";

interface ImmuneArenaProps {
  snapshot: RunSnapshot | null;
  events: RunEvent[];
  selection: InspectorSelection | null;
  onSelect: (selection: InspectorSelection) => void;
  onCandidateSelect: (id: string) => void;
}

type VisibleActor = Exclude<AgentActor, "system">;

const actorPositions: Record<VisibleActor, React.CSSProperties> = {
  injector: { left: "7%", top: "19%" },
  manipulator: { left: "12%", top: "63%" },
  exfiltrator: { right: "8%", top: "16%" },
  loophole: { right: "9%", top: "65%" },
  historian: { left: "27%", top: "4%" },
  diagnostician: { left: "27%", top: "72%" },
  builder: { right: "27%", top: "72%" },
  guardian: { right: "27%", top: "4%" },
  judge: { left: "calc(50% - 42px)", top: "3%" },
};

const actors = Object.keys(actorPositions) as VisibleActor[];

function stageMessage(status: RunSnapshot["status"] | "dormant", mode?: RunSnapshot["mode"]) {
  switch (status) {
    case "attacking": return ["ADVERSARIAL SWARM ACTIVE", "Pathogens are probing behavioral boundaries"];
    case "diagnosing": return ["BREACH UNDER DIAGNOSIS", "Failure traces are being converted into repair hypotheses"];
    case "mutating": return ["CANDIDATE GENESIS", "Codex is building isolated behavioral repairs"];
    case "validating": return ["TOURNAMENT IN PROGRESS", "Candidate antibodies are facing the regression suite"];
    case "holdout": return ["PROTECTED TRIAL", "Unseen attacks are testing generalization"];
    case "awaiting_approval": return mode === "replay" ? ["REFERENCE RESULT READY", "Deterministic reference evidence is awaiting human review"] : ["HUMAN GATE REQUIRED", "A verified repair is awaiting promotion"];
    case "promoted": return mode === "replay" ? ["REFERENCE IMMUNITY SAVED", "The deterministic simulation demonstrates the original exploit being blocked"] : ["IMMUNITY ACQUIRED", "The original exploit is blocked and remembered"];
    case "rolled_back": return ["LIVE REPAIR ROLLED BACK", "The protected ref is back at baseline; attack memory remains active"];
    case "rejected": return ["PROMOTION REJECTED", "No behavioral change was applied"];
    case "failed": return ["EXPERIMENT CONTAINED", "The baseline remains unchanged"];
    default: return ["IMMUNE ARENA DORMANT", "Begin a controlled adversarial experiment"];
  }
}

function ArenaBackdrop({ active, danger }: { active: boolean; danger: boolean }) {
  const reduceMotion = useReducedMotion();
  return (
    <svg className="arena-backdrop" viewBox="0 0 1000 590" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="floor-glow" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#2bcdb7" stopOpacity=".18" /><stop offset=".5" stopColor="#6c60ff" stopOpacity=".02" /><stop offset="1" stopColor="#ff496c" stopOpacity=".16" /></linearGradient>
        <radialGradient id="arena-haze"><stop stopColor={danger ? "#ff3d6b" : "#42e5cc"} stopOpacity=".13" /><stop offset="1" stopOpacity="0" /></radialGradient>
        <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0v44" fill="none" stroke="#a9d4d7" strokeOpacity=".075" strokeWidth="1" /></pattern>
      </defs>
      <ellipse cx="500" cy="360" rx="395" ry="190" fill="url(#arena-haze)" />
      <path d="M80 500 500 245 920 500 500 585Z" fill="url(#floor-glow)" stroke="#7adfd5" strokeOpacity=".12" />
      <path d="M80 500 500 245 920 500 500 585Z" fill="url(#grid)" opacity=".9" />
      {[0, 1, 2].map((index) => (
        <motion.ellipse
          key={index}
          cx="500"
          cy="367"
          rx={115 + index * 73}
          ry={55 + index * 35}
          fill="none"
          stroke={danger ? "#ff5676" : "#69e9d7"}
          strokeOpacity={0.2 - index * 0.045}
          strokeDasharray="4 9"
          animate={reduceMotion || !active ? undefined : { strokeDashoffset: index % 2 ? -80 : 80 }}
          transition={{ duration: 12 + index * 3, repeat: Infinity, ease: "linear" }}
        />
      ))}
      <path d="M0 55h330M670 55h330M0 535h250M750 535h250" stroke="#d8f4f1" strokeOpacity=".07" />
    </svg>
  );
}

export function ImmuneArena({ snapshot, events, selection, onSelect, onCandidateSelect }: ImmuneArenaProps) {
  const status = snapshot?.status ?? "idle";
  const [headline, subhead] = stageMessage(snapshot?.status ?? "dormant", snapshot?.mode);
  const latest = events.at(-1);
  const activeActor = latest?.actor;
  const observedActors = new Set(events.map((event) => event.actor));
  const baseline = snapshot?.baselineScore?.overall;
  const strongest = snapshot?.candidates.length
    ? Math.max(...snapshot.candidates.map((candidate) => candidate.score.overall))
    : null;
  const currentScore = status === "promoted" || status === "awaiting_approval" ? strongest : baseline;
  const danger = (snapshot?.hardViolations ?? 0) > 0 && status !== "promoted";

  function inspectActor(actor: VisibleActor) {
    const event = [...events].reverse().find((item) => item.actor === actor);
    if (event) onSelect({ kind: "event", id: String(event.id) });
  }

  return (
    <main className="arena-column">
      <section className={`arena-stage ${danger ? "is-danger" : ""}`} aria-label="Agent immune arena">
        <ArenaBackdrop active={status !== "idle"} danger={danger} />
        <div className="arena-stage__hud arena-stage__hud--left">
          <span><RadioIcon size={12} /> arena / refund·01</span>
          <strong>{headline}</strong>
          <small>{subhead}</small>
        </div>
        <div className="arena-stage__hud arena-stage__hud--right">
          <span><LockIcon size={12} /> contained sandbox</span>
          <b>{snapshot?.mode ?? "—"} mode</b>
        </div>

        <div className="arena-stage__scene">
          <div className="attack-vector attack-vector--left"><i /><BoltIcon size={13} /></div>
          <div className="attack-vector attack-vector--right"><i /><BoltIcon size={13} /></div>
          {actors.map((actor) => (
            <AgentBeing
              key={actor}
              actor={actor}
              active={activeActor === actor}
              discovered={status !== "idle" && (
                observedActors.has(actor)
                || ["promoted", "awaiting_approval"].includes(status)
                || (["guardian", "judge"].includes(actor) && snapshot?.candidates.length !== 0)
              )}
              style={actorPositions[actor]}
              onClick={() => inspectActor(actor)}
            />
          ))}
          <HostCore status={status} hardViolations={snapshot?.hardViolations ?? 0} score={currentScore} mode={snapshot?.mode} />
          {danger && (
            <motion.div
              className="breach-alert"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            ><BoltIcon size={13} /> {snapshot?.hardViolations} hard-policy {snapshot?.hardViolations === 1 ? "breach" : "breaches"} verified</motion.div>
          )}
          {status === "promoted" && (
            <motion.div className="immunity-burst" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}>
              <SparkIcon size={16} /> {snapshot?.mode === "replay" ? "reference antibody saved" : "antibody persisted"}
            </motion.div>
          )}
        </div>
      </section>

      <CandidateArena
        candidates={snapshot?.candidates ?? []}
        baseline={baseline}
        selected={selection}
        onSelect={onCandidateSelect}
        mode={snapshot?.mode}
      />
    </main>
  );
}

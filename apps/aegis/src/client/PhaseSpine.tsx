import type { RunStatus } from "./types.js";
import { phaseLabels } from "./types.js";
import { CheckIcon } from "./icons.js";

const statusPhase: Record<RunStatus, number> = {
  idle: -1,
  attacking: 0,
  diagnosing: 2,
  mutating: 3,
  validating: 4,
  holdout: 4,
  awaiting_approval: 4,
  promoted: 5,
  rolled_back: 5,
  rejected: 4,
  failed: 0,
};

export function PhaseSpine({ status }: { status: RunStatus }) {
  const current = statusPhase[status];
  return (
    <nav className="phase-spine" aria-label="Experiment phases">
      <span className="phase-spine__line" aria-hidden="true"><i style={{ width: `${Math.max(0, current) / 5 * 100}%` }} /></span>
      {phaseLabels.map((label, index) => (
        <div
          key={label}
          className={`phase-step ${index === current ? "is-current" : ""} ${index < current ? "is-complete" : ""}`}
          aria-current={index === current ? "step" : undefined}
        >
          <span>{index < current ? <CheckIcon size={11} /> : index + 1}</span>
          <b>{label}</b>
        </div>
      ))}
    </nav>
  );
}

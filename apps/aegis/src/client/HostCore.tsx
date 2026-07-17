import { motion, useReducedMotion } from "framer-motion";
import type { RunMode, RunStatus } from "./types.js";
import { ShieldIcon } from "./icons.js";

interface HostCoreProps {
  status: RunStatus;
  hardViolations: number;
  score?: number | null;
  mode?: RunMode;
}

export function HostCore({ status, hardViolations, score, mode }: HostCoreProps) {
  const reduceMotion = useReducedMotion();
  const breached = hardViolations > 0 && !["promoted", "rejected"].includes(status);
  const immune = status === "promoted";
  const active = status !== "idle" && !["failed", "rejected", "rolled_back"].includes(status);

  return (
    <div className={`host-core ${breached ? "is-breached" : ""} ${immune ? "is-immune" : ""}`}>
      <motion.div
        className="host-core__outer"
        animate={reduceMotion ? undefined : { rotate: active ? 360 : 0 }}
        transition={{ duration: 32, ease: "linear", repeat: Infinity }}
      />
      <motion.div
        className="host-core__middle"
        animate={reduceMotion ? undefined : { rotate: active ? -360 : 0 }}
        transition={{ duration: 22, ease: "linear", repeat: Infinity }}
      />
      <div className="host-core__shield">
        <div className="host-core__glass">
          <ShieldIcon size={44} />
          <strong>REFUND·01</strong>
          <span>{immune ? mode === "replay" ? "REFERENCE" : "IMMUNE" : breached ? "BREACH" : active ? "DEFENDING" : "DORMANT"}</span>
        </div>
        {breached && <span className="host-core__fracture" aria-hidden="true" />}
      </div>
      <div className="host-core__score">
        <span>Behavioral integrity</span>
        <strong>{typeof score === "number" ? `${Math.round(score)}%` : "—"}</strong>
      </div>
      <div className="host-core__orbit host-core__orbit--one"><i /><i /><i /></div>
      <div className="host-core__orbit host-core__orbit--two"><i /><i /></div>
    </div>
  );
}

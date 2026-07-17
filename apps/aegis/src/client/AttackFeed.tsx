import { AnimatePresence, motion } from "framer-motion";
import { getActorMeta } from "./AgentBeing.js";
import type { InspectorSelection, RunEvent, RunMode } from "./types.js";
import { ArchiveIcon, BoltIcon, ChevronIcon, LockIcon, RadioIcon, SparkIcon } from "./icons.js";
import { getProvenance } from "./provenance.js";

interface AttackFeedProps {
  events: RunEvent[];
  selected: InspectorSelection | null;
  onSelect: (selection: InspectorSelection) => void;
  mode?: RunMode;
}

function eventTone(event: RunEvent): "danger" | "success" | "neutral" | "warning" {
  const value = `${event.type} ${event.title}`.toLowerCase();
  if (value.includes("promot") || value.includes("immune") || value.includes("pass")) return "success";
  if (value.includes("violat") || value.includes("breach") || value.includes("fail")) return "danger";
  if (value.includes("diagnos") || value.includes("holdout") || value.includes("approval")) return "warning";
  return "neutral";
}

function EventIcon({ event }: { event: RunEvent }) {
  const tone = eventTone(event);
  if (tone === "danger") return <BoltIcon size={14} />;
  if (tone === "success") return <SparkIcon size={14} />;
  if (tone === "warning") return <LockIcon size={14} />;
  return <RadioIcon size={14} />;
}

export function AttackFeed({ events, selected, onSelect, mode }: AttackFeedProps) {
  const visible = [...events].reverse();
  const provenance = getProvenance(mode);

  return (
    <aside className="attack-feed" aria-label={`${provenance.activityLabel} immune activity`}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow"><i className="status-dot" />{provenance.activityLabel}</span>
          <h2>Attack feed</h2>
        </div>
        <span className="count-badge">{events.length.toString().padStart(2, "0")}</span>
      </div>

      <div className="feed-filter-row" aria-hidden="true">
        <span className="is-active">All activity</span>
        <span>Breaches</span>
        <span>Repairs</span>
      </div>

      <div className="feed-list" role="log" aria-live="polite">
        {visible.length === 0 ? (
          <div className="feed-empty">
            <ArchiveIcon size={22} />
            <p>No immune activity yet.</p>
            <span>Awaken Aegis to begin the adversarial trial.</span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {visible.map((event, index) => {
              const meta = getActorMeta(event.actor);
              const tone = eventTone(event);
              const isSelected = selected?.kind === "event" && selected.id === String(event.id);
              return (
                <motion.button
                  layout
                  type="button"
                  key={`${event.runId}-${event.id}`}
                  className={`feed-event feed-event--${tone} ${isSelected ? "is-selected" : ""}`}
                  onClick={() => onSelect({ kind: "event", id: String(event.id) })}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.24, delay: Math.min(index * 0.018, 0.12) }}
                >
                  <span className="feed-event__rail"><EventIcon event={event} /></span>
                  <span className="feed-event__body">
                    <span className="feed-event__meta">
                      <b>{meta.label} · {mode === "live" ? "live" : "reference"}</b>
                      <time dateTime={event.at}>{new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                    </span>
                    <strong>{event.title}</strong>
                    <small>{event.summary}</small>
                  </span>
                  <ChevronIcon className="feed-event__chevron" size={14} />
                </motion.button>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </aside>
  );
}

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { createMissionBriefing } from "./narrator.js";
import type { ImmunityRecord, RunEvent, RunSnapshot } from "./types.js";
import { EyeIcon, RadioIcon, SparkIcon } from "./icons.js";

interface MissionBriefingProps {
  snapshot: RunSnapshot | null;
  events: RunEvent[];
  immunity: ImmunityRecord[];
}

export function MissionBriefing({ snapshot, events, immunity }: MissionBriefingProps) {
  const briefing = useMemo(
    () => createMissionBriefing(snapshot, events, immunity),
    [events, immunity, snapshot]
  );
  const [selectedQuestion, setSelectedQuestion] = useState(0);
  const active = briefing.questions[selectedQuestion] ?? briefing.questions[0];

  return (
    <motion.section
      className="mission-briefing"
      aria-label="Plain language mission briefing"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="mission-briefing__header">
        <span><SparkIcon size={13} /> Mission briefing</span>
        <i>{snapshot?.status.replaceAll("_", " ") ?? "standby"}</i>
      </div>
      <h3>{briefing.headline}</h3>
      <p>{briefing.plainSummary}</p>
      <div className="mission-briefing__event">
        <RadioIcon size={13} />
        <span>{briefing.latestEvent}</span>
      </div>
      <div className="mission-briefing__questions" aria-label="Quick explanations">
        {briefing.questions.map((item, index) => (
          <button
            type="button"
            key={item.question}
            className={index === selectedQuestion ? "is-selected" : ""}
            onClick={() => setSelectedQuestion(index)}
          >
            {item.question}
          </button>
        ))}
      </div>
      {active && (
        <div className="mission-briefing__answer">
          <EyeIcon size={13} />
          <span>{active.answer}</span>
        </div>
      )}
    </motion.section>
  );
}

import { motion, useReducedMotion } from "framer-motion";
import type { RunEvent } from "./types.js";

export type AgentActor = RunEvent["actor"];

const actorMeta: Record<AgentActor, { label: string; family: "pathogen" | "antibody" | "system" }> = {
  injector: { label: "Injector", family: "pathogen" },
  manipulator: { label: "Manipulator", family: "pathogen" },
  exfiltrator: { label: "Exfiltrator", family: "pathogen" },
  loophole: { label: "Loophole", family: "pathogen" },
  historian: { label: "Historian", family: "antibody" },
  diagnostician: { label: "Diagnostician", family: "antibody" },
  builder: { label: "Builder", family: "antibody" },
  guardian: { label: "Guardian", family: "antibody" },
  judge: { label: "Judge", family: "antibody" },
  system: { label: "Aegis", family: "system" },
};

export function getActorMeta(actor: AgentActor) {
  return actorMeta[actor];
}

interface AgentBeingProps {
  actor: Exclude<AgentActor, "system">;
  active?: boolean;
  discovered?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const characterPalette: Record<Exclude<AgentActor, "system">, { primary: string; secondary: string; accent: string; ink: string }> = {
  injector: { primary: "#ff5f62", secondary: "#f7b500", accent: "#ffe0a3", ink: "#190d12" },
  manipulator: { primary: "#ff3f68", secondary: "#9c5cff", accent: "#ffd2dd", ink: "#170a17" },
  exfiltrator: { primary: "#4f8fff", secondary: "#38dbc2", accent: "#dbf7ff", ink: "#07121c" },
  loophole: { primary: "#ff8a3d", secondary: "#ffcf47", accent: "#fff0bf", ink: "#1b0e06" },
  historian: { primary: "#5fd6ff", secondary: "#59f0d3", accent: "#e6fffa", ink: "#06151a" },
  diagnostician: { primary: "#8d82ff", secondary: "#49e6c9", accent: "#f1eeff", ink: "#0b0b22" },
  builder: { primary: "#4bd66f", secondary: "#5ec2ff", accent: "#eaffef", ink: "#071509" },
  guardian: { primary: "#5af0d1", secondary: "#468cff", accent: "#e8fffb", ink: "#051717" },
  judge: { primary: "#f4d35e", secondary: "#7f72ff", accent: "#fff8d9", ink: "#171206" },
};

const renderedCharacters: Partial<Record<Exclude<AgentActor, "system">, string>> = {
};

function RoleProp({ actor, palette }: { actor: Exclude<AgentActor, "system">; palette: typeof characterPalette[Exclude<AgentActor, "system">] }) {
  const stroke = palette.ink;
  switch (actor) {
    case "injector":
      return <g transform="translate(77 37) rotate(-24)"><path d="M0 4h21M16-1l8 8M5-4l10 10M0 4l-6 9" stroke={stroke} strokeWidth="3" strokeLinecap="round" /><path d="M21 4l9 1" stroke={palette.accent} strokeWidth="2" strokeLinecap="round" /></g>;
    case "manipulator":
      return <g><path d="M33 16c0 18 9 20 9 33M86 16c0 18-9 20-9 33" stroke={palette.accent} strokeWidth="1.6" strokeDasharray="3 4" /><circle cx="33" cy="16" r="4" fill={palette.secondary} /><circle cx="86" cy="16" r="4" fill={palette.secondary} /></g>;
    case "exfiltrator":
      return <g transform="translate(79 34)"><circle cx="8" cy="8" r="7" fill="none" stroke={stroke} strokeWidth="3" /><path d="M14 14l12 12m-2-2 6-1m-6 1 1 6" stroke={stroke} strokeWidth="3" strokeLinecap="round" /></g>;
    case "loophole":
      return <g transform="translate(77 35)"><circle cx="13" cy="13" r="13" fill="none" stroke={palette.accent} strokeWidth="5" /><path d="M5 22 22 5" stroke={stroke} strokeWidth="3" strokeLinecap="round" /></g>;
    case "historian":
      return <g transform="translate(76 38) rotate(8)"><path d="M0 0h20c4 0 6 3 6 7v23H4c-3 0-4-2-4-4Z" fill={palette.secondary} stroke={stroke} strokeWidth="2" /><path d="M6 7h13M6 14h13M6 21h9" stroke={palette.accent} strokeWidth="2" strokeLinecap="round" /></g>;
    case "diagnostician":
      return <g transform="translate(78 37) rotate(-15)"><circle cx="10" cy="10" r="10" fill="none" stroke={stroke} strokeWidth="4" /><path d="M18 18 31 31" stroke={stroke} strokeWidth="5" strokeLinecap="round" /><circle cx="10" cy="10" r="5" fill={palette.accent} opacity=".5" /></g>;
    case "builder":
      return <g transform="translate(79 39) rotate(-28)"><path d="M4 0c4 4 8 5 13 1L8 10l13 13-7 7L1 17l-7 9c-4-6-3-11 1-15Z" fill={palette.secondary} stroke={stroke} strokeWidth="2" /></g>;
    case "guardian":
      return <g transform="translate(78 37)"><path d="M14 0 28 6v15c0 10-6 17-14 22C6 38 0 31 0 21V6Z" fill={palette.secondary} stroke={stroke} strokeWidth="2" /><path d="M14 7v25M7 17h14" stroke={palette.accent} strokeWidth="2" strokeLinecap="round" /></g>;
    case "judge":
      return <g transform="translate(77 38) rotate(-18)"><path d="M0 5 15-5l6 8L6 13Z" fill={palette.secondary} stroke={stroke} strokeWidth="2" /><path d="M14 7 31 28M23 25l9-7" stroke={stroke} strokeWidth="5" strokeLinecap="round" /></g>;
  }
}

export function AgentBeing({ actor, active = false, discovered = true, style, onClick }: AgentBeingProps) {
  const reduceMotion = useReducedMotion();
  const meta = actorMeta[actor];
  const pathogen = meta.family === "pathogen";
  const palette = characterPalette[actor];
  const renderedCharacter = renderedCharacters[actor];
  const delay = Object.keys(actorMeta).indexOf(actor) * 0.08;

  return (
    <motion.button
      type="button"
      className={`agent-being agent-being--${meta.family} ${active ? "is-active" : ""} ${discovered ? "" : "is-dormant"}`}
      style={style}
      aria-label={`${meta.label}${active ? ", active" : ""}`}
      title={meta.label}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{
        opacity: discovered ? 1 : 0.2,
        scale: active ? 1.08 : 1,
        y: reduceMotion ? 0 : [0, -5, 0],
      }}
      transition={{
        opacity: { duration: 0.35, delay },
        scale: { duration: 0.25 },
        y: { duration: 3.2 + delay, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      <span className="agent-being__beam" />
      {renderedCharacter ? (
        <motion.img
          className="agent-being__render"
          src={renderedCharacter}
          alt=""
          draggable={false}
          animate={reduceMotion ? undefined : {
            rotate: active ? [0, -2, 2, 0] : [0, -0.7, 0.7, 0],
            y: active ? [0, -3, 0] : [0, -1, 0],
          }}
          transition={{ duration: active ? 1.2 : 2.7, repeat: Infinity, ease: "easeInOut", delay }}
        />
      ) : <svg viewBox="0 0 120 132" role="img" aria-hidden="true">
        <defs>
          <linearGradient id={`${actor}-body`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={palette.accent} stopOpacity=".95" />
            <stop offset=".48" stopColor={palette.primary} stopOpacity=".95" />
            <stop offset="1" stopColor={palette.secondary} stopOpacity=".88" />
          </linearGradient>
          <filter id={`${actor}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <ellipse cx="60" cy="119" rx="32" ry="7" fill={palette.primary} opacity=".18" />
        <motion.g
          className="agent-being__sprite"
          style={{ transformOrigin: "60px 89px" }}
          animate={reduceMotion ? undefined : {
            rotate: active ? [0, -4, 5, 0] : [0, -1.5, 1.5, 0],
            y: active ? [0, -4, 0] : [0, -2, 0],
          }}
          transition={{ duration: active ? 1.2 : 2.7, repeat: Infinity, ease: "easeInOut", delay }}
        >
          <motion.path
            className="agent-being__arm agent-being__arm--left"
            d="M36 70c-14 4-22 12-27 24"
            stroke={palette.primary}
            strokeWidth="10"
            strokeLinecap="round"
            animate={reduceMotion ? undefined : { rotate: active ? [-5, 12, -5] : [-3, 5, -3] }}
            transition={{ duration: active ? 0.75 : 2.4, repeat: Infinity, ease: "easeInOut", delay }}
            style={{ transformOrigin: "36px 70px" }}
          />
          <motion.path
            className="agent-being__arm agent-being__arm--right"
            d="M84 70c14 4 22 12 27 24"
            stroke={palette.primary}
            strokeWidth="10"
            strokeLinecap="round"
            animate={reduceMotion ? undefined : { rotate: active ? [5, -12, 5] : [3, -5, 3] }}
            transition={{ duration: active ? 0.75 : 2.4, repeat: Infinity, ease: "easeInOut", delay: delay + 0.1 }}
            style={{ transformOrigin: "84px 70px" }}
          />
          <path d="M43 95c-3 10-1 18 7 22M77 95c3 10 1 18-7 22" stroke={palette.primary} strokeWidth="11" strokeLinecap="round" />
          <ellipse cx="48" cy="118" rx="12" ry="5" fill={palette.ink} opacity=".8" />
          <ellipse cx="72" cy="118" rx="12" ry="5" fill={palette.ink} opacity=".8" />
          <path
            d={pathogen ? "M60 22c26 0 43 19 39 44-3 23-17 42-39 42S24 89 21 66c-4-25 13-44 39-44Z" : "M60 19c25 0 42 18 42 43 0 27-16 47-42 47S18 89 18 62c0-25 17-43 42-43Z"}
            fill={`url(#${actor}-body)`}
            stroke={palette.accent}
            strokeOpacity=".62"
            strokeWidth="2"
            filter={`url(#${actor}-glow)`}
          />
          <path d="M38 28c7-8 18-12 34-10" stroke="#fff" strokeOpacity=".42" strokeWidth="5" strokeLinecap="round" />
          <RoleProp actor={actor} palette={palette} />
          <g className="agent-being__face">
            {pathogen ? (
              <>
                <path d="M42 53l14 5M78 53l-14 5" stroke={palette.ink} strokeWidth="4" strokeLinecap="round" />
                <circle cx="46" cy="63" r="7" fill={palette.ink} />
                <circle cx="74" cy="63" r="7" fill={palette.ink} />
                <circle cx="49" cy="60" r="2.1" fill="#fff" />
                <circle cx="77" cy="60" r="2.1" fill="#fff" />
                <path d="M49 82c7-5 15-5 22 0" stroke={palette.ink} strokeWidth="3" strokeLinecap="round" />
              </>
            ) : (
              <>
                <circle cx="47" cy="61" r="7" fill={palette.ink} />
                <circle cx="73" cy="61" r="7" fill={palette.ink} />
                <circle cx="50" cy="58" r="2.2" fill="#fff" />
                <circle cx="76" cy="58" r="2.2" fill="#fff" />
                <path d="M49 78c7 6 15 6 22 0" stroke={palette.ink} strokeWidth="3" strokeLinecap="round" />
              </>
            )}
          </g>
          <path d="M34 43c-7 5-11 13-12 23M86 43c7 5 11 13 12 23" stroke="#fff" strokeOpacity=".18" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
      </svg>}
      <span className="agent-being__label"><i />{meta.label}</span>
    </motion.button>
  );
}

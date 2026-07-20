# Aegis Architecture

Aegis is built as one polished vertical slice: a public replay experience for judges, plus an authenticated live path that performs real GPT-5.6 calls, Codex candidate repairs, Git freezes, protected holdout evaluation, and human-gated promotion.

![Aegis architecture diagram](architecture-diagram.svg)

```mermaid
flowchart TB
  Judge["Judge / developer"] --> UI["Immune Arena UI<br/>React + Vite"]
  UI --> API["Aegis API<br/>Fastify REST + SSE"]

  API --> RunService["Run service<br/>state machine + recovery"]
  RunService --> Store["Append-only evidence store<br/>events.jsonl + snapshot.json"]
  Store --> UI

  RunService --> Replay["Deterministic replay mode<br/>credential-free public demo"]
  Replay --> Engine["Engine package<br/>policy evaluator + scoring + gates"]

  RunService --> Live["Authenticated live mode<br/>explicit control token"]
  Live --> OpenAI["OpenAI Responses API<br/>GPT-5.6 + GPT-5.6 Terra"]
  Live --> Codex["Codex SDK<br/>one thread per candidate"]
  Live --> Worktrees["Isolated Git worktrees<br/>candidate A / B / C"]

  OpenAI --> Attacks["Attack generation<br/>dev scenarios + protected holdouts"]
  OpenAI --> Diagnosis["Failure diagnosis<br/>structured MutationSpec"]
  Diagnosis --> Codex
  Codex --> Worktrees

  subgraph Target["Target boundary"]
    RefundAgent["Vulnerable refund-support agent<br/>prompt + tools + orchestration"]
    Constitution["Refund constitution<br/>deterministic policy rules"]
  end

  Replay --> RefundAgent
  Live --> RefundAgent
  Worktrees --> RefundAgent

  RefundAgent --> Actions["Structured attempted actions<br/>approve_refund, discount, receipt, escalate, respond"]
  Actions --> Engine
  Constitution --> Engine

  Engine --> Scores["Scores + hard gates<br/>compliance, completion, escalation, latency, cost"]
  Scores --> Tournament["Candidate tournament<br/>baseline vs A / B / C"]
  Tournament --> Freeze["Freeze candidate SHAs<br/>before protected holdouts exist"]
  Freeze --> Holdouts["Protected holdout evaluation<br/>never exposed to Codex"]
  Holdouts --> PR["Immunity PR<br/>diff, behavior change, risks, recommendation"]
  PR --> HumanGate["Human approval gate<br/>approve / reject"]
  HumanGate --> Promote["Promoted protected ref<br/>or do not promote"]
  Promote --> Reattack["Re-attack original exploit"]
  Reattack --> Immunity["Immunity record<br/>permanent regression"]
  Immunity --> Store

  classDef surface fill:#eaf4ff,stroke:#2f6fed,color:#0f172a
  classDef core fill:#effaf1,stroke:#2f9e44,color:#0f172a
  classDef live fill:#fff3df,stroke:#f08c00,color:#0f172a
  classDef target fill:#f8f0ff,stroke:#845ef7,color:#0f172a
  classDef evidence fill:#f1f3f5,stroke:#495057,color:#0f172a
  classDef gate fill:#fff0f0,stroke:#e03131,color:#0f172a

  class Judge,UI,API surface
  class RunService,Engine,Scores,Tournament core
  class Live,OpenAI,Codex,Worktrees,Attacks,Diagnosis live
  class RefundAgent,Constitution,Actions target
  class Store,Replay,Freeze,Holdouts,Immunity evidence
  class PR,HumanGate,Promote,Reattack gate
```

## How to explain the diagram

The user sees a real-time Immune Arena, but the important system is underneath it: every screen update comes from typed run events streamed by the Fastify API. Those events are saved in an append-only JSONL log with a materialized snapshot, so a run can be replayed, resumed, audited, or recovered after restart.

There are two execution paths. Replay mode is the public, credential-free path for judging and demos. Live mode is the authenticated path that uses the OpenAI Responses API for GPT-5.6 diagnosis and attack planning, GPT-5.6 Terra for repeated target-agent conversations, and the Codex SDK to build three competing repairs in isolated Git worktrees.

The safety claim depends on the boundary between the builder and the evaluator. Codex receives only development failures, a structured mutation spec, allowed mutation files, and the candidate worktree. The deterministic evaluator, scoring code, and protected holdouts stay outside candidate worktrees. Candidate commits are frozen before protected holdouts are created.

Promotion is not automatic. Aegis creates an Immunity PR with the code diff, behavior diff, scores, fixed vulnerabilities, remaining risks, and a recommendation. A human must approve it. After approval, Aegis re-runs the original exploit against the promoted candidate and saves the vulnerability as a permanent immunity regression.

## Layer Map

| Layer | Responsibility | Main files |
| --- | --- | --- |
| Interface | Immune Arena, attack feed, candidate tournament, evidence inspector, promotion gate | `apps/aegis/src/client/` |
| API | REST endpoints, SSE stream, live-control authorization, static app serving | `apps/aegis/src/server/` |
| Engine | contracts, deterministic evaluator, scoring, state transitions, replay, promotion gates, immunity records | `packages/engine/src/` |
| Live orchestration | GPT-5.6 attack/diagnosis planning, Codex candidate builds, worktrees, live promotion and rollback | `packages/live/src/` |
| Target fixture | vulnerable refund agent, constitution, seed/development/holdout/regression scenarios | `fixtures/refund-agent/` |
| Evidence | durable run logs, snapshots, candidate details, immunity records | `.data/` at runtime |

## Trust Boundary

```mermaid
flowchart LR
  Visible["Visible to Codex<br/>dev failures + MutationSpec + allowed target files"] --> Builder["Codex candidate builder"]
  Builder --> Candidate["Candidate commit"]
  Hidden["Hidden from Codex<br/>evaluator + scoring + protected holdouts"] --> JudgeEngine["Deterministic judge"]
  Candidate --> JudgeEngine
  JudgeEngine --> Decision["Promote only if hard gates pass"]
```

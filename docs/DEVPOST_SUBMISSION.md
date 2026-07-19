# Aegis — Devpost submission draft

## Project name

Aegis

## Tagline

An immune system for AI agents: attack, repair, prove, and remember.

## One-sentence pitch

Aegis discovers behavioral failures in an AI agent, asks GPT‑5.6 and Codex to build competing repairs, tests frozen candidates against protected attacks, and places the winning Git commit behind a human approval gate.

## Inspiration

AI agents are increasingly allowed to take consequential actions, but most safety work still stops at prompts, static tests, or a model saying that its answer is safe. When a new exploit appears, teams need more than a warning: they need a reproducible failure, a bounded repair, evidence that the repair survives attacks it never saw, and a regression that prevents the vulnerability from returning.

We designed Aegis around the biological idea of an immune system. It attacks a target, verifies the damage, produces competing antibodies, selects the strongest repair under protected evaluation, and remembers the original pathogen.

## What it does

Aegis runs a deliberately vulnerable refund-support agent through an adversarial engineering loop:

1. Eight curated seed cases establish its baseline.
2. Development attacks probe prompt injection, privacy, split refunds, authority, policy conflict, and social pressure.
3. A deterministic evaluator grades every attempted action against a refund constitution.
4. GPT‑5.6 diagnoses verified failures and proposes three bounded mutation strategies.
5. Codex builds instruction-, permission-, and orchestration-focused candidates in isolated Git worktrees.
6. Candidate commits freeze before protected holdouts are created.
7. Every frozen candidate faces the same protected and regression suites.
8. Hard gates select an eligible winner, but a human must still approve it.
9. Aegis reruns the original exploit and stores its reproducer as permanent immunity.

The public replay presents this complete story without credentials. It clearly labels fixed SHAs and diffs as reference artifacts while retaining scores from the real deterministic evaluator. Genuine live mode performs actual OpenAI Responses API calls and Codex worktree mutations and never silently falls back to replay.

## Why it matters

Aegis turns agent safety from a static checklist into an inspectable engineering loop. The core idea can extend beyond refunds to any agent with a constitution, consequential tools, observable actions, and deterministic invariants: customer support, finance operations, internal automation, or developer infrastructure.

The system does not claim perfect safety or model-weight training. It demonstrates a disciplined way to discover, repair, validate, approve, and remember behavioral failures.

## Technical implementation

- **Interface:** React/Vite Immune Arena with typed event-driven evidence views.
- **API:** Fastify REST and Server-Sent Events with durable resume.
- **Evaluator:** deterministic policy and scoring engine.
- **Live orchestration:** OpenAI Responses API with GPT‑5.6 and GPT‑5.6 Terra.
- **Repair builders:** one Codex SDK thread per candidate, isolated in target-only Git worktrees.
- **Selection:** protected holdouts, immutable candidate blobs, hard promotion gates, and regression preservation.
- **Human control:** explicit approve/reject boundary and transactional live rollback.
- **Persistence:** append-only JSONL events, atomic snapshots, and immunity records.
- **Sandboxing:** filtered environments, network-disabled Codex execution, mutation-path validation, and networkless Docker guard evaluation.

## Measurable result

The deterministic reference evaluation reports:

- **41.6** baseline score with **26 hard violations** across the 8 seed and 12 development cases.
- On the separate, identical protected suite, the baseline scores **49.0**.
- Candidate C scores **98.5**, an improvement of **49.5 percentage points**, with **zero hard violations**.
- Candidates A and B improve their scores but honestly fail hard promotion gates.

These scopes remain visibly separated throughout the product and submission.

## How we used GPT‑5.6 and Codex

GPT‑5.6 is used for failure diagnosis and structured mutation planning. GPT‑5.6 Terra runs target-agent conversations and generates adversarial scenarios in genuine live mode. Codex receives observable failures, an explicit mutation specification, and a target-only worktree for each repair hypothesis.

Codex never receives the protected holdouts. Candidate commits are frozen first; protected attacks are generated afterward. This makes the final tournament evidence meaningful rather than an optimization against visible tests.

## Safety and responsible design

- No hidden chain-of-thought is displayed or treated as evidence.
- Every consequential attempted action is graded, even when a downstream tool would block it.
- Live mode is explicit and credential-gated.
- Replay never masquerades as live execution.
- Human approval is required before promotion.
- A failed candidate cannot be promoted.
- Rollback restores the prior live protected ref.
- The public deployment contains no OpenAI credentials or live mutation controls.
- The demonstration uses synthetic refund data and original character assets.

## Challenges

The hardest challenge was preserving a clean separation between visible development failures and protected evaluation while still making the result understandable in under three minutes. We also had to distinguish a repeatable public replay from genuine live evidence without overstating what either one proves.

Another challenge was evaluating the agent’s attempted action path rather than only the final tool outcome. A blocked external call can still reveal unsafe agent intent, so Aegis records and grades the attempted structured action before downstream enforcement.

## Accomplishments

- One complete attack → diagnosis → repair → protected trial → approval → immunity loop.
- Three isolated repair strategies instead of a single cherry-picked patch.
- Frozen Git candidate blobs and protected-holdout ordering.
- Honest hard-gate failures for weaker candidates.
- Durable SSE resume and restart recovery.
- Transactional human promotion and live rollback.
- A credential-free public replay with explicit evidence provenance.
- More than one hundred automated tests plus clean CI verification.

## What we learned

Agent evolution is only credible when the evidence boundary is stronger than the narrative. The most important design decision was not adding another model or agent—it was making the ordering, evaluator, mutation surface, and human gate inspectable.

We also learned that repeatability and authenticity serve different judging needs. The deterministic replay makes the product easy to experience, while a sanitized genuine live capture proves that the GPT‑5.6 and Codex path creates real commits.

## What is next

- Add more target constitutions without weakening the protected-evaluation boundary.
- Run each untrusted candidate in dedicated VM/container isolation for multi-tenant deployments.
- Add organization-specific approval policies and signed immunity records.
- Build longitudinal immunity libraries across related agent versions.
- Expand policy evaluators to additional consequential tool domains.

## Limitations

Aegis evolves prompts, permissions, policy gateways, tools, and orchestration code—not model weights. Its encoded constitution cannot anticipate every future attack. The current refund target is a focused vertical slice, and the Codex workspace-write sandbox is not presented as a hostile multi-tenant isolation boundary. Production use with untrusted builders should add dedicated VM or container isolation.

## Built with

OpenAI Responses API, GPT‑5.6, GPT‑5.6 Terra, Codex SDK, TypeScript, React, Vite, Fastify, Vitest, Git, Docker, and Blender.

## Team

Abishek and Fatima.

## Submission links

- Repository: https://github.com/Abi5678/aegis
- Public replay: https://aegis-agent-immunity.fsaguilar16.chatgpt.site
- Demo video: **ADD FINAL VIDEO URL**
- Official challenge: https://openai.devpost.com/

# Aegis final-phase plan

## Outcome

By submission, Aegis must tell one complete, provable story in under three minutes:

> An agent fails in a surprising way. Aegis proves the violation, creates three real repairs, tests them against unseen attacks, asks a human to approve the winner, blocks the original exploit, and preserves that exploit as permanent immunity.

The final phase does not add agents or target domains. It makes the existing refund-agent vertical slice undeniable, understandable, reproducible, and easy to judge.

## Judge success test

Without opening the README, a judge should be able to answer:

1. What did the target agent do wrong?
2. Which deterministic policy did it violate?
3. What did Codex change in each candidate?
4. Were protected attacks unavailable to the repair process?
5. Why did Candidate C win?
6. What changed only after human approval?
7. Does the identical original exploit fail after promotion?
8. Is that exploit now a permanent regression?

## Ownership

### Abishek — product proof and judge experience

Owns Phases 1–3 and final visual decisions:

- Immunity PR View;
- Before/After Proof Panel;
- Canonical Exploit Story Path;
- `PromotionGate.tsx`, `Inspector.tsx`, `App.tsx`, and `styles.css`;
- synchronization of the final demo script with the implemented UI.

Abishek's review question: **Can a judge understand the breakthrough in 15 seconds?**

### Fatima + Codex — reliability, provenance, and submission operations

Owns Phases 4–6:

- the shared `npm run verify`/CI gate;
- clean-clone and credential-free replay verification;
- claim-to-evidence and replay/live provenance review;
- README quickstart and evidence-mode documentation;
- submission checklist and deadline tracking;
- public replay deployment coordination;
- screenshots, Devpost copy, link audit, and final release sign-off.

Fatima's review question: **Can every public claim be proved without exposing secrets or overstating replay evidence?**

### Shared boundary

- Only Abishek edits `styles.css`.
- Only Fatima/Codex edits package, CI, and submission-checklist files.
- Announce before editing `README.md` or `docs/DEMO_SCRIPT.md`.
- Product components consume typed snapshot/candidate/event data; they do not fabricate proof copy.
- Integration happens through small PRs, with `main` green after each merge.

## Phase 0 — Claim and evidence lock

Before UI implementation, freeze a one-page evidence contract for the canonical story:

- canonical attack ID and fingerprint;
- baseline attempted action and deterministic violation;
- baseline and protected evaluation scopes;
- candidate commit/diff provenance;
- holdout-freeze ordering event;
- winning gates and remaining risks;
- post-promotion result;
- resulting immunity record.

This prevents the UI, README, and video from drifting into inconsistent numbers or mixed replay/live claims.

**Owner:** shared; Fatima validates provenance, Abishek validates clarity.

## Phase 1 — Immunity PR View

Build a familiar, inspectable engineering artifact for the winning candidate.

Required content:

- PR title, candidate, repair type, and commit/reference SHA;
- plain-language failure and repair hypothesis;
- allowed mutation paths and actual changed files;
- fixed vulnerabilities;
- baseline-to-candidate score with explicit evaluation scope;
- regression, privacy, unauthorized-action, holdout, and improvement gates;
- remaining risks;
- collapsed-by-default diff;
- explicit approve and reject actions.

Implementation requirements:

- pure `createImmunityPrViewModel(snapshot, candidate)` helper;
- all values derived from typed run/candidate data;
- distinct replay-reference and genuine-live wording;
- approval remains a hard boundary;
- focus management and reduced-motion support.

**Owner:** Abishek.

## Phase 2 — Before/After Proof Panel

Show the identical canonical exploit succeeding before repair and failing after promotion.

The two sides must share the same attack ID and fingerprint and show observable action, deterministic policy evidence, consequence/harm prevented, and score scope. The conclusion is explicit: **Original exploit blocked**.

No hidden reasoning, unrelated examples, or animation-dependent evidence.

**Owner:** Abishek.

## Phase 3 — Canonical Exploit Story Path

Add a guided path through existing event-stream evidence:

1. establish baseline;
2. highlight the canonical discovered failure;
3. open deterministic evidence;
4. follow three repairs;
5. pause at human approval;
6. rerun the identical exploit after approval;
7. open its Immunity Record.

The guide may select and emphasize events but cannot invent state outside the stream. Rejection must never display immunity.

**Owner:** Abishek.

## Phase 4 — Verification and failure hardening

Do not rewrite tests that already exist. Current coverage already includes SSE resume, candidate failure isolation, holdout ordering, approve/reject, promotion, rollback, and unconfigured live mode.

Remaining work:

- expose one `npm run verify` command;
- make CI invoke that exact command;
- run twice from a clean Node 25 install;
- perform a credential-free replay smoke test;
- run a final secrets/generated-artifacts audit;
- change live timeout behavior only if a reproducible failure is observed.

**Owner:** Fatima + Codex.

## Phase 5 — Submission packaging

- 60-second clean-clone quickstart;
- architecture and safety-boundary diagrams;
- explicit Replay vs Live evidence table;
- three-minute script synchronized to the canonical path;
- public credential-free replay URL;
- four clean screenshots;
- concise limitations section;
- complete submission checklist.

**Owner:** Fatima + Codex, with Abishek approving visuals and demo pacing.

## Phase 6 — Genuine live proof and release

Run one controlled live experiment and capture:

- GPT‑5.6 attack/diagnosis provenance;
- three real Codex candidate commits and diffs;
- proof that candidate SHAs freeze before protected holdouts are created;
- protected scores and gate decisions;
- human approval;
- blocked re-attack and stored immunity.

Sanitize secrets, local paths, and hidden reasoning. Use this capture in the video as technical proof while keeping deterministic replay as the public interactive demo.

Then:

1. merge all green integration PRs;
2. verify the public URL logged out;
3. watch the final video end to end;
4. audit every Devpost link and claim;
5. submit before the deadline rather than at the final minute.

**Owner:** shared. Abishek operates/reviews the live product flow; Fatima validates evidence and submission completeness.

## Definition of done

- the canonical story completes in under three minutes;
- a judge understands Candidate C's win in 15 seconds;
- the same exploit is visibly blocked after approval;
- replay and live evidence are never conflated;
- `npm run verify` and GitHub Actions pass;
- public replay works without credentials;
- genuine live proof is captured and sanitized;
- every submission link works in a logged-out browser;
- every claim has an inspectable source.

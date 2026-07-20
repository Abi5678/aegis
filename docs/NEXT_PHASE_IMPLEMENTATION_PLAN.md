# Aegis next-phase implementation plan

## Outcome

By submission, Aegis should tell one complete, provable story in under three minutes:

> An agent fails in a surprising way. Aegis proves the violation, creates three real repairs, tests them against unseen attacks, asks a human to approve the winner, blocks the original exploit, and preserves that exploit as permanent immunity.

This phase is not about adding more agents or a broader target domain. It is about making the existing refund-agent vertical slice undeniable, understandable, and reliable.

## Definition of a winning build

A judge should be able to answer these questions from the product without opening the README:

1. What did the target agent do wrong?
2. Which deterministic policy did it violate?
3. What did Codex change in each candidate?
4. Were the final attacks hidden from the repair process?
5. Why did one candidate win?
6. What exactly happens when a human approves it?
7. Can Aegis prove that the original exploit no longer works?
8. Will this vulnerability remain a regression test in the future?

## Workstreams and ownership

### Track A — Product proof and judge experience

**Owner: Abishek**

Own the client experience and the three-minute product story.

Primary files:

- `apps/aegis/src/client/ImmunityPrView.tsx` — new
- `apps/aegis/src/client/immunityPr.ts` — new view-model helper
- `apps/aegis/src/client/immunityPr.test.ts` — new tests
- `apps/aegis/src/client/BeforeAfterProof.tsx` — new
- `apps/aegis/src/client/PromotionGate.tsx`
- `apps/aegis/src/client/Inspector.tsx`
- `apps/aegis/src/client/App.tsx`
- `apps/aegis/src/client/styles.css`
- `docs/DEMO_SCRIPT.md`

### Track B — Reliability and submission readiness

**Owner: Teammate**

Own repeatability, CI, clean setup, and technical credibility.

Primary files:

- `package.json`
- `package-lock.json`
- `.github/workflows/ci.yml`
- live and engine tests under `packages/**`
- server/API tests under `apps/aegis/src/server/**`
- README setup, testing, and deployment sections
- `docs/SUBMISSION_CHECKLIST.md` — new

### Shared review boundary

- Abishek reviews whether technical proof is understandable.
- Teammate reviews whether every product claim is supported by real data.
- Only one person edits `README.md` at a time.
- Abishek owns `styles.css`; teammate owns package and CI files.

## Build sequence

### Phase 1 — Immunity PR View

**Goal:** Turn the winning candidate into a familiar, inspectable engineering artifact.

The view should contain:

- PR title, candidate name, repair type, and commit/reference SHA;
- plain-language failure summary;
- repair hypothesis and intended behavior;
- files allowed to change;
- fixed vulnerabilities;
- baseline → candidate score and percentage-point improvement;
- regression, privacy, unauthorized-action, holdout, and improvement gates;
- remaining risks and trade-offs;
- expandable code diff;
- explicit `Approve repair` and `Reject` actions.

Implementation rules:

- Build a pure `createImmunityPrViewModel(snapshot, candidate)` helper.
- Derive every number and status from the run snapshot or candidate data.
- Use different language for replay reference evidence and real live-run evidence.
- Do not imply replay SHAs are real commits.
- Keep human approval as a hard boundary.

Acceptance checks:

- Candidate C’s winning reason is understandable in 15 seconds.
- Failed gates are visually distinct and cannot be mistaken for passes.
- The diff remains available but does not dominate the initial view.
- Keyboard focus enters the approval dialog correctly.
- Unit tests cover replay/live labels, promotion eligibility, missing diff, and remaining risks.

### Phase 2 — Before/After Proof Panel

**Goal:** Make the central breakthrough visual: the same exploit succeeds before repair and fails after repair.

The panel should show two synchronized columns:

| Before repair | After promotion |
| --- | --- |
| Original attack text | Identical attack fingerprint |
| Unsafe attempted action | Safe action or escalation |
| Violated policy | Policy enforced |
| External consequence | Harm prevented |
| Baseline score | Promoted score |

Implementation rules:

- Reuse the canonical attack ID and fingerprint; never compare unrelated examples.
- Show observable actions and deterministic policy evidence, not hidden reasoning.
- Label simulated replay evidence clearly.
- Display a final, unambiguous statement: `Original exploit blocked`.

Acceptance checks:

- A viewer can understand the improvement with the sound off.
- The exact same attack is visibly used on both sides.
- The promoted result contains zero hard-policy violations.
- Reduced-motion mode presents the same evidence without relying on animation.

### Phase 3 — Canonical Exploit Story Path

**Goal:** Give judges a reliable one-click path through the strongest Aegis story.

Add a `Run canonical exploit` entry point that:

1. establishes the vulnerable baseline;
2. highlights the newly discovered split-refund/privacy failure;
3. opens its deterministic policy evidence;
4. follows the three candidate repairs;
5. stops at the Immunity PR for human approval;
6. reruns the original exploit after approval;
7. opens the resulting Immunity Record.

Implementation rules:

- The entry point selects and emphasizes existing real replay events.
- It must not invent success messages outside the event stream.
- The full arena remains inspectable while the guided path is active.
- The user can exit the guided path at any time.

Acceptance checks:

- The path completes in 90 seconds in accelerated replay.
- Refreshing the page produces the same result.
- The run pauses for the human approval decision.
- Rejecting the candidate does not display immunity.

### Phase 4 — Verification and failure hardening

**Goal:** Make the repository feel like serious developer infrastructure.

Teammate deliverables:

- Add `npm run verify` to run tests, typecheck, and production build.
- Make CI call the same verification command used locally.
- Stabilize the live experiment timeout without hiding genuine failures.
- Test SSE reconnection and replay resumption.
- Test candidate failure without aborting the full tournament.
- Test approve, reject, successful promotion, and rollback paths.
- Verify holdouts are created only after candidate SHAs freeze.
- Perform a clean-clone replay run with no credentials.

Acceptance checks:

- `npm run verify` passes twice consecutively from a clean install.
- GitHub Actions passes on the integration PR.
- Replay starts with one documented command and no API key.
- Live mode fails honestly and readably when credentials are absent.
- No secrets or generated worktrees are committed.

### Phase 5 — Submission packaging

**Goal:** Make evaluation effortless and claims precise.

Deliverables:

- 60-second README quickstart;
- architecture diagram showing attack → proof → mutation → holdout → approval → immunity;
- clear Live vs Replay evidence table;
- 3-minute demo script synchronized with the canonical path;
- public hosted replay URL;
- clean screenshots of infection, tournament, Immunity PR, and blocked re-attack;
- submission checklist with repository, video, Devpost, `/feedback`, and deadline status;
- one concise limitations section.

Acceptance checks:

- A new person can run replay from a clean checkout in under five minutes.
- Every demo claim points to something inspectable in the product or repository.
- The video finishes below three minutes without speeding through the core proof.
- The README never presents replay reference artifacts as live Codex output.

## Integration order

Merge in this order to reduce conflict and keep `main` usable:

1. Teammate: `verify` command and CI alignment.
2. Abishek: Immunity PR View.
3. Abishek: Before/After Proof Panel.
4. Teammate: failure-path and SSE tests.
5. Abishek: canonical exploit guided path.
6. Teammate: clean-checkout and deployment verification.
7. Shared: README and demo script.
8. Shared: final rehearsal fixes only.

Each feature gets its own branch and PR. Do not combine UI, CI, README, and test-stability work into one large PR.

## Suggested branches

Abishek:

- `codex/immunity-pr-view`
- `codex/before-after-proof`
- `codex/canonical-exploit-story`

Teammate:

- `agent/verify-and-ci`
- `agent/failure-path-tests`
- `agent/submission-readiness`

## Schedule from July 18

### July 18 — Make the proof visible

- Abishek builds and tests the Immunity PR View.
- Teammate adds `npm run verify` and aligns CI.
- Merge both after cross-review.

### July 19 — Prove the transformation

- Abishek builds the Before/After Proof Panel.
- Teammate hardens SSE, promotion, rejection, rollback, and candidate-failure tests.
- Record a rough demo to identify confusing transitions.

### July 20 — Make it judge-proof

- Abishek adds the canonical exploit guided path and polishes copy.
- Teammate validates clean clone, replay, live-mode errors, and deployment.
- Deploy the public replay and record the final video draft.

### July 21 — Submission lock

- Run verification from a clean checkout.
- Rehearse the demo three times.
- Fix only critical defects or misleading claims.
- Complete `/feedback`, repository access, Devpost fields, and final submission before the deadline.

## Demo acceptance scenario

The build is ready only when this exact story succeeds end to end:

1. Start replay without credentials.
2. Show a legitimate refund and the vulnerable baseline.
3. Show a runtime-discovered split-refund or privacy attack.
4. Inspect the unsafe action and deterministic violation.
5. Show three distinct repair strategies.
6. Show that candidate SHAs freeze before protected attacks appear.
7. Open the winning Immunity PR and explain why it won.
8. Approve it manually.
9. Rerun the identical original exploit.
10. Show `Original exploit blocked`.
11. Open the new permanent Immunity Record.
12. Run `npm run verify` successfully.

## Scope guardrails

Do not add these before submission:

- a second business domain;
- unrestricted autonomous self-modification;
- model-weight training claims;
- a general multi-tenant platform;
- unrelated chat features;
- Blender-dependent character work;
- more decorative agents without a real event or responsibility.

The strongest version of Aegis is one narrow loop with extraordinary proof—not a broad platform with unfinished edges.

## Post-submission roadmap

These are valuable after the hackathon and should not delay the vertical slice:

1. Import any agent through an adapter contract.
2. GitHub App that comments an Immunity Report on pull requests.
3. Scheduled mutation campaigns against production-like staging agents.
4. Shared organization-wide immunity registry.
5. Cross-version behavioral drift detection.
6. Policy packs for finance, healthcare, commerce, and internal tooling.
7. Human red-team collaboration and attack marketplace.

## Final decision rule

When choosing between a new feature and stronger evidence, choose stronger evidence. Aegis wins when judges trust the transformation they can see: failure → repair → protected proof → human approval → permanent immunity.

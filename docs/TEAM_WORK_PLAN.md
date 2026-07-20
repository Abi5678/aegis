# Aegis team work plan

This plan is designed for two people to move fast without stepping on each other. The goal is to make Aegis feel like a serious Developer Tools submission: beautiful enough to remember, rigorous enough to trust, and easy enough for judges to understand in under three minutes.

## Shared thesis

Aegis is CI/CD for agent behavior. It discovers agent failures, turns them into permanent tests, builds competing repairs, evaluates them against protected attacks, and produces a human-approved Immunity PR.

The demo should make one thing obvious:

> Aegis does not just explain that an agent failed. It proves the failure, repairs the agent, retests it, and remembers the exploit forever.

## Ownership split

### Abishek: product story and demo clarity

Own the judge-facing experience.

- Immune Arena polish
- Mission Briefing and plain-English narration
- Immunity PR View
- Before/After proof panel
- demo script and video flow
- visual hierarchy, copy, and storytelling

Primary files:

- `apps/aegis/src/client/`
- `apps/aegis/src/client/styles.css`
- `docs/DEMO_SCRIPT.md`
- README sections related to demo, judging, and product story

### Teammate: engineering reliability and submission readiness

Own repeatability, setup, CI, and credibility.

- GitHub Actions and CI reliability
- `npm run verify` script
- test stability
- setup docs
- deployment checklist
- clean checkout validation
- submission checklist

Primary files:

- `.github/workflows/`
- `package.json`
- `package-lock.json`
- README sections related to setup, testing, deployment, and CI
- targeted tests under `apps/aegis/src/**/*.test.ts` and `packages/**/*.test.ts`

## Branch strategy

Start every task from fresh `main`.

```bash
git checkout main
git pull
```

Abishek branch:

```bash
git checkout -b feature/demo-storytelling
```

Teammate branch:

```bash
git checkout -b feature/submission-readiness
```

If a branch already exists:

```bash
git checkout feature/demo-storytelling
git merge main
```

or:

```bash
git checkout feature/submission-readiness
git merge main
```

## Avoiding merge conflicts

Avoid both editing the same high-conflict files at the same time:

- `apps/aegis/src/client/styles.css`
- `README.md`
- `package.json`
- `package-lock.json`

Rules:

- Abishek owns `styles.css`.
- Teammate only touches `styles.css` after asking.
- Teammate owns `package.json` and `package-lock.json`.
- Abishek only touches package scripts after asking.
- Split `README.md` by section:
  - Abishek: demo, story, judge walkthrough
  - Teammate: setup, CI, deployment, verification

When a task needs shared files, make a tiny PR first, merge it, then continue.

## Immediate next tasks

### Track A: product clarity

1. Build Immunity PR View.
2. Add Before/After proof panel.
3. Make the canonical exploit path impossible to miss.
4. Add one-click "Run canonical exploit" replay entry.
5. Tighten the final promoted-state screen around the phrase "original exploit blocked."

Definition of done:

- A judge can understand the project without reading the README.
- The UI shows failure, repair, proof, approval, and immunity as one clean story.
- Replay mode remains deterministic and credential-free.

### Track B: reliability

1. Add `npm run verify` for `npm test`, `npm run typecheck`, and `npm run build`.
2. Confirm GitHub Actions passes on a clean PR.
3. Stabilize any test timeout that appears in CI.
4. Test from a clean clone.
5. Document Node 25 requirement and local setup steps.

Definition of done:

- A new teammate can clone and run replay from README instructions.
- CI passes on every PR.
- The project builds from a clean checkout.

## Pull request rules

Keep PRs small and named by outcome.

Good PR titles:

- `Add Immunity PR View`
- `Add verify script and CI docs`
- `Add Before/After proof panel`
- `Stabilize live experiment timeout`

Every PR should include:

- what changed
- why it matters for the hackathon
- screenshots or short video for UI changes
- test commands run

Before requesting review:

```bash
npm test
npm run typecheck
npm run build
```

If `npm run verify` exists, use:

```bash
npm run verify
```

## Demo division

Abishek presents the story:

- why agent behavior needs an immune system
- what the arena is showing
- why the repair is meaningful
- why the human gate matters

Teammate supports the proof:

- CI passes
- replay is deterministic
- setup is clean
- protected holdouts and regressions are separate
- the repository is credible and reviewable

## Final submission checklist

- Public repo is accessible.
- README has a 60-second quickstart.
- Replay runs without credentials.
- Live mode is clearly labeled and does not fake success.
- Demo video shows:
  - baseline failure
  - deterministic violation
  - three repair candidates
  - protected holdout
  - Immunity PR
  - human approval
  - original exploit blocked
- CI passes.
- No secrets, real customer data, or third-party character assets are included.

## Communication rule

Before starting work, post:

```text
I am working on: <task>
I expect to touch: <files>
I will avoid: <files>
```

After finishing work, post:

```text
Done: <summary>
Tests run: <commands>
Needs review: <what to look at>
```

This is the simple rhythm: small branches, clear ownership, fast review, no surprise edits.

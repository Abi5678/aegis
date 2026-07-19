# Aegis submission checklist

Submission deadline: **July 21, 2026**. Treat every unchecked item as a release blocker until the team explicitly decides otherwise.

## Product proof

- [ ] Immunity PR explains Candidate C's winning reason in 15 seconds.
- [ ] Before/after panel compares the same canonical attack ID and fingerprint.
- [ ] Canonical path pauses for approval and creates no immunity after rejection.
- [ ] Replay language consistently labels reference SHAs and diffs.
- [ ] One genuine live run is captured with real Codex commit SHAs and protected-holdout ordering.
- [ ] Live evidence is sanitized: no API keys, control tokens, private paths, or hidden reasoning.

## Reliability

- [ ] `npm ci` succeeds from a clean clone on Node 25.
- [ ] `npm run verify` passes twice consecutively.
- [ ] GitHub Actions passes on the final integration commit.
- [ ] `npm run demo` starts replay with no credentials.
- [ ] Live mode fails clearly when credentials or Codex enablement are absent.
- [ ] Repository contains no `.env*`, runtime data, generated worktrees, or secrets.
- [ ] Final integration branch is merged and `main` is green.

## Judge experience

- [x] Public replay URL works without credentials: https://aegis-agent-immunity.fsaguilar16.chatgpt.site
- [x] Public deployment exposes replay only and contains no live credentials.
- [x] Infection, tournament, Immunity PR, and blocked re-attack screenshots are captured.
- [ ] Three-minute video follows the canonical path and finishes under the limit.
- [ ] Video explicitly distinguishes replay evidence from captured live evidence.
- [ ] Product can be understood with sound off; captions or readable callouts are present.

## Submission materials

- [ ] Devpost project description states the problem, solution, approach, impact, and limitations.
- [ ] Repository and public demo URLs are final; video URL is still required.
- [ ] Both teammates are registered and credited correctly.
- [ ] Required track/category selections are confirmed against the current Devpost form.
- [ ] Any `/feedback` requirement shown by Devpost is completed and verified.
- [ ] Project license is selected intentionally by the repository owner.
- [x] README includes CI status, quickstart, evidence-mode distinctions, screenshots, public replay, and team credit.
- [ ] Repository description, homepage URL, social preview, and topics are configured.

## Final claim audit

For every number or claim used in the product, README, video, or Devpost entry:

- [ ] the evidence source is identified;
- [ ] the evaluation scope is stated;
- [ ] replay and live provenance are not mixed;
- [ ] limitations and remaining risks are visible;
- [ ] no claim depends on hidden chain-of-thought.

## Release sign-off

- [ ] Abishek approves judge-flow clarity and final visuals.
- [ ] Fatima approves claim provenance, reliability, and submission completeness.
- [ ] Both teammates watch the final video from beginning to end.
- [ ] Both teammates open the submitted links from a logged-out browser.
- [ ] Devpost submission is saved early, reviewed once, and submitted before the deadline.

# Final links and deadline audit

Last audited: **July 19, 2026 (America/New_York)**

Official OpenAI Build Week deadline: **July 21, 2026**. The public OpenAI page lists the date but not the cutoff time, so the team must confirm the exact timezone and time shown in the authenticated Devpost submission form. Do not plan around an assumed 11:59 p.m. cutoff.

## Link status

| Item | URL | Status |
| --- | --- | --- |
| Repository | https://github.com/Abi5678/aegis | Public and accessible |
| Public replay | https://aegis-agent-immunity.fsaguilar16.chatgpt.site | Public, credential-free, end-to-end flow verified |
| CI | https://github.com/Abi5678/aegis/actions/workflows/ci.yml | Passing on the submission-readiness PR |
| Official challenge | https://openai.devpost.com/ | Reachable; authenticated form review still required |
| Demo video | Not yet supplied | **Submission blocker** |

## Verified public replay behavior

- Page loads without authentication.
- No live-control token input or live execution surface is present.
- Canonical split-refund evidence is visible.
- Three repair candidates are distinguishable.
- Human approval is required.
- Approval produces the explicit `Original exploit blocked` proof.
- No browser warnings or errors were observed during the production flow.

## Owner-only GitHub settings

The collaborator account can push code but cannot edit repository metadata. Abishek should update these settings:

1. Set **Website** to `https://aegis-agent-immunity.fsaguilar16.chatgpt.site`.
2. Add topics: `openai`, `codex`, `ai-agents`, `agent-safety`, `hackathon`, `typescript`.
3. Upload a social preview image that matches the final submission.
4. Select and add a license intentionally; do not add one without the repository owner’s decision.

## Remaining deadline blockers

- [ ] Confirm the exact Devpost cutoff time and timezone.
- [ ] Add both teammates to the Devpost submission.
- [ ] Record, upload, and verify the final demo video.
- [ ] Replace the video placeholder in `docs/DEVPOST_SUBMISSION.md`.
- [ ] Complete any `/feedback` or track-specific field visible in the current Devpost form.
- [ ] Capture one sanitized genuine live run or explicitly scope the final video to implemented/tested live capability plus deterministic replay.
- [ ] Merge the final green integration PR.
- [ ] Open every submitted link from a logged-out browser immediately before submission.

## Recommended internal cutoff

Finish the video and genuine-live evidence by **July 20**. Submit the complete Devpost entry no later than the morning of **July 21**, after both teammates perform the logged-out link check.

# Aegis submission video recording plan

## Creative direction

The video is a three-minute product proof, not a feature tour.

The central dramatic idea is **infection → evolution → immunity**:

1. A vulnerable agent makes a consequential mistake.
2. Aegis proves the mistake with deterministic evidence.
3. GPT-5.6 diagnoses the failure.
4. Codex builds three competing repairs.
5. Hidden holdouts select the strongest repair.
6. A human approves the Immunity PR.
7. The exact original exploit is blocked and remembered forever.

The screen should always show evidence for the sentence being narrated. Avoid scrolling through dense interfaces while explaining a different concept.

## Target format

- Final duration: **2:45–2:55**, never over 3:00.
- Recording: 1920×1080, 30 fps, landscape.
- Browser zoom: 90–100%, whichever shows the entire arena cleanly.
- Cursor: deliberate, slow movements; no circles or nervous motion.
- Notifications: disabled.
- Browser tabs and bookmarks: hidden if possible.
- Source recording must include an audio track, even if silent, for the current renderer.
- Record without spoken narration. The voice-over will be added afterward.
- Leave roughly one second of visual stillness before and after every important click.

## Shot-by-shot recording blueprint

### 0:00–0:12 — Cold open: the consequence

**Screen**

- Begin on a close, readable evidence view of the vulnerable refund agent.
- Show the malicious customer request and the attempted unsafe refund/private-data action.
- Let the red policy violation become visible.

**Voice-over intent**

“An AI support agent has just approved an unsafe refund and exposed protected information. Its tool may block the action, but the agent has already reasoned unsafely.”

**Why this works**

It begins with stakes, not a logo or dashboard explanation.

### 0:12–0:25 — Reveal Aegis

**Screen**

- Return to the full Immune Arena.
- Let the shield fracture and attack feed update.
- Briefly hold on the product name and phase spine.

**Voice-over intent**

“Aegis is an immune system for AI agents. It attacks, repairs, proves, and remembers behavioral failures before they reach production.”

### 0:25–0:46 — Deterministic proof

**Screen**

- Select the newly discovered attack in the left feed.
- Show the exact input, structured attempted action, violated rule, and external consequence in the inspector.
- Hold long enough to read the policy name.

**Voice-over intent**

“This exploit was not in the seed tests. GPT-5.6 discovered the variant at runtime, while a deterministic policy engine verified the attempted action against the refund constitution.”

**Required visible proof**

- Attack marked runtime-discovered.
- Policy violation marked deterministic.
- Unsafe action is observable.
- Baseline score or hard-violation count is visible.

### 0:46–1:08 — Diagnosis and repair generation

**Screen**

- Let Historian cluster the verified failures.
- Show Diagnostician producing the concise diagnosis.
- Show three Builders creating candidates A, B, and C.
- Select each candidate briefly so its distinct strategy is visible.

**Voice-over intent**

“GPT-5.6 clusters the verified failures and proposes three distinct repair strategies. Codex implements each one in an isolated worktree: instructions, permissions, and orchestration.”

**Required visible proof**

- Three distinct mutation kinds.
- Allowed files or bounded mutation surface.
- Commit/reference SHA per candidate.
- A real live capture should be used when describing actual Codex commits.

### 1:08–1:25 — Protected evaluation boundary

**Screen**

- Highlight the event where candidate SHAs freeze.
- Then show protected holdouts appearing.
- Pause on the ordering evidence.

**Voice-over intent**

“Every candidate freezes before protected attacks are created. Codex never sees these holdouts, so the final score measures generalization rather than memorization.”

This is the most technically differentiating moment. Give it enough screen time.

### 1:25–1:48 — Candidate tournament

**Screen**

- Show all three candidate scores together.
- Inspect A and B just long enough to reveal why they fail.
- Land on C with zero hard violations and the strongest holdout result.

**Voice-over intent**

“The first two repairs improve the score but still fail hard safety gates. Candidate C preserves legitimate refunds, reaches 98.5 on the protected suite, and eliminates hard-policy violations.”

**Required visible proof**

- A and B fail honestly.
- C: protected baseline 49.0 → 98.5, +49.5 percentage points.
- Zero hard violations.
- Regression passed.

### 1:48–2:18 — Immunity PR

**Screen**

- Open Candidate C’s Immunity PR.
- Move through failure, patch, behavioral difference, score change, gates, code diff, and remaining risk.
- Pause before approval.

**Voice-over intent**

“Aegis packages the winner as an Immunity PR: what failed, what changed, which vulnerabilities were fixed, the behavioral and code diff, protected evidence, and remaining risk.”

**Interaction**

- Hold the approval screen for two seconds.
- Click `Approve repair` once.

**Voice-over intent after click**

“Nothing promotes itself. A human reviews the evidence and explicitly approves the repair.”

### 2:18–2:42 — Re-infection proof

**Screen**

- Rerun the exact canonical exploit.
- Show the matching attack fingerprint.
- Show the unsafe action replaced by refusal or escalation.
- Land on the Before/After panel or `Original exploit blocked` state.

**Voice-over intent**

“Now Aegis reruns the identical exploit. The promoted agent blocks it, the deterministic evaluator confirms the repair, and the original vulnerability becomes a permanent regression test.”

### 2:42–2:55 — Final thesis

**Screen**

- Show the permanent Immunity Record, fingerprint, repair commit, and regression status.
- End on the full living arena with the shield stable.
- Hold the last frame for two seconds.

**Voice-over intent**

“Aegis is not another agent that claims it is safe. It is an engineering system that attacks, changes, proves, and remembers—with GPT-5.6, Codex, deterministic evidence, and a human gate.”

## Recording procedure

### Before recording

1. Start from a fresh browser window at the public replay or verified local build.
2. Use the accelerated deterministic replay if it includes every required event.
3. Clear prior selections and begin from a predictable state.
4. Rehearse the click path twice with a timer.
5. Confirm labels and numbers are readable at the recording resolution.
6. Confirm the recording tool captures an audio track.

### During recording

1. Wait two seconds on the initial frame.
2. Move the cursor directly to each target.
3. Pause before and after clicks.
4. Do not speak.
5. If one interaction goes wrong, restart the full take rather than trying to hide a confusing jump.
6. End with two seconds of stillness.

### Recommended capture strategy

Record two source clips:

- **Primary product story:** one uninterrupted replay take, approximately 2:30–2:45.
- **Authenticity insert:** a short sanitized live-mode capture showing real GPT-5.6 activity, Codex mutation, and genuine commit SHAs.

The final edit can place the authenticity insert during the diagnosis/repair section. This lets the polished replay deliver a reliable story without using replay artifacts as proof of real Codex execution.

## Voice-over workflow

After the screen recording is provided:

1. Inspect its exact duration, resolution, frame rate, scene changes, and audio streams.
2. Create a hand-authored `script.json` aligned to the visible beats above.
3. Keep narration near 2.0–2.2 spoken words per second for clarity.
4. Review factual claims against the screen and repository.
5. Generate narration with the existing timeline layout.
6. Inspect segment durations and shorten any line that spills into the next scene.
7. Render the voiced video with original audio muted or very low.
8. Review the final video for clipping, dead air, pronunciation, and claim/evidence alignment.
9. Produce the final submission video plus the editable script and narration WAV.

Recommended command after the script is approved:

```bash
/Users/abishek/agent-businesses/07-software-development-house/voiceover/vo \
  run /absolute/path/to/aegis-demo.mov \
  --review \
  --context "Aegis is an OpenAI Developer Tools hackathon project. Emphasize deterministic policy evidence, GPT-5.6 diagnosis, three Codex repairs, protected holdouts created after candidate freeze, human approval, and the identical exploit being blocked. Never describe replay reference SHAs as genuine commits."
```

For the final render, use timeline layout and mute distracting source audio:

```bash
/Users/abishek/agent-businesses/07-software-development-house/voiceover/vo \
  run /absolute/path/to/aegis-demo.mov \
  --layout timeline \
  --voice Kore \
  --original-volume 0
```

## Pipeline assessment

### What is already strong

- It can inspect arbitrary `.mov` or `.mp4` recordings.
- Timestamped segments work well for UI demonstrations.
- Each line is cached, making voice revisions faster.
- Video is stream-copied, so rendering does not unnecessarily degrade the picture.
- Script, narration, and final output remain editable artifacts.

### Practical cautions

- The renderer assumes the source video contains an audio stream. Record a silent audio track or add one before rendering.
- Synthesized narration is not automatically time-stretched. Overlong lines can spill into later beats.
- Cached audio is indexed by segment number, not script content. Delete the corresponding cached segment after changing its text.
- The automatic script generator can describe what it sees, but the final Aegis narration should be manually verified because evidence provenance matters.
- Product names, `GPT-5.6`, `Codex`, `Aegis`, and percentage-point values need a pronunciation check before final export.

## Final delivery package

- `aegis-demo-source.mov` — original screen recording
- `script.json` — approved timestamped narration
- `narration.wav` — clean narration stem
- `aegis-demo-final.mp4` — submission-ready video
- optional caption file or burned-in captions
- thumbnail showing the fractured shield and three competing repair candidates

## Final quality gate

The video is ready when a technically sophisticated judge can watch it once and correctly explain:

> Aegis finds an unseen behavioral exploit, verifies it deterministically, uses GPT-5.6 and Codex to create bounded competing repairs, evaluates frozen candidates against protected attacks, requires human approval, blocks the original exploit, and preserves it as permanent immunity.

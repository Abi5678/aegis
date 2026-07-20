# Three-minute Aegis demo script

## 0:00–0:20 — The claim

“Agents fail in ways their builders did not anticipate. Aegis is an immune system: it discovers those failures, builds competing repairs, and proves immunity before a human promotes anything.”

Start the 90-second deterministic reference simulation. Point out that every movement in the arena is driven by a typed `RunEvent`, not decorative fake work. Say explicitly that replay SHAs/diffs are reference artifacts; use a captured live run when claiming real Codex commits.

## 0:20–0:50 — Infection

Show the vulnerable refund agent approving a cross-channel over-refund and exposing private data. Open one feed item and show:

- the exact customer attack;
- the structured attempted action;
- the deterministic rule and external consequence;
- the low baseline score.

Say: “This split-refund attack was not part of the eight seed tests.”

## 0:50–1:25 — Evolution

Show Historian/Diagnostician clustering verified failures. Three Codex Builders create independent instruction, permission, and orchestration repairs. In live mode, inspect their real diffs and frozen commit SHAs; in replay, call them reference diffs and SHAs.

Say: “Protected attacks are created only after every candidate SHA freezes and are never sent to Codex. Two candidates run concurrently; one failure cannot kill the experiment.”

## 1:25–2:00 — Natural selection

Follow the candidate tournament. A and B improve but retain hard failures. C preserves legitimate refunds and reaches the protected round.

Emphasize the ordering event: candidate SHAs freeze first; only then are ten unseen holdouts created.

## 2:00–2:35 — Immunity PR

Open Candidate C’s Immunity PR. Show:

- behavioral and code diff;
- protected holdout: 49.0 → 98.5 (+49.5pp), with the separate visible baseline labeled 41.6;
- zero privacy/unauthorized actions;
- regression, score, and improvement gates;
- remaining risk disclosure.

Approve it manually.

## 2:35–3:00 — Re-infection

After approval, open **Verify immunity**, select the saved exploit, and run its exact serialized reproducer. Show the vulnerable baseline attempting the forbidden action beside the promoted candidate's safe response, then let the interface declare **Original exploit blocked** only after deterministic grading passes.

Close with: “The breakthrough is not another agent that claims it is safe. It is an agent engineering system that attacks, changes, proves, and remembers—with deterministic evidence and a human gate.”

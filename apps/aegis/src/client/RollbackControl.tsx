import type { RunSnapshot } from "./types.js";
import { CloseIcon } from "./icons.js";

export function canRollbackPromotion(snapshot: RunSnapshot | null): boolean {
  return snapshot?.mode === "live" && snapshot.status === "promoted";
}

export function RollbackControl({
  snapshot,
  pending,
  onRollback,
}: {
  snapshot: RunSnapshot | null;
  pending: boolean;
  onRollback: () => void;
}) {
  if (!canRollbackPromotion(snapshot)) return null;
  return (
    <div className="rollback-control" role="region" aria-label="Live promotion rollback">
      <span>The protected ref points to this repair. Attack memory will be retained.</span>
      <button
        className="button button--compact button--rollback"
        type="button"
        disabled={pending}
        onClick={onRollback}
      >
        <CloseIcon size={12} /> {pending ? "Rolling back…" : "Roll back protected ref"}
      </button>
    </div>
  );
}

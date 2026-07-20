import { useCallback, useEffect, useRef, useState } from "react";
import { createRun, getCandidate, getImmunity, getRun, promoteCandidate, rollbackPromotion, subscribeToRun, verifyImmunity } from "./api.js";
import type {
  CandidateDetail,
  ImmunityRecord,
  ImmunityVerification,
  RunEvent,
  RunMode,
  RunSnapshot,
} from "./types.js";
import { getReconnectDelay } from "./reconnect.js";

interface AegisRunState {
  snapshot: RunSnapshot | null;
  events: RunEvent[];
  immunity: ImmunityRecord[];
  inheritedImmunityIds: string[];
  candidateDetail: CandidateDetail | null;
  verification: ImmunityVerification | null;
  connecting: boolean;
  actionPending: boolean;
  error: string | null;
  start: (mode: RunMode, controlToken?: string) => Promise<void>;
  inspectCandidate: (candidateId: string) => Promise<void>;
  decide: (candidateId: string, decision: "approve" | "reject") => Promise<void>;
  rollback: () => Promise<void>;
  verify: (recordId: string) => Promise<void>;
  clearError: () => void;
}

function isRunEvent(value: unknown): value is RunEvent {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      "snapshot" in value,
  );
}

export function useAegisRun(): AegisRunState {
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [immunity, setImmunity] = useState<ImmunityRecord[]>([]);
  const [inheritedImmunityIds, setInheritedImmunityIds] = useState<string[]>([]);
  const [candidateDetail, setCandidateDetail] = useState<CandidateDetail | null>(null);
  const [verification, setVerification] = useState<ImmunityVerification | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const connectionGenerationRef = useRef(0);
  const lastEventIdRef = useRef(0);
  const snapshotRef = useRef<RunSnapshot | null>(null);
  const controlTokenRef = useRef<string | null>(null);

  const stopConnections = useCallback(() => {
    connectionGenerationRef.current += 1;
    sourceRef.current?.close();
    sourceRef.current = null;
    if (reconnectRef.current !== null) window.clearTimeout(reconnectRef.current);
    reconnectRef.current = null;
  }, []);

  useEffect(() => {
    getImmunity().then(setImmunity).catch(() => undefined);
    return stopConnections;
  }, [stopConnections]);

  const connect = useCallback(
    (runId: string) => {
      stopConnections();
      const generation = connectionGenerationRef.current;

      const openStream = (attempt: number) => {
        if (connectionGenerationRef.current !== generation) return;
        if (snapshotRef.current && ["promoted", "rolled_back", "rejected", "failed"].includes(snapshotRef.current.status)) {
          setConnecting(false);
          return;
        }
        let streamFailed = false;
        const stream = subscribeToRun(
          runId,
          lastEventIdRef.current,
          (message) => {
            try {
              const parsed: unknown = JSON.parse(message.data);
              if (!isRunEvent(parsed)) return;
              lastEventIdRef.current = Math.max(lastEventIdRef.current, parsed.id);
              snapshotRef.current = parsed.snapshot;
              setSnapshot(parsed.snapshot);
              setEvents((current) => {
                if (current.some((event) => event.id === parsed.id)) return current;
                return [...current, parsed].sort((a, b) => a.id - b.id).slice(-120);
              });
              setConnecting(false);
            } catch {
              setError("Aegis received a malformed event. The run is still active.");
            }
          },
          () => {
            if (streamFailed || connectionGenerationRef.current !== generation) return;
            streamFailed = true;
            stream.close();
            if (sourceRef.current === stream) sourceRef.current = null;
            if (snapshotRef.current && ["promoted", "rolled_back", "rejected", "failed"].includes(snapshotRef.current.status)) {
              setConnecting(false);
              return;
            }
            setConnecting(true);
            // Refresh the materialized state while disconnected, but keep the
            // event stream as the source of truth for missed evidence.
            void getRun(runId).then((next) => {
              snapshotRef.current = next;
              setSnapshot(next);
            }).catch(() => undefined);
            reconnectRef.current = window.setTimeout(() => {
              reconnectRef.current = null;
              openStream(attempt + 1);
            }, getReconnectDelay(attempt));
          },
        );
        stream.onopen = () => {
          if (connectionGenerationRef.current !== generation) {
            stream.close();
            return;
          }
          setConnecting(false);
        };
        sourceRef.current = stream;
      };

      openStream(0);
    },
    [stopConnections],
  );

  const start = useCallback(
    async (mode: RunMode, controlToken?: string) => {
      setConnecting(true);
      setError(null);
      setSnapshot(null);
      snapshotRef.current = null;
      lastEventIdRef.current = 0;
      controlTokenRef.current = mode === "live" ? controlToken?.trim() || null : null;
      setEvents([]);
      setCandidateDetail(null);
      setVerification(null);
      try {
        const beforeRun = await getImmunity().catch(() => immunity);
        setImmunity(beforeRun);
        setInheritedImmunityIds(beforeRun.map((record) => record.id));
        const runId = await createRun(mode, controlTokenRef.current ?? undefined);
        const initial = await getRun(runId);
        snapshotRef.current = initial;
        setSnapshot(initial);
        connect(runId);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to awaken Aegis.");
        setConnecting(false);
      }
    },
    [connect, immunity],
  );

  const inspectCandidate = useCallback(
    async (candidateId: string) => {
      if (!snapshot) return;
      const inline = snapshot.candidates.find((candidate) => candidate.id === candidateId) ?? null;
      setCandidateDetail(inline);
      try {
        setCandidateDetail(await getCandidate(snapshot.id, candidateId));
      } catch {
        // The snapshot already contains a complete enough candidate for inspection.
      }
    },
    [snapshot],
  );

  const decide = useCallback(
    async (candidateId: string, decision: "approve" | "reject") => {
      if (!snapshot) return;
      setActionPending(true);
      setError(null);
      try {
        const result = await promoteCandidate(
          snapshot.id,
          candidateId,
          decision,
          snapshot.mode,
          snapshot.mode === "live" ? controlTokenRef.current ?? undefined : undefined,
        );
        snapshotRef.current = result.snapshot;
        setSnapshot(result.snapshot);
        setImmunity(await getImmunity().catch(() => immunity));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "The promotion gate could not complete.");
      } finally {
        setActionPending(false);
      }
    },
    [immunity, snapshot],
  );

  const rollback = useCallback(async () => {
    if (!snapshot || snapshot.mode !== "live" || snapshot.status !== "promoted") return;
    setActionPending(true);
    setError(null);
    try {
      const result = await rollbackPromotion(
        snapshot.id,
        controlTokenRef.current ?? "",
      );
      snapshotRef.current = result.snapshot;
      setSnapshot(result.snapshot);
      lastEventIdRef.current = Math.max(lastEventIdRef.current, result.event.id);
      setEvents((current) => current.some((event) => event.id === result.event.id)
        ? current
        : [...current, result.event].sort((left, right) => left.id - right.id).slice(-120));
      setImmunity(await getImmunity().catch(() => result.immunityRecords));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The live promotion could not be rolled back.");
    } finally {
      setActionPending(false);
    }
  }, [snapshot]);

  const verify = useCallback(async (recordId: string) => {
    if (!snapshot || snapshot.status !== "promoted") return;
    setActionPending(true);
    setError(null);
    setVerification(null);
    try {
      const [result] = await Promise.all([
        verifyImmunity(
          snapshot.id,
          recordId,
          snapshot.mode,
          snapshot.mode === "live" ? controlTokenRef.current ?? undefined : undefined,
        ),
        new Promise<void>((resolve) => window.setTimeout(resolve, 750)),
      ]);
      setVerification(result.verification);
      snapshotRef.current = result.event.snapshot;
      setSnapshot(result.event.snapshot);
      lastEventIdRef.current = Math.max(lastEventIdRef.current, result.event.id);
      setEvents((current) => current.some((event) => event.id === result.event.id)
        ? current
        : [...current, result.event].sort((left, right) => left.id - right.id).slice(-120));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The immunity reproducer could not be verified.");
    } finally {
      setActionPending(false);
    }
  }, [snapshot]);

  return {
    snapshot,
    events,
    immunity,
    inheritedImmunityIds,
    candidateDetail,
    verification,
    connecting,
    actionPending,
    error,
    start,
    inspectCandidate,
    decide,
    rollback,
    verify,
    clearError: () => setError(null),
  };
}

import type { CandidateDetail, ImmunityRecord, ImmunityVerification, RunEvent, RunMode, RunSnapshot } from "./types.js";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function liveControlHeader(mode: RunMode, controlToken?: string): Record<string, string> {
  const token = controlToken?.trim();
  return mode === "live" && token ? { "x-aegis-control-token": token } : {};
}

export async function createRun(mode: RunMode, controlToken?: string): Promise<string> {
  const result = await request<{ runId: string }>("/api/runs", {
    method: "POST",
    headers: liveControlHeader(mode, controlToken),
    body: JSON.stringify({ mode, target: "refund-agent" }),
  });
  return result.runId;
}

export function getRun(runId: string): Promise<RunSnapshot> {
  return request(`/api/runs/${encodeURIComponent(runId)}`);
}

export function getCandidate(runId: string, candidateId: string): Promise<CandidateDetail> {
  return request(
    `/api/runs/${encodeURIComponent(runId)}/candidates/${encodeURIComponent(candidateId)}`,
  );
}

export function promoteCandidate(
  runId: string,
  candidateId: string,
  decision: "approve" | "reject",
  mode: RunMode,
  controlToken?: string,
): Promise<{ snapshot: RunSnapshot; immunityRecord?: ImmunityRecord }> {
  return request(`/api/runs/${encodeURIComponent(runId)}/promotion`, {
    method: "POST",
    headers: liveControlHeader(mode, controlToken),
    body: JSON.stringify({ candidateId, decision }),
  });
}

export function rollbackPromotion(
  runId: string,
  controlToken: string,
): Promise<{ snapshot: RunSnapshot; event: import("./types.js").RunEvent; immunityRecords: ImmunityRecord[] }> {
  return request(`/api/runs/${encodeURIComponent(runId)}/rollback`, {
    method: "POST",
    headers: liveControlHeader("live", controlToken),
  });
}

export function verifyImmunity(
  runId: string,
  recordId: string,
  mode: RunMode,
  controlToken?: string,
): Promise<{ verification: ImmunityVerification; event: RunEvent }> {
  return request(`/api/runs/${encodeURIComponent(runId)}/immunity/verify`, {
    method: "POST",
    headers: liveControlHeader(mode, controlToken),
    body: JSON.stringify({ recordId }),
  });
}

export async function getImmunity(): Promise<ImmunityRecord[]> {
  const result = await request<ImmunityRecord[] | { records: ImmunityRecord[] }>("/api/immunity");
  return Array.isArray(result) ? result : result.records;
}

export function subscribeToRun(
  runId: string,
  afterEventId: number,
  onEvent: (event: MessageEvent<string>) => void,
  onError: () => void,
): EventSource {
  const params = new URLSearchParams({ after: String(Math.max(0, afterEventId)) });
  const stream = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events?${params}`);
  stream.onmessage = onEvent;
  stream.onerror = onError;
  return stream;
}

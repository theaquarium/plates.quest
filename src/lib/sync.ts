import type { TripMutation, TripSnapshot } from "../../shared/types";
import { acceptRemoteTrip, loadState, type PendingOperation } from "./store";

export type SyncPhase = "idle" | "syncing" | "offline" | "error";

export interface SyncState {
  phase: SyncPhase;
  message: string;
}

let syncState: SyncState = {
  phase: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "idle",
  message: "Up to date",
};
let activeSync: Promise<void> | null = null;
let rerunAll = false;
const rerunTripIds = new Set<string>();
const listeners = new Set<() => void>();

function updateSyncState(next: SyncState) {
  syncState = next;
  for (const listener of listeners) listener();
}

export function getSyncState(): SyncState {
  return syncState;
}

export function subscribeToSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // The status still provides a useful fallback error.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function fetchRemoteTrip(tripId: string): Promise<TripSnapshot> {
  return api<TripSnapshot>(`/api/trips/${tripId}`);
}

async function createRemoteTrip(operation: Extract<PendingOperation, { kind: "create" }>) {
  const snapshot = await api<TripSnapshot>(`/api/trips/${operation.tripId}`, {
    method: "PUT",
    body: JSON.stringify(operation.input),
  });
  acceptRemoteTrip(snapshot, [operation.id]);
}

async function sendMutations(tripId: string, operations: Extract<PendingOperation, { kind: "mutation" }>[]) {
  if (operations.length === 0) return;
  const mutations: TripMutation[] = operations.map((operation) => operation.mutation);
  const snapshot = await api<TripSnapshot>(`/api/trips/${tripId}/mutations`, {
    method: "POST",
    body: JSON.stringify({ mutations }),
  });
  acceptRemoteTrip(snapshot, operations.map((operation) => operation.id));
}

async function performSync(onlyTripId?: string): Promise<void> {
  if (!navigator.onLine) {
    updateSyncState({ phase: "offline", message: "Saved offline" });
    return;
  }

  updateSyncState({ phase: "syncing", message: "Syncing…" });
  const initial = loadState();
  const tripIds = onlyTripId ? [onlyTripId] : Object.keys(initial.trips);

  for (const tripId of tripIds) {
    let state = loadState();
    const create = state.pending.find(
      (operation): operation is Extract<PendingOperation, { kind: "create" }> =>
        operation.kind === "create" && operation.tripId === tripId,
    );
    if (create) await createRemoteTrip(create);

    state = loadState();
    const mutations = state.pending.filter(
      (operation): operation is Extract<PendingOperation, { kind: "mutation" }> =>
        operation.kind === "mutation" && operation.tripId === tripId,
    );
    await sendMutations(tripId, mutations);

    state = loadState();
    if (!state.pending.some((operation) => operation.tripId === tripId)) {
      const snapshot = await fetchRemoteTrip(tripId);
      acceptRemoteTrip(snapshot);
    }
  }

  updateSyncState({ phase: "idle", message: "Up to date" });
}

export function syncTrips(onlyTripId?: string): Promise<void> {
  if (activeSync) {
    if (onlyTripId) rerunTripIds.add(onlyTripId);
    else rerunAll = true;
    return activeSync;
  }

  activeSync = (async () => {
    let nextTripId = onlyTripId;
    do {
      rerunAll = false;
      rerunTripIds.clear();
      await performSync(nextTripId);
      if (!rerunAll && rerunTripIds.size === 0) break;
      nextTripId = !rerunAll && rerunTripIds.size === 1
        ? rerunTripIds.values().next().value
        : undefined;
    } while (navigator.onLine);
  })()
    .catch((error: unknown) => {
      if (!navigator.onLine || error instanceof TypeError) {
        updateSyncState({ phase: "offline", message: "Saved offline" });
        return;
      }
      updateSyncState({
        phase: "error",
        message: error instanceof Error ? error.message : "Sync paused",
      });
    })
    .finally(() => {
      activeSync = null;
    });
  return activeSync;
}

export function startBackgroundSync(): () => void {
  const sync = () => void syncTrips();
  const onOffline = () => updateSyncState({ phase: "offline", message: "Saved offline" });
  const onVisibility = () => {
    if (document.visibilityState === "visible") sync();
  };

  window.addEventListener("online", sync);
  window.addEventListener("offline", onOffline);
  window.addEventListener("focus", sync);
  document.addEventListener("visibilitychange", onVisibility);
  const interval = window.setInterval(sync, 30_000);
  sync();

  return () => {
    window.removeEventListener("online", sync);
    window.removeEventListener("offline", onOffline);
    window.removeEventListener("focus", sync);
    document.removeEventListener("visibilitychange", onVisibility);
    window.clearInterval(interval);
  };
}

import type {
  CreateTripInput,
  PlateState,
  RegionId,
  TripMutation,
  TripSnapshot,
} from "../../shared/types";
import { PLATE_BY_ID } from "../../shared/catalog";

const STORAGE_KEY = "plates.quest.v1";
const STORE_EVENT = "plates-quest:store";

export interface LocalTrip extends TripSnapshot {
  joinedAt: number;
}

export type PendingOperation =
  | {
      id: string;
      kind: "create";
      tripId: string;
      input: CreateTripInput;
    }
  | {
      id: string;
      kind: "mutation";
      tripId: string;
      mutation: TripMutation;
    };

export interface LocalState {
  version: 1;
  deviceId: string;
  trips: Record<string, LocalTrip>;
  pending: PendingOperation[];
}

function newState(): LocalState {
  return {
    version: 1,
    deviceId: crypto.randomUUID(),
    trips: {},
    pending: [],
  };
}

export function loadState(): LocalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const state = newState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return state;
    }
    const parsed = JSON.parse(raw) as Partial<LocalState>;
    if (
      parsed.version !== 1 ||
      typeof parsed.deviceId !== "string" ||
      !parsed.trips ||
      !Array.isArray(parsed.pending)
    ) {
      throw new Error("Unsupported local data");
    }
    return parsed as LocalState;
  } catch {
    const state = newState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }
}

function saveState(state: LocalState): LocalState {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(STORE_EVENT));
  return state;
}

function updateState(update: (state: LocalState) => LocalState): LocalState {
  return saveState(update(loadState()));
}

export function subscribeToState(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(STORE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(STORE_EVENT, listener);
  };
}

export function createLocalTrip(name: string, regions: RegionId[]): LocalTrip {
  const state = loadState();
  const id = crypto.randomUUID();
  const now = Date.now();
  const input: CreateTripInput = {
    name: name.trim(),
    regions,
    createdAt: now,
    clientId: state.deviceId,
  };
  const trip: LocalTrip = {
    id,
    name: input.name,
    nameEditedAt: now,
    nameEditedBy: state.deviceId,
    regions,
    regionsEditedAt: now,
    regionsEditedBy: state.deviceId,
    createdAt: now,
    updatedAt: now,
    plates: {},
    joinedAt: now,
  };

  saveState({
    ...state,
    trips: { ...state.trips, [id]: trip },
    pending: [...state.pending, { id: crypto.randomUUID(), kind: "create", tripId: id, input }],
  });
  return trip;
}

export function joinLocalTrip(snapshot: TripSnapshot): LocalTrip {
  const trip = { ...snapshot, joinedAt: Date.now() };
  updateState((state) => ({
    ...state,
    trips: { ...state.trips, [snapshot.id]: trip },
  }));
  return trip;
}

export function renameLocalTrip(tripId: string, name: string): void {
  updateState((state) => {
    const trip = state.trips[tripId];
    if (!trip) return state;
    const editedAt = Date.now();
    const mutation: TripMutation = {
      id: crypto.randomUUID(),
      type: "name",
      name: name.trim(),
      editedAt,
      clientId: state.deviceId,
    };
    const withoutOlderRename = state.pending.filter(
      (operation) => !(
        operation.kind === "mutation" &&
        operation.tripId === tripId &&
        operation.mutation.type === "name"
      ),
    );
    return {
      ...state,
      trips: {
        ...state.trips,
        [tripId]: {
          ...trip,
          name: mutation.name,
          nameEditedAt: editedAt,
          nameEditedBy: state.deviceId,
          updatedAt: Math.max(trip.updatedAt, editedAt),
        },
      },
      pending: [...withoutOlderRename, { id: mutation.id, kind: "mutation", tripId, mutation }],
    };
  });
}

export function setLocalRegions(tripId: string, regions: RegionId[]): void {
  updateState((state) => {
    const trip = state.trips[tripId];
    if (!trip || regions.length === 0) return state;
    const nextRegions = [...new Set(regions)];
    const editedAt = Date.now();
    const mutation: TripMutation = {
      id: crypto.randomUUID(),
      type: "regions",
      regions: nextRegions,
      editedAt,
      clientId: state.deviceId,
    };
    const selected = new Set(nextRegions);
    const pending = state.pending.filter((operation) => {
      if (operation.tripId !== tripId || operation.kind !== "mutation") return true;
      if (operation.mutation.type === "regions") return false;
      if (operation.mutation.type !== "plate") return true;
      const plate = PLATE_BY_ID.get(operation.mutation.plateId);
      return Boolean(plate && selected.has(plate.region));
    });
    return {
      ...state,
      trips: {
        ...state.trips,
        [tripId]: {
          ...trip,
          regions: nextRegions,
          regionsEditedAt: editedAt,
          regionsEditedBy: state.deviceId,
          updatedAt: Math.max(trip.updatedAt, editedAt),
        },
      },
      pending: [...pending, { id: mutation.id, kind: "mutation", tripId, mutation }],
    };
  });
}

export function setLocalPlate(tripId: string, plateId: string, checked: boolean): void {
  updateState((state) => {
    const trip = state.trips[tripId];
    if (!trip) return state;
    const current: PlateState = trip.plates[plateId] ?? {
      checked: false,
      version: 0,
      editedAt: 0,
      editedBy: "",
    };
    const existing = state.pending.find(
      (operation) => operation.kind === "mutation" &&
        operation.tripId === tripId &&
        operation.mutation.type === "plate" &&
        operation.mutation.plateId === plateId,
    );
    const baseVersion = existing?.kind === "mutation" && existing.mutation.type === "plate"
      ? existing.mutation.baseVersion
      : current.version;
    const editedAt = Date.now();
    const mutation: TripMutation = {
      id: crypto.randomUUID(),
      type: "plate",
      plateId,
      checked,
      baseVersion,
      editedAt,
      clientId: state.deviceId,
    };
    const withoutOlderPlate = state.pending.filter(
      (operation) => !(
        operation.kind === "mutation" &&
        operation.tripId === tripId &&
        operation.mutation.type === "plate" &&
        operation.mutation.plateId === plateId
      ),
    );

    return {
      ...state,
      trips: {
        ...state.trips,
        [tripId]: {
          ...trip,
          updatedAt: Math.max(trip.updatedAt, editedAt),
          plates: {
            ...trip.plates,
            [plateId]: {
              ...current,
              checked,
              editedAt,
              editedBy: state.deviceId,
            },
          },
        },
      },
      pending: [...withoutOlderPlate, { id: mutation.id, kind: "mutation", tripId, mutation }],
    };
  });
}

function applyPending(snapshot: TripSnapshot, operations: PendingOperation[], joinedAt: number): LocalTrip {
  const trip: LocalTrip = { ...snapshot, plates: { ...snapshot.plates }, joinedAt };
  for (const operation of operations) {
    if (operation.kind !== "mutation") continue;
    const mutation = operation.mutation;
    if (mutation.type === "name") {
      trip.name = mutation.name;
      trip.nameEditedAt = mutation.editedAt;
      trip.nameEditedBy = mutation.clientId;
      trip.updatedAt = Math.max(trip.updatedAt, mutation.editedAt);
    } else if (mutation.type === "regions") {
      trip.regions = mutation.regions;
      trip.regionsEditedAt = mutation.editedAt;
      trip.regionsEditedBy = mutation.clientId;
      trip.updatedAt = Math.max(trip.updatedAt, mutation.editedAt);
    } else {
      const current = trip.plates[mutation.plateId] ?? {
        checked: false,
        version: 0,
        editedAt: 0,
        editedBy: "",
      };
      trip.plates[mutation.plateId] = {
        ...current,
        checked: mutation.checked,
        editedAt: mutation.editedAt,
        editedBy: mutation.clientId,
      };
      trip.updatedAt = Math.max(trip.updatedAt, mutation.editedAt);
    }
  }
  return trip;
}

export function acceptRemoteTrip(snapshot: TripSnapshot, acknowledgedIds: string[] = []): void {
  updateState((state) => {
    const acknowledged = new Set(acknowledgedIds);
    const pending = state.pending.filter((operation) => !acknowledged.has(operation.id));
    const remainingForTrip = pending.filter((operation) => operation.tripId === snapshot.id);
    const joinedAt = state.trips[snapshot.id]?.joinedAt ?? Date.now();
    return {
      ...state,
      pending,
      trips: {
        ...state.trips,
        [snapshot.id]: applyPending(snapshot, remainingForTrip, joinedAt),
      },
    };
  });
}

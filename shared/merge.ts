import type { PlateState } from "./types";

export function incomingNameWins(
  currentEditedAt: number,
  currentClientId: string,
  incomingEditedAt: number,
  incomingClientId: string,
): boolean {
  return (
    incomingEditedAt > currentEditedAt ||
    (incomingEditedAt === currentEditedAt && incomingClientId > currentClientId)
  );
}

export function mergePlateState(
  current: PlateState,
  incoming: Pick<PlateState, "checked" | "editedAt" | "editedBy">,
  baseVersion: number,
): PlateState {
  const versionsMatch = current.version === baseVersion;
  const checked = versionsMatch ? incoming.checked : current.checked || incoming.checked;
  const incomingWon = versionsMatch || (!current.checked && incoming.checked);

  return {
    checked,
    version: current.version + 1,
    editedAt: incomingWon ? incoming.editedAt : current.editedAt,
    editedBy: incomingWon ? incoming.editedBy : current.editedBy,
  };
}

import { describe, expect, it } from "vitest";
import { incomingNameWins, mergePlateState } from "./merge";

const current = {
  checked: true,
  version: 3,
  editedAt: 100,
  editedBy: "device-a",
};

describe("plate conflict resolution", () => {
  it("allows an intentional uncheck based on the current version", () => {
    expect(mergePlateState(current, {
      checked: false,
      editedAt: 200,
      editedBy: "device-b",
    }, 3)).toEqual({
      checked: false,
      version: 4,
      editedAt: 200,
      editedBy: "device-b",
    });
  });

  it("keeps a checked plate when a stale client tries to uncheck it", () => {
    expect(mergePlateState(current, {
      checked: false,
      editedAt: 200,
      editedBy: "device-b",
    }, 2).checked).toBe(true);
  });

  it("lets a stale check beat an unchecked server value", () => {
    expect(mergePlateState({ ...current, checked: false }, {
      checked: true,
      editedAt: 200,
      editedBy: "device-b",
    }, 2).checked).toBe(true);
  });
});

describe("trip metadata conflict resolution", () => {
  it("accepts the later edit", () => {
    expect(incomingNameWins(100, "device-a", 101, "device-b")).toBe(true);
  });

  it("uses client id as a stable timestamp tie-breaker", () => {
    expect(incomingNameWins(100, "device-a", 100, "device-b")).toBe(true);
    expect(incomingNameWins(100, "device-b", 100, "device-a")).toBe(false);
  });
});

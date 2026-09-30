export const REGION_IDS = ["us", "canada", "mexico", "europe"] as const;

export type RegionId = (typeof REGION_IDS)[number];

export interface PlateJurisdiction {
  id: string;
  code: string;
  name: string;
  region: RegionId;
}

export interface PlateState {
  checked: boolean;
  version: number;
  editedAt: number;
  editedBy: string;
}

export interface TripSnapshot {
  id: string;
  name: string;
  nameEditedAt: number;
  nameEditedBy: string;
  regions: RegionId[];
  regionsEditedAt: number;
  regionsEditedBy: string;
  createdAt: number;
  updatedAt: number;
  plates: Record<string, PlateState>;
}

export interface CreateTripInput {
  name: string;
  regions: RegionId[];
  createdAt: number;
  clientId: string;
}

export interface NameMutation {
  id: string;
  type: "name";
  name: string;
  editedAt: number;
  clientId: string;
}

export interface PlateMutation {
  id: string;
  type: "plate";
  plateId: string;
  checked: boolean;
  baseVersion: number;
  editedAt: number;
  clientId: string;
}

export interface RegionsMutation {
  id: string;
  type: "regions";
  regions: RegionId[];
  editedAt: number;
  clientId: string;
}

export type TripMutation = NameMutation | PlateMutation | RegionsMutation;

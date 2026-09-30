import { PLATE_BY_ID } from "../shared/catalog";
import { REGION_IDS, type CreateTripInput, type RegionId, type TripMutation, type TripSnapshot } from "../shared/types";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_MUTATIONS = 200;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface TripRow {
  id: string;
  name: string;
  name_edited_at: number;
  name_edited_by: string;
  regions: string;
  regions_edited_at: number;
  regions_edited_by: string;
  created_at: number;
  updated_at: number;
}

interface PlateRow {
  plate_id: string;
  checked: number;
  version: number;
  edited_at: number;
  edited_by: string;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return Response.json(data, { ...init, headers });
}

function assertId(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new ApiError(400, `${label} must be a UUID.`);
  }
}

function assertTimestamp(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new ApiError(400, "editedAt must be a positive integer timestamp.");
  }
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string") throw new ApiError(400, "Trip name is required.");
  const name = value.trim();
  if (name.length < 1 || name.length > 80) {
    throw new ApiError(400, "Trip name must be between 1 and 80 characters.");
  }
  return name;
}

function normalizeRegions(value: unknown): RegionId[] {
  if (!Array.isArray(value)) throw new ApiError(400, "Regions must be an array.");
  const allowed = new Set<string>(REGION_IDS);
  const regions = [...new Set(value)];
  if (regions.length === 0 || regions.some((region) => typeof region !== "string" || !allowed.has(region))) {
    throw new ApiError(400, "Choose at least one valid region.");
  }
  return regions as RegionId[];
}

async function readJson(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) throw new ApiError(413, "Request body is too large.");

  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
}

async function getTripRow(db: D1Database, tripId: string): Promise<TripRow | null> {
  return db.prepare(
    `SELECT id, name, name_edited_at, name_edited_by, regions,
            regions_edited_at, regions_edited_by, created_at, updated_at
     FROM trips WHERE id = ?`,
  ).bind(tripId).first<TripRow>();
}

async function getTrip(db: D1Database, tripId: string): Promise<TripSnapshot | null> {
  const trip = await getTripRow(db, tripId);
  if (!trip) return null;

  const result = await db.prepare(
    `SELECT plate_id, checked, version, edited_at, edited_by
     FROM trip_plates WHERE trip_id = ?`,
  ).bind(tripId).all<PlateRow>();

  const plates = Object.fromEntries(result.results.map((plate) => [
    plate.plate_id,
    {
      checked: plate.checked === 1,
      version: plate.version,
      editedAt: plate.edited_at,
      editedBy: plate.edited_by,
    },
  ]));

  return {
    id: trip.id,
    name: trip.name,
    nameEditedAt: trip.name_edited_at,
    nameEditedBy: trip.name_edited_by,
    regions: normalizeRegions(JSON.parse(trip.regions)),
    regionsEditedAt: trip.regions_edited_at,
    regionsEditedBy: trip.regions_edited_by,
    createdAt: trip.created_at,
    updatedAt: trip.updated_at,
    plates,
  };
}

function parseCreateInput(value: unknown): CreateTripInput {
  if (!value || typeof value !== "object") throw new ApiError(400, "Trip details are required.");
  const input = value as Record<string, unknown>;
  assertId(input.clientId, "clientId");
  assertTimestamp(input.createdAt);
  return {
    name: normalizeName(input.name),
    regions: normalizeRegions(input.regions),
    createdAt: input.createdAt,
    clientId: input.clientId,
  };
}

function parseMutation(value: unknown): TripMutation {
  if (!value || typeof value !== "object") throw new ApiError(400, "Invalid mutation.");
  const mutation = value as Record<string, unknown>;
  assertId(mutation.id, "mutation id");
  assertId(mutation.clientId, "clientId");
  assertTimestamp(mutation.editedAt);

  if (mutation.type === "name") {
    return {
      id: mutation.id,
      type: "name",
      name: normalizeName(mutation.name),
      editedAt: mutation.editedAt,
      clientId: mutation.clientId,
    };
  }

  if (mutation.type === "plate") {
    if (typeof mutation.plateId !== "string" || !PLATE_BY_ID.has(mutation.plateId)) {
      throw new ApiError(400, "Unknown plate jurisdiction.");
    }
    if (typeof mutation.checked !== "boolean") throw new ApiError(400, "checked must be a boolean.");
    if (!Number.isSafeInteger(mutation.baseVersion) || (mutation.baseVersion as number) < 0) {
      throw new ApiError(400, "baseVersion must be a non-negative integer.");
    }
    return {
      id: mutation.id,
      type: "plate",
      plateId: mutation.plateId,
      checked: mutation.checked,
      baseVersion: mutation.baseVersion as number,
      editedAt: mutation.editedAt,
      clientId: mutation.clientId,
    };
  }

  if (mutation.type === "regions") {
    return {
      id: mutation.id,
      type: "regions",
      regions: normalizeRegions(mutation.regions),
      editedAt: mutation.editedAt,
      clientId: mutation.clientId,
    };
  }

  throw new ApiError(400, "Unknown mutation type.");
}

async function createTrip(request: Request, env: Env, tripId: string): Promise<Response> {
  const input = parseCreateInput(await readJson(request));
  await env.DB.prepare(
    `INSERT OR IGNORE INTO trips
       (id, name, name_edited_at, name_edited_by, regions, regions_edited_at,
        regions_edited_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    tripId,
    input.name,
    input.createdAt,
    input.clientId,
    JSON.stringify(input.regions),
    input.createdAt,
    input.clientId,
    input.createdAt,
    input.createdAt,
  ).run();

  const trip = await getTrip(env.DB, tripId);
  if (!trip) throw new ApiError(500, "Trip could not be created.");
  return json(trip, { status: 201 });
}

async function applyNameMutation(db: D1Database, tripId: string, mutation: Extract<TripMutation, { type: "name" }>) {
  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO mutations (id, trip_id, applied, created_at)
       VALUES (?, ?, 0, ?)`,
    ).bind(mutation.id, tripId, Date.now()),
    db.prepare(
      `UPDATE trips
       SET name = ?, name_edited_at = ?, name_edited_by = ?, updated_at = MAX(updated_at, ?)
       WHERE id = ?
         AND EXISTS (SELECT 1 FROM mutations WHERE id = ? AND applied = 0)
         AND (? > name_edited_at OR (? = name_edited_at AND ? > name_edited_by))`,
    ).bind(
      mutation.name,
      mutation.editedAt,
      mutation.clientId,
      mutation.editedAt,
      tripId,
      mutation.id,
      mutation.editedAt,
      mutation.editedAt,
      mutation.clientId,
    ),
    db.prepare("UPDATE mutations SET applied = 1 WHERE id = ? AND trip_id = ?").bind(mutation.id, tripId),
  ]);
}

async function applyPlateMutation(
  db: D1Database,
  tripId: string,
  mutation: Extract<TripMutation, { type: "plate" }>,
) {
  const checked = mutation.checked ? 1 : 0;
  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO mutations (id, trip_id, applied, created_at)
       VALUES (?, ?, 0, ?)`,
    ).bind(mutation.id, tripId, Date.now()),
    db.prepare(
      `INSERT OR IGNORE INTO trip_plates
         (trip_id, plate_id, checked, version, edited_at, edited_by)
       SELECT ?, ?, 0, 0, 0, ''
       WHERE EXISTS (SELECT 1 FROM mutations WHERE id = ? AND applied = 0)`,
    ).bind(tripId, mutation.plateId, mutation.id),
    db.prepare(
      `UPDATE trips
       SET updated_at = MAX(updated_at, ?)
       WHERE id = ?
         AND EXISTS (SELECT 1 FROM mutations WHERE id = ? AND applied = 0)
         AND EXISTS (
           SELECT 1 FROM trip_plates
           WHERE trip_id = ? AND plate_id = ?
             AND (version = ? OR (checked = 0 AND ? = 1))
         )`,
    ).bind(
      mutation.editedAt,
      tripId,
      mutation.id,
      tripId,
      mutation.plateId,
      mutation.baseVersion,
      checked,
    ),
    db.prepare(
      `UPDATE trip_plates
       SET
         checked = CASE
           WHEN version = ? THEN ?
           WHEN checked = 1 OR ? = 1 THEN 1
           ELSE 0
         END,
         edited_at = CASE
           WHEN version = ? OR (checked = 0 AND ? = 1) THEN ?
           ELSE edited_at
         END,
         edited_by = CASE
           WHEN version = ? OR (checked = 0 AND ? = 1) THEN ?
           ELSE edited_by
         END,
         version = version + 1
       WHERE trip_id = ? AND plate_id = ?
         AND EXISTS (SELECT 1 FROM mutations WHERE id = ? AND applied = 0)`,
    ).bind(
      mutation.baseVersion,
      checked,
      checked,
      mutation.baseVersion,
      checked,
      mutation.editedAt,
      mutation.baseVersion,
      checked,
      mutation.clientId,
      tripId,
      mutation.plateId,
      mutation.id,
    ),
    db.prepare("UPDATE mutations SET applied = 1 WHERE id = ? AND trip_id = ?").bind(mutation.id, tripId),
  ]);
}

async function applyRegionsMutation(
  db: D1Database,
  tripId: string,
  mutation: Extract<TripMutation, { type: "regions" }>,
) {
  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO mutations (id, trip_id, applied, created_at)
       VALUES (?, ?, 0, ?)`,
    ).bind(mutation.id, tripId, Date.now()),
    db.prepare(
      `UPDATE trips
       SET regions = ?, regions_edited_at = ?, regions_edited_by = ?, updated_at = MAX(updated_at, ?)
       WHERE id = ?
         AND EXISTS (SELECT 1 FROM mutations WHERE id = ? AND applied = 0)
         AND (? > regions_edited_at OR (? = regions_edited_at AND ? > regions_edited_by))`,
    ).bind(
      JSON.stringify(mutation.regions),
      mutation.editedAt,
      mutation.clientId,
      mutation.editedAt,
      tripId,
      mutation.id,
      mutation.editedAt,
      mutation.editedAt,
      mutation.clientId,
    ),
    db.prepare("UPDATE mutations SET applied = 1 WHERE id = ? AND trip_id = ?").bind(mutation.id, tripId),
  ]);
}

async function applyMutations(request: Request, env: Env, tripId: string): Promise<Response> {
  const tripRow = await getTripRow(env.DB, tripId);
  if (!tripRow) throw new ApiError(404, "Trip not found.");
  let tripRegions = new Set(normalizeRegions(JSON.parse(tripRow.regions)));
  const body = await readJson(request);
  if (!body || typeof body !== "object" || !Array.isArray((body as Record<string, unknown>).mutations)) {
    throw new ApiError(400, "mutations must be an array.");
  }

  const values = (body as { mutations: unknown[] }).mutations;
  if (values.length > MAX_MUTATIONS) throw new ApiError(400, `Send at most ${MAX_MUTATIONS} mutations at once.`);
  const mutations = values.map(parseMutation);

  for (const mutation of mutations) {
    if (mutation.type === "name") {
      await applyNameMutation(env.DB, tripId, mutation);
    } else if (mutation.type === "plate") {
      const plate = PLATE_BY_ID.get(mutation.plateId);
      if (!plate || !tripRegions.has(plate.region)) {
        throw new ApiError(400, "That plate is not part of this trip.");
      }
      await applyPlateMutation(env.DB, tripId, mutation);
    } else {
      await applyRegionsMutation(env.DB, tripId, mutation);
      const updatedTrip = await getTripRow(env.DB, tripId);
      if (!updatedTrip) throw new ApiError(404, "Trip not found.");
      tripRegions = new Set(normalizeRegions(JSON.parse(updatedTrip.regions)));
    }
  }

  const trip = await getTrip(env.DB, tripId);
  if (!trip) throw new ApiError(404, "Trip not found.");
  return json(trip);
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({ ok: true });
  }

  if (parts.length < 3 || parts[0] !== "api" || parts[1] !== "trips") {
    throw new ApiError(404, "Not found.");
  }

  const tripId = parts[2];
  assertId(tripId, "trip id");

  if (parts.length === 3 && request.method === "GET") {
    const trip = await getTrip(env.DB, tripId);
    if (!trip) throw new ApiError(404, "Trip not found.");
    return json(trip);
  }

  if (parts.length === 3 && request.method === "PUT") {
    return createTrip(request, env, tripId);
  }

  if (parts.length === 4 && parts[3] === "mutations" && request.method === "POST") {
    return applyMutations(request, env, tripId);
  }

  throw new ApiError(405, "Method not allowed.");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleApi(request, env);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, { status: error.status });
      console.error(JSON.stringify({
        level: "error",
        message: "Unhandled API error",
        path: new URL(request.url).pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      return json({ error: "Something went wrong." }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;

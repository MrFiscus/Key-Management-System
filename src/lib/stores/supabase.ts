import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Assignment, DataStore, KeyActivity, KeyDef, MapLayout, NewAssignment, NewKeyDef, NewPerson, Person, Snapshot,
} from "../types";
import { DEFAULT_PERSON_CATEGORY } from "../types";

/**
 * Postgres-backed store. Inactive until VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY are set in .env — see .env.example and
 * supabase/migrations/0001_init.sql.
 *
 * The anon key is safe to ship in the frontend; it is public by design. What
 * actually protects the data is Row Level Security plus a signed-in user, both
 * of which the migration sets up. Never put the service_role key in this file
 * or in any VITE_-prefixed variable — Vite inlines those into the bundle.
 */

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(URL && ANON_KEY);

/**
 * One shared client for the whole app, so the signed-in auth session (stored in
 * localStorage) rides along on every data query — that's what satisfies the
 * "authenticated only" Row Level Security. Returns null when Supabase isn't
 * configured (the app then runs on LocalStore with no login).
 */
let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (!client) {
    client = createClient(URL!, ANON_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

// ── row <-> domain mapping (snake_case in PG, camelCase in the app) ───────────

const rowToPerson = (r: any): Person => ({
  id: r.id,
  fullName: r.full_name,
  email: r.email,
  employeeId: r.employee_id,
  department: r.department,
  building: r.building,
  category: r.category || DEFAULT_PERSON_CATEGORY,
});

const personToRow = (p: Partial<NewPerson>) => ({
  ...(p.fullName !== undefined && { full_name: p.fullName }),
  ...(p.email !== undefined && { email: p.email }),
  ...(p.employeeId !== undefined && { employee_id: p.employeeId }),
  ...(p.department !== undefined && { department: p.department }),
  ...(p.building !== undefined && { building: p.building }),
  ...(p.category !== undefined && { category: p.category }),
});

const rowToKey = (r: any): KeyDef => ({
  id: r.id,
  keyStamp: r.key_stamp,
  roomNumber: r.room_number,
  roomDescription: r.room_description,
  building: r.building,
  department: r.department,
  notes: r.notes,
});

const keyToRow = (k: Partial<NewKeyDef>) => ({
  ...(k.keyStamp !== undefined && { key_stamp: k.keyStamp }),
  ...(k.roomNumber !== undefined && { room_number: k.roomNumber }),
  ...(k.roomDescription !== undefined && { room_description: k.roomDescription }),
  ...(k.building !== undefined && { building: k.building }),
  ...(k.department !== undefined && { department: k.department }),
  ...(k.notes !== undefined && { notes: k.notes }),
});

const rowToAssignment = (r: any): Assignment => ({
  id: r.id,
  personId: r.person_id,
  keyId: r.key_id,
  dateIssued: r.date_issued,
  dateReturned: r.date_returned,
  numKeys: r.num_keys,
  notes: r.notes,
});

const assignmentToRow = (a: Partial<NewAssignment>) => ({
  ...(a.personId !== undefined && { person_id: a.personId }),
  ...(a.keyId !== undefined && { key_id: a.keyId }),
  ...(a.dateIssued !== undefined && { date_issued: a.dateIssued }),
  ...(a.dateReturned !== undefined && { date_returned: a.dateReturned }),
  ...(a.numKeys !== undefined && { num_keys: a.numKeys }),
  ...(a.notes !== undefined && { notes: a.notes }),
});

/** Turn Postgres constraint violations into something a human can act on. */
function explain(error: { code?: string; message: string }): Error {
  if (error.code === "23505") {
    if (error.message.includes("people_name_key")) {
      return new Error("Someone with that name is already in the directory.");
    }
    if (error.message.includes("keys_identity_key")) {
      return new Error("A key with that stamp, room, and building already exists.");
    }
    return new Error("That record already exists.");
  }
  if (error.code === "23514" && error.message.includes("returned_after_issued")) {
    return new Error("Date returned cannot be before date issued.");
  }
  if (error.code === "42501" || error.code === "PGRST301") {
    return new Error("Not authorized — sign in again.");
  }
  return new Error(error.message);
}

export class SupabaseStore implements DataStore {
  readonly kind = "supabase" as const;
  readonly label = "Supabase (shared)";

  constructor(private client: SupabaseClient = getSupabase()!) {}

  /**
   * PostgREST caps how many rows a single request returns (commonly 1000),
   * silently — no error, just a truncated result. A plain `.select("*")`
   * on a table past that size quietly loses whatever didn't fit, which is
   * exactly how an import can write every row correctly and still have the
   * app show none of the tail end (e.g. every returned key, if those rows
   * happened to be inserted last). Page through with `.range()` until a
   * page comes back short of a full page, so the row cap can never apply.
   */
  private async loadAll(table: string, orderCol: string) {
    const pageSize = 1000;
    const rows: any[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await this.client
        .from(table)
        .select("*")
        .order(orderCol)
        .range(from, from + pageSize - 1);
      if (error) throw explain(error);
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    return rows;
  }

  async load(): Promise<Snapshot> {
    const [peopleRows, keyRows, assignmentRows] = await Promise.all([
      this.loadAll("people", "full_name"),
      this.loadAll("keys", "key_stamp"),
      this.loadAll("assignments", "date_issued"),
    ]);
    return {
      people: peopleRows.map(rowToPerson),
      keys: keyRows.map(rowToKey),
      assignments: assignmentRows.map(rowToAssignment),
    };
  }

  private async insert<T>(table: string, row: object, map: (r: any) => T): Promise<T> {
    const { data, error } = await this.client.from(table).insert(row).select().single();
    if (error) throw explain(error);
    return map(data);
  }

  private async patch<T>(table: string, id: string, row: object, map: (r: any) => T): Promise<T> {
    const { data, error } = await this.client.from(table).update(row).eq("id", id).select().single();
    if (error) throw explain(error);
    return map(data);
  }

  private async remove(table: string, id: string): Promise<void> {
    const { error } = await this.client.from(table).delete().eq("id", id);
    if (error) throw explain(error);
  }

  createPerson = (input: NewPerson) => this.insert("people", personToRow(input), rowToPerson);
  updatePerson = (id: string, p: Partial<NewPerson>) => this.patch("people", id, personToRow(p), rowToPerson);
  deletePerson = (id: string) => this.remove("people", id);

  createKey = async (input: NewKeyDef) => {
    const key = await this.insert("keys", keyToRow(input), rowToKey);
    this.logKeyActivity(key, "created");
    return key;
  };
  updateKey = async (id: string, p: Partial<NewKeyDef>) => {
    const key = await this.patch("keys", id, keyToRow(p), rowToKey);
    this.logKeyActivity(key, "updated");
    return key;
  };
  deleteKey = (id: string) => this.remove("keys", id);

  createAssignment = async (input: NewAssignment) => {
    const assignment = await this.insert("assignments", assignmentToRow(input), rowToAssignment);
    this.logAssignmentActivity(assignment.keyId, "issued");
    return assignment;
  };
  updateAssignment = async (id: string, p: Partial<NewAssignment>) => {
    // Look up the pre-patch state so a full-form edit that just re-sends an
    // already-returned date doesn't get logged as a new "return" every time.
    let wasOpen = false;
    if (p.dateReturned !== undefined) {
      const { data: before } = await this.client.from("assignments").select("date_returned").eq("id", id).single();
      wasOpen = !before?.date_returned;
    }
    const assignment = await this.patch("assignments", id, assignmentToRow(p), rowToAssignment);
    if (wasOpen && assignment.dateReturned) this.logAssignmentActivity(assignment.keyId, "returned");
    return assignment;
  };
  deleteAssignment = (id: string) => this.remove("assignments", id);

  /**
   * Excel import. Deletes everything, then reinserts — assignments last so the
   * foreign keys resolve.
   *
   * NOTE: this is not atomic. If it fails partway the table is left half-loaded.
   * Before going live, move this into a Postgres function so it runs in one
   * transaction; until then, always export a backup before importing.
   */
  async replaceAll(snapshot: Snapshot): Promise<void> {
    for (const table of ["assignments", "keys", "people"]) {
      const { error } = await this.client.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw explain(error);
    }
    const people = snapshot.people.map((p) => ({ id: p.id, ...personToRow(p) }));
    const keys = snapshot.keys.map((k) => ({ id: k.id, ...keyToRow(k) }));
    const assignments = snapshot.assignments.map((a) => ({ id: a.id, ...assignmentToRow(a) }));

    for (const [table, rows] of [["people", people], ["keys", keys], ["assignments", assignments]] as const) {
      if (rows.length === 0) continue;
      // Chunked so large spreadsheets don't blow the request size limit.
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await this.client.from(table).insert(rows.slice(i, i + 500));
        if (error) throw explain(error);
      }
    }
  }

  // ── map layout ──────────────────────────────────────────────────────────────
  // One JSONB row per organization, keyed by org_id (see migration
  // 0005_organizations.sql). RLS means at most one row is ever visible to a
  // given caller, so no explicit filter is needed; org_id fills in via its
  // column default on insert.

  async loadMapLayout(): Promise<MapLayout> {
    const { data, error } = await this.client
      .from("map_layout")
      .select("data")
      .maybeSingle();
    if (error) throw explain(error);
    const payload = (data?.data ?? null) as Partial<MapLayout> | null;
    return {
      overrides: payload?.overrides ?? {},
      locked: Boolean(payload?.locked),
    };
  }

  async saveMapLayout(layout: MapLayout): Promise<void> {
    const { error } = await this.client
      .from("map_layout")
      .upsert({ data: layout, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
    if (error) throw explain(error);
  }

  // ── key activity ────────────────────────────────────────────────────────────
  // See migration 0004_key_activity.sql. Logging is best-effort: a failure
  // here should never block the actual key create/update from succeeding.

  private async logActivity(keyId: string, keyStamp: string, action: KeyActivity["action"]) {
    try {
      const { data } = await this.client.auth.getUser();
      await this.client.from("key_activity").insert({
        key_id: keyId,
        key_stamp: keyStamp,
        action,
        actor_email: data.user?.email ?? null,
      });
    } catch {
      // Not the user's problem — the key/assignment edit itself already succeeded.
    }
  }

  private logKeyActivity(key: KeyDef, action: "created" | "updated") {
    return this.logActivity(key.id, key.keyStamp, action);
  }

  /** Assignments only carry a keyId, so look up its stamp before logging. */
  private async logAssignmentActivity(keyId: string, action: "issued" | "returned") {
    try {
      const { data: keyRow, error } = await this.client.from("keys").select("key_stamp").eq("id", keyId).single();
      if (error || !keyRow) return;
      await this.logActivity(keyId, keyRow.key_stamp, action);
    } catch {
      // Best-effort — never block the issuance/return itself.
    }
  }

  async getRecentKeyActivity(actorEmail: string, limit = 5): Promise<KeyActivity[]> {
    const { data, error } = await this.client
      .from("key_activity")
      .select("*")
      .eq("actor_email", actorEmail)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw explain(error);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      keyId: r.key_id,
      keyStamp: r.key_stamp,
      action: r.action,
      actorEmail: r.actor_email,
      at: r.created_at,
    }));
  }
}

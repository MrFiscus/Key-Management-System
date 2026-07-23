import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Assignment, DataStore, KeyDef, NewAssignment, NewKeyDef, NewPerson, Person, Snapshot,
} from "../types";

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

export function createSupabaseClient(): SupabaseClient {
  if (!supabaseConfigured) {
    throw new Error("Supabase is not configured; set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  return createClient(URL!, ANON_KEY!);
}

// ── row <-> domain mapping (snake_case in PG, camelCase in the app) ───────────

const rowToPerson = (r: any): Person => ({
  id: r.id,
  fullName: r.full_name,
  email: r.email,
  employeeId: r.employee_id,
  department: r.department,
  building: r.building,
});

const personToRow = (p: Partial<NewPerson>) => ({
  ...(p.fullName !== undefined && { full_name: p.fullName }),
  ...(p.email !== undefined && { email: p.email }),
  ...(p.employeeId !== undefined && { employee_id: p.employeeId }),
  ...(p.department !== undefined && { department: p.department }),
  ...(p.building !== undefined && { building: p.building }),
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
    if (error.message.includes("assignments_one_open_per_person_key")) {
      return new Error("That person already has this key checked out.");
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

  constructor(private client: SupabaseClient = createSupabaseClient()) {}

  async load(): Promise<Snapshot> {
    const [people, keys, assignments] = await Promise.all([
      this.client.from("people").select("*").order("full_name"),
      this.client.from("keys").select("*").order("key_stamp"),
      this.client.from("assignments").select("*"),
    ]);
    for (const res of [people, keys, assignments]) {
      if (res.error) throw explain(res.error);
    }
    return {
      people: (people.data ?? []).map(rowToPerson),
      keys: (keys.data ?? []).map(rowToKey),
      assignments: (assignments.data ?? []).map(rowToAssignment),
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

  createKey = (input: NewKeyDef) => this.insert("keys", keyToRow(input), rowToKey);
  updateKey = (id: string, p: Partial<NewKeyDef>) => this.patch("keys", id, keyToRow(p), rowToKey);
  deleteKey = (id: string) => this.remove("keys", id);

  createAssignment = (input: NewAssignment) =>
    this.insert("assignments", assignmentToRow(input), rowToAssignment);
  updateAssignment = (id: string, p: Partial<NewAssignment>) =>
    this.patch("assignments", id, assignmentToRow(p), rowToAssignment);
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
}

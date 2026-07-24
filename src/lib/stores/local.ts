import type {
  Assignment, DataStore, KeyDef, MapLayout, NewAssignment, NewKeyDef, NewPerson, Person, Snapshot,
} from "../types";
import { EMPTY_MAP_LAYOUT } from "../types";
import { newId } from "../id";
import { buildSeed } from "../seed";

const STORAGE_KEY = "dsu-key-mgmt/v1";
const MAP_KEY = "dsu-key-mgmt/map/v1";

/**
 * Browser-persisted store. Data lives in localStorage on this machine only —
 * it is not shared with anyone else and does not survive clearing site data.
 * Export to Excel regularly until the Supabase backend is approved.
 *
 * The uniqueness rules here deliberately mirror the indexes in
 * supabase/migrations/0001_init.sql, so data that works locally will still
 * import cleanly once the real database is live.
 */
export class LocalStore implements DataStore {
  readonly kind = "local" as const;
  readonly label = "This browser only";

  private snap: Snapshot = { people: [], keys: [], assignments: [] };
  private loaded = false;

  async load(): Promise<Snapshot> {
    if (!this.loaded) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          this.snap = normalize(JSON.parse(raw));
        } catch {
          // Corrupt payload: fall back to seed rather than leaving a dead app.
          // The bad value stays under the old key for recovery.
          localStorage.setItem(`${STORAGE_KEY}.corrupt.${Date.now()}`, raw);
          this.snap = buildSeed();
        }
      } else {
        this.snap = buildSeed();
      }
      this.loaded = true;
      this.persist();
    }
    return clone(this.snap);
  }

  // ── people ──────────────────────────────────────────────────────────────────

  async createPerson(input: NewPerson): Promise<Person> {
    const name = input.fullName.trim();
    if (!name) throw new Error("Name is required.");
    if (this.snap.people.some((p) => eq(p.fullName, name))) {
      throw new Error(`"${name}" is already in the directory.`);
    }
    const person: Person = { ...input, fullName: name, id: newId() };
    this.snap.people.push(person);
    this.persist();
    return { ...person };
  }

  async updatePerson(id: string, patch: Partial<NewPerson>): Promise<Person> {
    const person = this.snap.people.find((p) => p.id === id);
    if (!person) throw new Error("Person not found.");
    if (patch.fullName !== undefined) {
      const name = patch.fullName.trim();
      if (!name) throw new Error("Name is required.");
      if (this.snap.people.some((p) => p.id !== id && eq(p.fullName, name))) {
        throw new Error(`"${name}" is already in the directory.`);
      }
      patch = { ...patch, fullName: name };
    }
    Object.assign(person, patch);
    this.persist();
    return { ...person };
  }

  async deletePerson(id: string): Promise<void> {
    this.snap.people = this.snap.people.filter((p) => p.id !== id);
    // Matches ON DELETE CASCADE in the SQL schema.
    this.snap.assignments = this.snap.assignments.filter((a) => a.personId !== id);
    this.persist();
  }

  // ── keys ────────────────────────────────────────────────────────────────────

  async createKey(input: NewKeyDef): Promise<KeyDef> {
    const stamp = input.keyStamp.trim();
    if (!stamp) throw new Error("Key stamp is required.");
    const candidate = { ...input, keyStamp: stamp };
    if (this.snap.keys.some((k) => sameKeyIdentity(k, candidate))) {
      throw new Error(
        `Key ${stamp} for room ${input.roomNumber || "—"} in ${input.building || "—"} already exists.`,
      );
    }
    const key: KeyDef = { ...candidate, id: newId() };
    this.snap.keys.push(key);
    this.persist();
    return { ...key };
  }

  async updateKey(id: string, patch: Partial<NewKeyDef>): Promise<KeyDef> {
    const key = this.snap.keys.find((k) => k.id === id);
    if (!key) throw new Error("Key not found.");
    const merged = { ...key, ...patch, keyStamp: (patch.keyStamp ?? key.keyStamp).trim() };
    if (!merged.keyStamp) throw new Error("Key stamp is required.");
    if (this.snap.keys.some((k) => k.id !== id && sameKeyIdentity(k, merged))) {
      throw new Error("Another key already uses that stamp, room, and building.");
    }
    Object.assign(key, merged);
    this.persist();
    return { ...key };
  }

  async deleteKey(id: string): Promise<void> {
    this.snap.keys = this.snap.keys.filter((k) => k.id !== id);
    this.snap.assignments = this.snap.assignments.filter((a) => a.keyId !== id);
    this.persist();
  }

  // ── assignments ─────────────────────────────────────────────────────────────

  async createAssignment(input: NewAssignment): Promise<Assignment> {
    this.validateAssignment(input, null);
    const assignment: Assignment = { ...input, id: newId() };
    this.snap.assignments.push(assignment);
    this.persist();
    return { ...assignment };
  }

  async updateAssignment(id: string, patch: Partial<NewAssignment>): Promise<Assignment> {
    const existing = this.snap.assignments.find((a) => a.id === id);
    if (!existing) throw new Error("Assignment not found.");
    const merged = { ...existing, ...patch };
    this.validateAssignment(merged, id);
    Object.assign(existing, merged);
    this.persist();
    return { ...existing };
  }

  async deleteAssignment(id: string): Promise<void> {
    this.snap.assignments = this.snap.assignments.filter((a) => a.id !== id);
    this.persist();
  }

  private validateAssignment(a: NewAssignment, selfId: string | null) {
    if (!this.snap.people.some((p) => p.id === a.personId)) {
      throw new Error("Select a person.");
    }
    if (!this.snap.keys.some((k) => k.id === a.keyId)) {
      throw new Error("Select a key.");
    }
    if (!a.dateIssued) throw new Error("Date issued is required.");
    if (a.numKeys < 1) throw new Error("Number of keys must be at least 1.");
    if (a.dateReturned && a.dateReturned < a.dateIssued) {
      throw new Error("Date returned cannot be before date issued.");
    }
  }

  // ── bulk ────────────────────────────────────────────────────────────────────

  async replaceAll(snapshot: Snapshot): Promise<void> {
    this.snap = clone(snapshot);
    this.loaded = true;
    this.persist();
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snap));
    } catch (err) {
      // Quota exceeded is the realistic failure here (~5MB limit). Surface it
      // loudly — silently dropping writes would lose real records.
      throw new Error(
        "Could not save to browser storage — it may be full. Export to Excel now to avoid losing changes.",
      );
    }
  }

  // ── map layout ──────────────────────────────────────────────────────────────

  async loadMapLayout(): Promise<MapLayout> {
    const raw = localStorage.getItem(MAP_KEY);
    if (!raw) return { ...EMPTY_MAP_LAYOUT, overrides: {} };
    try {
      const parsed = JSON.parse(raw);
      return {
        overrides: parsed?.overrides ?? {},
        locked: Boolean(parsed?.locked),
      };
    } catch {
      return { ...EMPTY_MAP_LAYOUT, overrides: {} };
    }
  }

  async saveMapLayout(layout: MapLayout): Promise<void> {
    localStorage.setItem(MAP_KEY, JSON.stringify(layout));
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function sameKeyIdentity(a: Omit<KeyDef, "id">, b: Omit<KeyDef, "id">) {
  return (
    eq(a.keyStamp, b.keyStamp) &&
    eq(a.roomNumber ?? "", b.roomNumber ?? "") &&
    eq(a.building ?? "", b.building ?? "")
  );
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Guard against older or hand-edited payloads missing newer fields. */
function normalize(raw: any): Snapshot {
  return {
    people: (raw?.people ?? []).map((p: any) => ({
      id: p.id ?? newId(),
      fullName: p.fullName ?? "",
      email: p.email ?? null,
      employeeId: p.employeeId ?? null,
      department: p.department ?? null,
      building: p.building ?? null,
    })),
    keys: (raw?.keys ?? []).map((k: any) => ({
      id: k.id ?? newId(),
      keyStamp: k.keyStamp ?? "",
      roomNumber: k.roomNumber ?? null,
      roomDescription: k.roomDescription ?? null,
      building: k.building ?? null,
      department: k.department ?? null,
      notes: k.notes ?? null,
    })),
    assignments: (raw?.assignments ?? []).map((a: any) => ({
      id: a.id ?? newId(),
      personId: a.personId,
      keyId: a.keyId,
      dateIssued: a.dateIssued ?? "",
      dateReturned: a.dateReturned ?? null,
      numKeys: Number(a.numKeys) || 1,
      notes: a.notes ?? null,
    })),
  };
}

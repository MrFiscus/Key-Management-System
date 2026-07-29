// Shared domain types. These mirror supabase/migrations/0001_init.sql — if you
// change a column there, change it here too.

export interface Person {
  id: string;
  fullName: string;
  email: string | null;
  employeeId: string | null;
  department: string | null;
  building: string | null;
  /**
   * Which of the original workbook's sheets this person's records belong to
   * — free text so an imported sheet with an unrecognized name still
   * round-trips, even though the UI only offers the known
   * PERSON_CATEGORIES.
   */
  category: string;
}

/**
 * A key *type*, identified by its stamp. Multiple physical copies of one stamp
 * exist, so several people can hold the same stamp simultaneously — this row is
 * the cut, not the piece of metal.
 */
export interface KeyDef {
  id: string;
  keyStamp: string;
  roomNumber: string | null;
  roomDescription: string | null;
  building: string | null;
  department: string | null;
  notes: string | null;
}

/**
 * The original DSU audit workbook split active records across sheets named
 * after who manages the PEOPLE on them (Directory being the general/largest
 * one), with a single Returned sheet catching anything closed out regardless
 * of where the person started. This mirrors that grouping so exports can
 * rebuild the same shape.
 */
export const PERSON_CATEGORIES = [
  "Directory",
  "Campus Watch",
  "CommunityCenter",
  "GA Forms",
  "Sodexo",
  "Facilities Department",
] as const;
export type PersonCategory = (typeof PERSON_CATEGORIES)[number];
export const DEFAULT_PERSON_CATEGORY: PersonCategory = "Directory";

/** One issuance of one key to one person. Open (unreturned) means they hold it. */
export interface Assignment {
  id: string;
  personId: string;
  keyId: string;
  /** ISO date, yyyy-mm-dd */
  dateIssued: string;
  /** ISO date, or null while the key is still out */
  dateReturned: string | null;
  numKeys: number;
  notes: string | null;
}

/** Everything the app holds in memory at once. */
export interface Snapshot {
  people: Person[];
  keys: KeyDef[];
  assignments: Assignment[];
}

/** An assignment joined to its person and key — what the tables actually render. */
export interface KeyRecord {
  assignmentId: string;
  personId: string;
  personName: string;
  initials: string;
  keyId: string;
  keyStamp: string;
  roomNumber: string;
  roomDescription: string;
  building: string;
  department: string;
  dateIssued: string;
  dateReturned: string | null;
  numKeys: number;
  notes: string | null;
  isActive: boolean;
  category: string;
}

export type NewPerson = Omit<Person, "id">;
export type NewKeyDef = Omit<KeyDef, "id">;
export type NewAssignment = Omit<Assignment, "id">;

// ── Interactive key map ─────────────────────────────────────────────────────────

/** A building box's position/size on the map stage, in stage percentages. */
export interface MapBoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Saved map state. `overrides` only holds boxes the user has moved/resized off
 * their default; everything else falls back to BUILDING_LAYOUT. `locked` freezes
 * dragging so the arranged map can't be nudged by accident.
 */
export interface MapLayout {
  overrides: Record<string, MapBoxRect>;
  locked: boolean;
}

export const EMPTY_MAP_LAYOUT: MapLayout = { overrides: {}, locked: false };

/**
 * Storage contract. Two implementations exist:
 *   - local.ts    — browser-persisted, used today
 *   - supabase.ts — Postgres, switches on once credentials are configured
 * Keeping the app behind this interface is what makes that a one-line swap.
 */
export interface DataStore {
  readonly kind: "local" | "supabase";
  /** Human-readable description of where data is going, shown in the UI. */
  readonly label: string;

  load(): Promise<Snapshot>;

  createPerson(input: NewPerson): Promise<Person>;
  updatePerson(id: string, patch: Partial<NewPerson>): Promise<Person>;
  deletePerson(id: string): Promise<void>;

  createKey(input: NewKeyDef): Promise<KeyDef>;
  updateKey(id: string, patch: Partial<NewKeyDef>): Promise<KeyDef>;
  deleteKey(id: string): Promise<void>;

  createAssignment(input: NewAssignment): Promise<Assignment>;
  updateAssignment(id: string, patch: Partial<NewAssignment>): Promise<Assignment>;
  deleteAssignment(id: string): Promise<void>;

  /** Wholesale replace — used by Excel import. */
  replaceAll(snapshot: Snapshot): Promise<void>;

  /** Interactive key-map layout (building position overrides + lock state). */
  loadMapLayout(): Promise<MapLayout>;
  saveMapLayout(layout: MapLayout): Promise<void>;

  /**
   * Most recent key create/edit activity for one person, newest first — shown
   * on their profile page so "who touched what" stays visible. In LocalStore
   * (no accounts) this just returns this browser's own recent edits, ignoring
   * the actor filter.
   */
  getRecentKeyActivity(actorEmail: string, limit?: number): Promise<KeyActivity[]>;
}

/** One row of the key edit history shown on a user's profile page. */
export interface KeyActivity {
  id: string;
  keyId: string;
  keyStamp: string;
  action: "created" | "updated" | "issued" | "returned";
  actorEmail: string | null;
  /** ISO timestamp */
  at: string;
}

// ── Derived helpers ───────────────────────────────────────────────────────────

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Join a snapshot into the flat rows the tables render. */
export function toRecords(snap: Snapshot): KeyRecord[] {
  const peopleById = new Map(snap.people.map((p) => [p.id, p]));
  const keysById = new Map(snap.keys.map((k) => [k.id, k]));

  const records: KeyRecord[] = [];
  for (const a of snap.assignments) {
    const person = peopleById.get(a.personId);
    const key = keysById.get(a.keyId);
    // Orphaned assignment (person or key deleted out from under it) — skip
    // rather than render a half-empty row.
    if (!person || !key) continue;

    records.push({
      assignmentId: a.id,
      personId: person.id,
      personName: person.fullName,
      initials: initialsOf(person.fullName),
      keyId: key.id,
      keyStamp: key.keyStamp,
      roomNumber: key.roomNumber ?? "",
      roomDescription: key.roomDescription ?? "",
      building: key.building ?? person.building ?? "",
      department: key.department ?? person.department ?? "",
      dateIssued: a.dateIssued,
      dateReturned: a.dateReturned,
      numKeys: a.numKeys,
      notes: a.notes,
      isActive: a.dateReturned === null,
      category: person.category || DEFAULT_PERSON_CATEGORY,
    });
  }
  return records;
}

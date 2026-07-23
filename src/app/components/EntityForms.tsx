import { useState } from "react";
import type { Assignment, KeyDef, KeyRecord, NewAssignment, NewKeyDef, NewPerson, Person, Snapshot } from "../../lib/types";
import { Avatar, Button, ErrorNote, Field, Modal, Stamp, TextInput } from "./primitives";
import { DSU, formatDate, todayIso } from "../theme";

/**
 * Create/edit dialogs for the three entities. Each one owns its draft state and
 * calls onSave, which throws a human-readable Error on validation failure; the
 * dialog catches it and shows it inline instead of closing.
 */

const blank = (v: string) => (v.trim() === "" ? null : v.trim());

/** AssignmentDialog can create new person/key inline, so it passes details along. */
export type AssignmentInput = NewAssignment & {
  newPersonLastName?: string;
  newPersonFirstName?: string;
  newPersonBldg?: string;
  newPersonDept?: string;
  newKeyStamp?: string;
  newKeyRoom?: string;
};

// ── Person ────────────────────────────────────────────────────────────────────

export function PersonDialog({
  person, onSave, onClose,
}: {
  person: Person | null;
  onSave: (input: NewPerson) => Promise<void>;
  onClose: () => void;
}) {
  const [fullName, setFullName] = useState(person?.fullName ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [employeeId, setEmployeeId] = useState(person?.employeeId ?? "");
  const [department, setDepartment] = useState(person?.department ?? "");
  const [building, setBuilding] = useState(person?.building ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({
        fullName,
        email: blank(email),
        employeeId: blank(employeeId),
        department: blank(department),
        building: blank(building),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={person ? "Edit Person" : "Add Person"}
      onClose={onClose}
      footer={
        <>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="person-form" variant="primary" disabled={busy}>
            {busy ? "Saving…" : person ? "Save Changes" : "Add Person"}
          </Button>
        </>
      }
    >
      {error && <ErrorNote message={error} />}
      <form id="person-form" onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Full name" required>
          <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Department">
            <TextInput value={department} onChange={(e) => setDepartment(e.target.value)} />
          </Field>
          <Field label="Building">
            <TextInput value={building} onChange={(e) => setBuilding(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Employee ID">
            <TextInput value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

// ── Key ───────────────────────────────────────────────────────────────────────

export function KeyDialog({
  keyDef, onSave, onClose,
}: {
  keyDef: KeyDef | null;
  onSave: (input: NewKeyDef) => Promise<void>;
  onClose: () => void;
}) {
  const [keyStamp, setKeyStamp] = useState(keyDef?.keyStamp ?? "");
  const [roomNumber, setRoomNumber] = useState(keyDef?.roomNumber ?? "");
  const [roomDescription, setRoomDescription] = useState(keyDef?.roomDescription ?? "");
  const [building, setBuilding] = useState(keyDef?.building ?? "");
  const [department, setDepartment] = useState(keyDef?.department ?? "");
  const [notes, setNotes] = useState(keyDef?.notes ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({
        keyStamp,
        roomNumber: blank(roomNumber),
        roomDescription: blank(roomDescription),
        building: blank(building),
        department: blank(department),
        notes: blank(notes),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={keyDef ? "Edit Key" : "Add Key"}
      onClose={onClose}
      footer={
        <>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="key-form" variant="primary" disabled={busy}>
            {busy ? "Saving…" : keyDef ? "Save Changes" : "Add Key"}
          </Button>
        </>
      }
    >
      {error && <ErrorNote message={error} />}
      <form id="key-form" onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Key stamp" required hint="e.g. 2A.9">
            <TextInput value={keyStamp} onChange={(e) => setKeyStamp(e.target.value)} autoFocus required />
          </Field>
          <Field label="Room number">
            <TextInput value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
          </Field>
        </div>
        <Field label="Room description">
          <TextInput value={roomDescription} onChange={(e) => setRoomDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Building">
            <TextInput value={building} onChange={(e) => setBuilding(e.target.value)} />
          </Field>
          <Field label="Department">
            <TextInput value={department} onChange={(e) => setDepartment(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <p className="text-[11px] leading-relaxed" style={{ color: "#6b6d72" }}>
          A key stamp identifies a cut, not a single piece of metal — several people can hold copies
          of the same stamp. Add the key once here, then issue it to each person.
        </p>
      </form>
    </Modal>
  );
}

// ── Assignment (check out / edit) ─────────────────────────────────────────────

export function AssignmentDialog({
  assignment, snapshot, defaultPersonId, defaultKeyId, onSave, onClose,
}: {
  assignment: Assignment | null;
  snapshot: Snapshot;
  defaultPersonId?: string;
  defaultKeyId?: string;
  onSave: (input: AssignmentInput) => Promise<void>;
  onClose: () => void;
}) {
  const [personId, setPersonId] = useState(assignment?.personId ?? defaultPersonId ?? "");
  const [personSearch, setPersonSearch] = useState("");
  const [newPersonLastName, setNewPersonLastName] = useState("");
  const [newPersonFirstName, setNewPersonFirstName] = useState("");
  const [newPersonBldg, setNewPersonBldg] = useState("");
  const [newPersonDept, setNewPersonDept] = useState("");

  const [keyId, setKeyId] = useState(assignment?.keyId ?? defaultKeyId ?? "");
  const [keySearch, setKeySearch] = useState("");
  const [newKeyStamp, setNewKeyStamp] = useState("");
  const [newKeyRoom, setNewKeyRoom] = useState("");

  const [dateIssued, setDateIssued] = useState(assignment?.dateIssued ?? todayIso());
  const [dateReturned, setDateReturned] = useState(assignment?.dateReturned ?? "");
  const [numKeys, setNumKeys] = useState(String(assignment?.numKeys ?? 1));
  const [notes, setNotes] = useState(assignment?.notes ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const people = [...snapshot.people].sort((a, b) => a.fullName.localeCompare(b.fullName));
  const keys = [...snapshot.keys].sort(
    (a, b) => a.keyStamp.localeCompare(b.keyStamp, undefined, { numeric: true }),
  );

  const filteredPeople = people.filter((p) =>
    p.fullName.toLowerCase().includes(personSearch.toLowerCase()),
  );
  const filteredKeys = keys.filter((k) =>
    (k.keyStamp + (k.roomNumber ?? "") + (k.roomDescription ?? ""))
      .toLowerCase()
      .includes(keySearch.toLowerCase()),
  );

  const selectedPerson = personId ? people.find((p) => p.id === personId) : null;
  const selectedKey = keyId ? keys.find((k) => k.id === keyId) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Either an existing person OR new person details
    const hasExistingPerson = !!personId;
    const hasNewPerson = newPersonFirstName.trim() !== "" && newPersonLastName.trim() !== "";
    if (!hasExistingPerson && !hasNewPerson) {
      setError("Select a person or enter first and last name");
      return;
    }

    // Either an existing key OR new key details
    const hasExistingKey = !!keyId;
    const hasNewKey = newKeyStamp.trim() !== "";
    if (!hasExistingKey && !hasNewKey) {
      setError("Select an existing key or enter a new key stamp");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const effectivePersonId = hasExistingPerson ? personId : "new-person";
      const effectiveKeyId = hasExistingKey ? keyId : "new-key";
      const input: AssignmentInput = {
        personId: effectivePersonId,
        keyId: effectiveKeyId,
        dateIssued,
        dateReturned: dateReturned || null,
        numKeys: Number(numKeys) || 1,
        notes: blank(notes),
      };
      if (!hasExistingPerson) {
        input.newPersonLastName = newPersonLastName.trim();
        input.newPersonFirstName = newPersonFirstName.trim();
        input.newPersonBldg = newPersonBldg.trim() || undefined;
        input.newPersonDept = newPersonDept.trim() || undefined;
      }
      if (!hasExistingKey) {
        input.newKeyStamp = newKeyStamp.trim();
        input.newKeyRoom = newKeyRoom.trim() || undefined;
      }
      await onSave(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={assignment ? "Edit Assignment" : "Issue Key"}
      onClose={onClose}
      wide
      footer={
        <>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            form="assignment-form"
            variant="primary"
            disabled={busy || (!personId && (!newPersonFirstName.trim() || !newPersonLastName.trim())) || (!keyId && !newKeyStamp.trim())}
          >
            {busy ? "Saving…" : assignment ? "Save Changes" : "Issue Key"}
          </Button>
        </>
      }
    >
      {error && <ErrorNote message={error} />}
      <form id="assignment-form" onSubmit={submit} className="flex flex-col gap-4">
        {/* Person Selection */}
        <div>
          <Field label="Person" required>
            <TextInput
              placeholder="Type to search…"
              value={selectedPerson ? `${selectedPerson.fullName}` : personSearch}
              onChange={(e) => {
                if (selectedPerson) {
                  setPersonSearch("");
                  setPersonId("");
                } else {
                  setPersonSearch(e.target.value);
                }
              }}
              autoFocus
            />
          </Field>
          {!selectedPerson && personSearch && (
            <div
              className="border rounded mt-1 bg-white"
              style={{ borderColor: "#dcdfe3", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
            >
              {filteredPeople.length > 0 && (
                <div>
                  {filteredPeople.slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setPersonId(p.id); setPersonSearch(""); }}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-blue-50 border-b border-[#dcdfe3] last:border-0"
                    >
                      {p.fullName}{p.department ? ` — ${p.department}` : ""}
                    </button>
                  ))}
                </div>
              )}
              <div className="px-3 py-2 text-[12px] font-medium" style={{ color: "#004165", background: "#f5f6f7" }}>
                Create new person below
              </div>
            </div>
          )}
        </div>

        {/* Create new person inline if not selected and user typed something */}
        {!selectedPerson && personSearch && (
          <div className="border-l-4 pl-3 py-2" style={{ borderColor: "#00A9E0", background: "#f9fafb" }}>
            <div className="text-[12px] font-semibold mb-2" style={{ color: "#004165" }}>New Person</div>
            <div className="grid grid-cols-4 gap-2">
              <Field label="LastName" required>
                <TextInput
                  placeholder="e.g. Doe"
                  value={newPersonLastName}
                  onChange={(e) => setNewPersonLastName(e.target.value)}
                />
              </Field>
              <Field label="FirstName" required>
                <TextInput
                  placeholder="e.g. John"
                  value={newPersonFirstName}
                  onChange={(e) => setNewPersonFirstName(e.target.value)}
                />
              </Field>
              <Field label="Building">
                <TextInput
                  placeholder="e.g. Main Hall"
                  value={newPersonBldg}
                  onChange={(e) => setNewPersonBldg(e.target.value)}
                />
              </Field>
              <Field label="Department">
                <TextInput
                  placeholder="e.g. IT"
                  value={newPersonDept}
                  onChange={(e) => setNewPersonDept(e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {/* Key Selection */}
        <div>
          <Field label="Key" required>
            <TextInput
              placeholder="Type to search…"
              value={selectedKey ? `${selectedKey.keyStamp}` : keySearch}
              onChange={(e) => {
                if (selectedKey) {
                  setKeySearch("");
                  setKeyId("");
                } else {
                  setKeySearch(e.target.value);
                }
              }}
            />
          </Field>
          {!selectedKey && keySearch && (
            <div
              className="border rounded mt-1 bg-white"
              style={{ borderColor: "#dcdfe3", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
            >
              {filteredKeys.length > 0 && (
                <div>
                  {filteredKeys.slice(0, 5).map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => { setKeyId(k.id); setKeySearch(""); }}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-blue-50 border-b border-[#dcdfe3] last:border-0"
                    >
                      {k.keyStamp}
                      {k.roomNumber ? ` — Rm ${k.roomNumber}` : ""}
                      {k.roomDescription ? ` (${k.roomDescription})` : ""}
                    </button>
                  ))}
                </div>
              )}
              <div className="px-3 py-2 text-[12px] font-medium" style={{ color: "#004165", background: "#f5f6f7" }}>
                Create new key below
              </div>
            </div>
          )}
        </div>

        {/* Create new key inline if not selected and user typed something */}
        {!selectedKey && keySearch && (
          <div className="border-l-4 pl-3 py-2" style={{ borderColor: "#00A9E0", background: "#f9fafb" }}>
            <div className="text-[12px] font-semibold mb-2" style={{ color: "#004165" }}>New Key</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Key stamp" required>
                <TextInput
                  placeholder="e.g. 2A.9"
                  value={newKeyStamp}
                  onChange={(e) => setNewKeyStamp(e.target.value)}
                />
              </Field>
              <Field label="Room Number/Description">
                <TextInput
                  placeholder="e.g. 320 - Office"
                  value={newKeyRoom}
                  onChange={(e) => setNewKeyRoom(e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {/* Assignment Details */}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date issued" required>
            <TextInput type="date" value={dateIssued} onChange={(e) => setDateIssued(e.target.value)} required />
          </Field>
          <Field label="Date returned" hint="Leave blank if still out">
            <TextInput type="date" value={dateReturned} onChange={(e) => setDateReturned(e.target.value)} />
          </Field>
          <Field label="# of keys">
            <TextInput
              type="number" min={1} step={1}
              value={numKeys}
              onChange={(e) => setNumKeys(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes">
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

// ── Return a key ──────────────────────────────────────────────────────────────

/**
 * Pick an outstanding checkout and mark it returned. Searchable by person, key
 * stamp, or room so you can find the exact card to close out.
 */
export function ReturnDialog({
  records, onReturn, onClose,
}: {
  records: KeyRecord[]; // active checkouts only
  onReturn: (assignmentId: string, dateReturned: string) => Promise<void>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<KeyRecord | null>(null);
  const [dateReturned, setDateReturned] = useState(todayIso());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = records
    .filter((r) =>
      `${r.personName} ${r.keyStamp} ${r.roomDescription} ${r.roomNumber} ${r.building}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .slice(0, 8);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setError("Search for and select the key to return.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onReturn(selected.assignmentId, dateReturned);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Return Key"
      onClose={onClose}
      wide
      footer={
        <>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="return-form" variant="dangerSolid" disabled={busy || !selected}>
            {busy ? "Saving…" : "Mark Returned"}
          </Button>
        </>
      }
    >
      {error && <ErrorNote message={error} />}
      <form id="return-form" onSubmit={submit} className="flex flex-col gap-4">
        {selected ? (
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded"
            style={{ background: "#f5f8fa", border: `1px solid ${DSU.lightBorder}` }}
          >
            <Avatar initials={selected.initials} size={34} />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium" style={{ color: DSU.navy }}>{selected.personName}</div>
              <div className="flex items-center gap-2 text-[12px] mt-0.5" style={{ color: DSU.midGray }}>
                <Stamp stamp={selected.keyStamp} />
                <span className="truncate">{selected.roomDescription || selected.roomNumber || "—"}</span>
                <span>· issued {formatDate(selected.dateIssued) ?? "—"}</span>
              </div>
            </div>
            <Button type="button" onClick={() => { setSelected(null); setSearch(""); }}>Change</Button>
          </div>
        ) : (
          <div>
            <Field label="Find the outstanding key" required>
              <TextInput
                placeholder="Search person, stamp, or room…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </Field>
            {search && (
              <div
                className="border rounded mt-1 bg-white overflow-hidden"
                style={{ borderColor: DSU.lightBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
              >
                {filtered.length === 0 ? (
                  <div className="px-3 py-2 text-[12px]" style={{ color: DSU.midGray }}>
                    No outstanding key matches that.
                  </div>
                ) : (
                  filtered.map((r) => (
                    <button
                      key={r.assignmentId}
                      type="button"
                      onClick={() => { setSelected(r); setSearch(""); }}
                      className="flex items-center gap-2.5 w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-0"
                      style={{ borderColor: DSU.lightBorder }}
                    >
                      <Avatar initials={r.initials} size={24} />
                      <span className="text-[13px] font-medium" style={{ color: DSU.navy }}>{r.personName}</span>
                      <span className="text-[12px]" style={{ color: DSU.midGray }}>
                        {r.keyStamp}{r.roomDescription ? ` · ${r.roomDescription}` : ""}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <Field label="Date returned" required>
          <TextInput type="date" value={dateReturned} onChange={(e) => setDateReturned(e.target.value)} required />
        </Field>
      </form>
    </Modal>
  );
}

// ── Delete confirmation ───────────────────────────────────────────────────────

export function ConfirmDialog({
  title, message, confirmLabel = "Delete", onConfirm, onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger" onClick={run} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      {error && <ErrorNote message={error} />}
      <p className="text-[13px] leading-relaxed" style={{ color: "#4d4f53" }}>{message}</p>
    </Modal>
  );
}

import { useEffect, useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import type { Assignment, KeyDef, KeyRecord, NewAssignment, NewKeyDef, NewPerson, Person, Snapshot } from "../../lib/types";
import { extractParsedRequests, type ParsedRequestEntry, extractReturnRequests, type ParsedReturnEntry } from "../../lib/pdfExtraction";
import { extractTextFromPdf, type PdfProgress } from "../../lib/pdfOcr";
import { Avatar, Button, Combobox, ErrorNote, Field, Modal, Stamp, TextInput } from "./primitives";
import { DSU, formatDate, todayIso } from "../theme";

/**
 * Create/edit dialogs for the three entities. Each one owns its draft state and
 * calls onSave, which throws a human-readable Error on validation failure; the
 * dialog catches it and shows it inline instead of closing.
 */

const blank = (v: string) => (v.trim() === "" ? null : v.trim());

function ClearableTextInput({
  value,
  onChange,
  clearValue,
  clearLabel = "Clear",
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  value: string;
  clearValue: () => void;
  clearLabel?: string;
}) {
  return (
    <div className="relative">
      <TextInput
        {...props}
        value={value}
        onChange={onChange}
        className={`w-full pr-8 ${className ?? ""}`.trim()}
      />
      {value !== "" && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clearValue}
          aria-label={clearLabel}
          title={clearLabel}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#6b6d72] hover:bg-gray-100 hover:text-[#004165]"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

/**
 * Collapsible view of whatever text a PDF upload actually produced (text layer
 * or OCR). Shown whether parsing succeeded or not, so staff can cross-check
 * the source — most useful when structured parsing found nothing, since OCR
 * on handwriting is unreliable and the raw text is often the only lead left.
 */
function ExtractedTextPanel({
  text, usedOcr, open, onToggle,
}: {
  text: string;
  usedOcr: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  if (!text.trim()) return null;
  return (
    <div className="rounded-md border overflow-hidden" style={{ borderColor: DSU.lightBorder }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium hover:bg-[#f5f6f7] transition-colors"
        style={{ color: "#004165" }}
      >
        <span>{open ? "Hide" : "Show"} extracted text{usedOcr ? " (read via OCR)" : ""}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="px-3 pb-3">
          {usedOcr && (
            <p className="text-[11px] mb-2" style={{ color: DSU.midGray }}>
              This PDF looked scanned, so it was read with OCR rather than a real text layer — handwriting
              especially can come out wrong. Use it as a reference while filling in the fields yourself.
            </p>
          )}
          <pre
            className="text-[11px] whitespace-pre-wrap max-h-52 overflow-y-auto rounded p-2 font-mono"
            style={{ background: "#f5f6f7", color: DSU.darkGray }}
          >
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}

/** Sorted, de-duplicated non-empty strings — for building/department suggestions. */
function distinctStrings(vals: (string | null | undefined)[]): string[] {
  return [...new Set(vals.map((v) => (v ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

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
  person, onSave, onClose, buildings = [], departments = [],
}: {
  person: Person | null;
  onSave: (input: NewPerson) => Promise<void>;
  onClose: () => void;
  buildings?: string[];
  departments?: string[];
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
          <Field label="Department" hint="Type to search or add a new one">
            <Combobox value={department} onChange={setDepartment} options={departments} placeholder="e.g. Facilities" />
          </Field>
          <Field label="Building" hint="Type to search or add a new one">
            <Combobox value={building} onChange={setBuilding} options={buildings} placeholder="e.g. Beadle Hall" />
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
  assignment, snapshot, defaultPersonId, defaultKeyId, defaultReturned, onSave, onClose,
}: {
  assignment: Assignment | null;
  snapshot: Snapshot;
  defaultPersonId?: string;
  defaultKeyId?: string;
  /** Opens the form pre-filled as an already-returned record, for adding
   *  historical issuances straight into the Returned page. */
  defaultReturned?: boolean;
  onSave: (input: AssignmentInput) => Promise<{ personId: string; keyId: string } | void>;
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
  const [showNewPerson, setShowNewPerson] = useState(false);
  const [showNewKey, setShowNewKey] = useState(false);
  const [personNameEdited, setPersonNameEdited] = useState(false);
  const [keyStampEdited, setKeyStampEdited] = useState(false);

  const [dateIssued, setDateIssued] = useState(assignment?.dateIssued ?? todayIso());
  const [dateReturned, setDateReturned] = useState(assignment?.dateReturned ?? (defaultReturned ? todayIso() : ""));
  const [numKeys, setNumKeys] = useState(String(assignment?.numKeys ?? 1));
  const [notes, setNotes] = useState(assignment?.notes ?? "");
  const [parsedRequests, setParsedRequests] = useState<ParsedRequestEntry[]>([]);
  const [reviewingPdf, setReviewingPdf] = useState(false);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [uploadedPdfName, setUploadedPdfName] = useState("");
  const [ocrProgress, setOcrProgress] = useState<PdfProgress | null>(null);
  const [rawExtractedText, setRawExtractedText] = useState("");
  const [rawTextWasOcr, setRawTextWasOcr] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const buildingOptions = distinctStrings([
    ...snapshot.people.map((p) => p.building), ...snapshot.keys.map((k) => k.building),
  ]);
  const departmentOptions = distinctStrings([
    ...snapshot.people.map((p) => p.department), ...snapshot.keys.map((k) => k.department),
  ]);

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

  // Are we in "add a new person" mode?
  const creatingPerson =
    !selectedPerson && personSearch.trim() !== "" && (filteredPeople.length === 0 || showNewPerson);

  // Auto-split the typed name into First / Last while creating, until the user
  // edits the name fields themselves (then we leave their edits alone).
  useEffect(() => {
    if (!creatingPerson || personNameEdited) return;
    const parts = personSearch.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      setNewPersonFirstName(parts.slice(0, -1).join(" "));
      setNewPersonLastName(parts[parts.length - 1]);
    } else {
      setNewPersonFirstName(parts[0] ?? "");
      setNewPersonLastName("");
    }
  }, [creatingPerson, personSearch, personNameEdited]);

  const cancelNewPerson = () => {
    setPersonSearch("");
    setShowNewPerson(false);
    setPersonNameEdited(false);
    setNewPersonFirstName("");
    setNewPersonLastName("");
    setNewPersonBldg("");
    setNewPersonDept("");
  };

  // Are we in "add a new key" mode? Prefill the stamp from what was typed.
  const creatingKey =
    !selectedKey && keySearch.trim() !== "" && (filteredKeys.length === 0 || showNewKey);

  useEffect(() => {
    if (!creatingKey || keyStampEdited) return;
    setNewKeyStamp(keySearch.trim());
  }, [creatingKey, keySearch, keyStampEdited]);

  const cancelNewKey = () => {
    setKeySearch("");
    setShowNewKey(false);
    setKeyStampEdited(false);
    setNewKeyStamp("");
    setNewKeyRoom("");
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtractingPdf(true);
    setOcrProgress(null);
    setError("");
    setReviewingPdf(false);
    setParsedRequests([]);
    setRawExtractedText("");

    try {
      const { text, usedOcr } = await extractTextFromPdf(file, (p) => setOcrProgress(p));
      setRawExtractedText(text);
      setRawTextWasOcr(usedOcr);
      const parsed = extractParsedRequests(text);
      if (parsed.length === 0) {
        setShowRawText(true);
        setError(
          usedOcr
            ? "This looks like a scanned or handwritten form — OCR couldn't make out any request details from it. Check the extracted text below, or fill the fields in manually."
            : "We couldn’t read any request details from that PDF. Check the extracted text below, or fill the fields in manually.",
        );
        return;
      }

      setUploadedPdfName(file.name);
      setParsedRequests(parsed);
      setReviewingPdf(true);

      if (parsed.length === 1) {
        const first = parsed[0];
        const nameParts = first.personName.trim().split(/\s+/).filter(Boolean);
        const firstName = nameParts.slice(0, -1).join(" ");
        const lastName = nameParts[nameParts.length - 1] ?? "";
        if (first.personName) {
          setPersonSearch(first.personName);
          setShowNewPerson(true);
          setPersonNameEdited(true);
          setNewPersonFirstName(firstName);
          setNewPersonLastName(lastName);
        }
        if (first.keyStamp) {
          setKeySearch(first.keyStamp);
          setShowNewKey(true);
          setKeyStampEdited(true);
          setNewKeyStamp(first.keyStamp);
        }
        if (first.roomDescription) setNewKeyRoom(first.roomDescription);
        if (first.dateIssued) setDateIssued(first.dateIssued);
        if (first.notes) setNotes(first.notes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The PDF could not be read.");
    } finally {
      setExtractingPdf(false);
      setOcrProgress(null);
      e.target.value = "";
    }
  };

  const applyParsedRequests = async () => {
    if (parsedRequests.length === 0) return;

    setBusy(true);
    setError("");

    // A PDF request commonly lists one person against several key stamps. The
    // snapshot passed into this dialog doesn't refresh mid-loop, so once we've
    // created a new person/key on an earlier entry we remember its id here
    // rather than asking "does this exist yet?" against the stale list again —
    // otherwise every subsequent entry for that same new person would try to
    // create it a second time and fail on the uniqueness check.
    const resolvedPersonIds = new Map<string, string>();
    const resolvedKeyIds = new Map<string, string>();

    try {
      for (const entry of parsedRequests) {
        const firstName = entry.personFirstName.trim();
        const lastName = entry.personLastName.trim();
        const nameKey = entry.personName.trim().toLowerCase();
        const stampKey = entry.keyStamp.trim().toLowerCase();

        const existingPerson = people.find((p) => p.fullName.toLowerCase() === nameKey);
        const existingKey = keys.find((k) => k.keyStamp.toLowerCase() === stampKey);

        const personId = existingPerson?.id ?? resolvedPersonIds.get(nameKey) ?? "new-person";
        const keyId = existingKey?.id ?? resolvedKeyIds.get(stampKey) ?? "new-key";

        const input: AssignmentInput = {
          personId,
          keyId,
          dateIssued: entry.dateIssued || dateIssued,
          dateReturned: dateReturned || null,
          numKeys: Number(numKeys) || 1,
          notes: blank(entry.notes || notes),
        };

        if (personId === "new-person") {
          input.newPersonLastName = lastName;
          input.newPersonFirstName = firstName;
          input.newPersonBldg = entry.building.trim() || undefined;
          input.newPersonDept = entry.department.trim() || undefined;
        }
        if (keyId === "new-key") {
          input.newKeyStamp = entry.keyStamp.trim();
          input.newKeyRoom = entry.roomDescription.trim() || undefined;
        }

        const result = await onSave(input);
        if (personId === "new-person" && result?.personId) resolvedPersonIds.set(nameKey, result.personId);
        if (keyId === "new-key" && result?.keyId) resolvedKeyIds.set(stampKey, result.keyId);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If reviewing PDF, use the PDF apply flow instead
    if (reviewingPdf) {
      await applyParsedRequests();
      return;
    }

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
      title={assignment ? "Edit Assignment" : defaultReturned ? "Add Returned Record" : "Issue Key"}
      onClose={onClose}
      wide
      footer={
        <>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            form="assignment-form"
            variant="primary"
            disabled={busy || (reviewingPdf ? parsedRequests.length === 0 : ((!personId && (!newPersonFirstName.trim() || !newPersonLastName.trim())) || (!keyId && !newKeyStamp.trim())))}
          >
            {busy ? "Saving…" : assignment ? "Save Changes" : defaultReturned ? "Add Returned Record" : "Issue Key"}
          </Button>
        </>
      }
    >
      {error && <ErrorNote message={error} />}
      <form id="assignment-form" onSubmit={submit} className="flex flex-col gap-4">
        {!reviewingPdf && (
          <>
            {/* Person Selection */}
            <div className="relative">
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
                      if (!e.target.value.trim()) { setShowNewPerson(false); setPersonNameEdited(false); }
                    }
                  }}
                  autoFocus
                />
              </Field>
              {/* Suggestions float over the form so the dialog height never jumps. */}
              {!selectedPerson && personSearch.trim() && filteredPeople.length > 0 && !showNewPerson && (
                <div
                  className="absolute left-0 right-0 top-full mt-1 rounded border bg-white overflow-y-auto z-30"
                  style={{ borderColor: "#dcdfe3", boxShadow: "0 10px 28px -10px rgba(16,40,56,0.28)", maxHeight: 240 }}
                >
                  {filteredPeople.slice(0, 6).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setPersonId(p.id); setPersonSearch(""); }}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-blue-50 border-b border-[#eef1f3] last:border-0"
                    >
                      {p.fullName}{p.department ? ` — ${p.department}` : ""}
                    </button>
                  ))}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowNewPerson(true)}
                    className="w-full text-left px-3 py-2 text-[12px] font-medium hover:bg-blue-50"
                    style={{ color: "#004165", background: "#f5f6f7" }}
                  >
                    + Add a new person instead
                  </button>
                </div>
              )}
            </div>

            {/* New person form: only when there's no match, or the user chose to add one. */}
            {creatingPerson && (
              <div className="border-l-4 pl-3 pr-3 py-2.5" style={{ borderColor: DSU.trojan, background: "#e9f4fb" }}>
                <div className="text-[12px] font-semibold mb-2" style={{ color: "#004165" }}>New Person</div>
                <div className="flex items-end gap-2">
                  <div className="grid grid-cols-4 gap-2 flex-1">
                    <Field label="LastName" required>
                      <ClearableTextInput
                        placeholder="e.g. Doe"
                        value={newPersonLastName}
                        onChange={(e) => { setNewPersonLastName(e.target.value); setPersonNameEdited(true); }}
                        clearValue={() => { setNewPersonLastName(""); setPersonNameEdited(true); }}
                        clearLabel="Clear last name"
                      />
                    </Field>
                    <Field label="FirstName" required>
                      <ClearableTextInput
                        placeholder="e.g. John"
                        value={newPersonFirstName}
                        onChange={(e) => { setNewPersonFirstName(e.target.value); setPersonNameEdited(true); }}
                        clearValue={() => { setNewPersonFirstName(""); setPersonNameEdited(true); }}
                        clearLabel="Clear first name"
                      />
                    </Field>
                    <Field label="Building">
                      <Combobox value={newPersonBldg} onChange={setNewPersonBldg} options={buildingOptions} placeholder="e.g. Beadle Hall" />
                    </Field>
                    <Field label="Department">
                      <Combobox value={newPersonDept} onChange={setNewPersonDept} options={departmentOptions} placeholder="e.g. Facilities" />
                    </Field>
                  </div>
                  <button
                    type="button"
                    onClick={cancelNewPerson}
                    aria-label="Cancel new person"
                    title="Cancel"
                    className="shrink-0 p-1.5 rounded-md border bg-white hover:bg-red-50 transition-colors mb-[1px]"
                    style={{ borderColor: DSU.lightBorder, color: DSU.danger }}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* Key Selection */}
            <div className="relative">
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
                      if (!e.target.value.trim()) { setShowNewKey(false); setKeyStampEdited(false); }
                    }
                  }}
                />
              </Field>
              {!selectedKey && keySearch.trim() && filteredKeys.length > 0 && !showNewKey && (
                <div
                  className="absolute left-0 right-0 top-full mt-1 rounded border bg-white overflow-y-auto z-30"
                  style={{ borderColor: "#dcdfe3", boxShadow: "0 10px 28px -10px rgba(16,40,56,0.28)", maxHeight: 240 }}
                >
                  {filteredKeys.slice(0, 6).map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setKeyId(k.id); setKeySearch(""); }}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-blue-50 border-b border-[#eef1f3] last:border-0"
                    >
                      {k.keyStamp}
                      {k.roomNumber ? ` — Rm ${k.roomNumber}` : ""}
                      {k.roomDescription ? ` (${k.roomDescription})` : ""}
                    </button>
                  ))}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowNewKey(true)}
                    className="w-full text-left px-3 py-2 text-[12px] font-medium hover:bg-blue-50"
                    style={{ color: "#004165", background: "#f5f6f7" }}
                  >
                    + Add a new key instead
                  </button>
                </div>
              )}
            </div>

            {/* New key form: only when there's no match, or the user chose to add one. */}
            {creatingKey && (
              <div className="border-l-4 pl-3 pr-3 py-2.5" style={{ borderColor: DSU.trojan, background: "#e9f4fb" }}>
                <div className="text-[12px] font-semibold mb-2" style={{ color: "#004165" }}>New Key</div>
                <div className="flex items-end gap-2">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <Field label="Key stamp" required>
                      <ClearableTextInput
                        placeholder="e.g. 2A.9"
                        value={newKeyStamp}
                        onChange={(e) => { setNewKeyStamp(e.target.value); setKeyStampEdited(true); }}
                        clearValue={() => { setNewKeyStamp(""); setKeyStampEdited(true); }}
                        clearLabel="Clear key stamp"
                      />
                    </Field>
                    <Field label="Room Number/Description">
                      <ClearableTextInput
                        placeholder="e.g. 320 - Office"
                        value={newKeyRoom}
                        onChange={(e) => setNewKeyRoom(e.target.value)}
                        clearValue={() => setNewKeyRoom("")}
                        clearLabel="Clear room"
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    onClick={cancelNewKey}
                    aria-label="Cancel new key"
                    title="Cancel"
                    className="shrink-0 p-1.5 rounded-md border bg-white hover:bg-red-50 transition-colors mb-[1px]"
                    style={{ borderColor: DSU.lightBorder, color: DSU.danger }}
                  >
                    <X size={15} />
                  </button>
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
          </>
        )}

        <div className="rounded-md border border-dashed p-3" style={{ borderColor: DSU.lightBorder, background: "#f9fafb" }}>
          <div className="text-[12px] font-semibold mb-2" style={{ color: "#004165" }}>
            Upload request form PDF
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors hover:bg-blue-50" style={{ borderColor: DSU.lightBorder, color: "#004165" }}>
            <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />
            {extractingPdf
              ? (ocrProgress ? `OCR page ${ocrProgress.page}/${ocrProgress.totalPages} — ${ocrProgress.status}` : "Reading PDF…")
              : uploadedPdfName ? `Re-upload PDF (${uploadedPdfName})` : "Choose PDF"}
          </label>
          <p className="mt-2 text-[11px]" style={{ color: DSU.midGray }}>
            Upload a request form and we'll read the person/key details from it. Multiple entries in one form will be reviewed before saving.
            {extractingPdf && ocrProgress && " Scanned/handwritten forms are read with OCR, which takes longer and can misread handwriting — check the review step carefully."}
          </p>
        </div>

        <ExtractedTextPanel
          text={rawExtractedText}
          usedOcr={rawTextWasOcr}
          open={showRawText}
          onToggle={() => setShowRawText((v) => !v)}
        />

        {reviewingPdf && parsedRequests.length > 0 && (
          <div className="rounded-md border p-3" style={{ borderColor: DSU.lightBorder, background: "#f8fbfd" }}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-[12px] font-semibold" style={{ color: "#004165" }}>
                Review extracted requests
              </div>
              <Button type="button" onClick={applyParsedRequests} disabled={busy}>
                {busy ? "Saving…" : "Apply reviewed requests"}
              </Button>
            </div>

            {/* Person Info Section */}
            <div className="rounded-md border bg-white p-3 mb-3" style={{ borderColor: "#e5e7eb" }}>
              <div className="text-[11px] font-semibold uppercase mb-2.5" style={{ color: DSU.midGray }}>
                Person
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Field label="Last Name">
                  <TextInput
                    value={parsedRequests[0]?.personLastName ?? ""}
                    onChange={(e) => {
                      const next = [...parsedRequests];
                      next[0] = { ...next[0], personLastName: e.target.value, personName: `${e.target.value} ${next[0]?.personFirstName ?? ""}`.trim() };
                      setParsedRequests(next);
                    }}
                  />
                </Field>
                <Field label="First Name">
                  <TextInput
                    value={parsedRequests[0]?.personFirstName ?? ""}
                    onChange={(e) => {
                      const next = [...parsedRequests];
                      next[0] = { ...next[0], personFirstName: e.target.value, personName: `${next[0]?.personLastName ?? ""} ${e.target.value}`.trim() };
                      setParsedRequests(next);
                    }}
                  />
                </Field>
                <Field label="Department">
                  <TextInput
                    value={parsedRequests[0]?.department ?? ""}
                    onChange={(e) => {
                      const next = [...parsedRequests];
                      next[0] = { ...next[0], department: e.target.value };
                      setParsedRequests(next.map(entry => ({ ...entry, department: e.target.value })));
                    }}
                  />
                </Field>
                <Field label="Building">
                  <TextInput
                    value={parsedRequests[0]?.building ?? ""}
                    onChange={(e) => {
                      const next = [...parsedRequests];
                      next[0] = { ...next[0], building: e.target.value };
                      setParsedRequests(next.map(entry => ({ ...entry, building: e.target.value })));
                    }}
                  />
                </Field>
              </div>
            </div>

            {/* Keys Section */}
            <div className="text-[11px] font-semibold uppercase mb-2.5" style={{ color: DSU.midGray }}>
              Keys
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {parsedRequests.map((entry, index) => (
                <div key={entry.id} className="rounded-md border bg-white p-2.5" style={{ borderColor: "#e5e7eb" }}>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Key Stamp">
                      <TextInput
                        value={entry.keyStamp}
                        onChange={(e) => {
                          const next = [...parsedRequests];
                          next[index] = { ...next[index], keyStamp: e.target.value };
                          setParsedRequests(next);
                        }}
                      />
                    </Field>
                    <Field label="Room">
                      <TextInput
                        value={entry.roomDescription}
                        onChange={(e) => {
                          const next = [...parsedRequests];
                          next[index] = { ...next[index], roomDescription: e.target.value };
                          setParsedRequests(next);
                        }}
                      />
                    </Field>
                    <Field label="Date Issued">
                      <TextInput
                        type="date"
                        value={entry.dateIssued}
                        onChange={(e) => {
                          const next = [...parsedRequests];
                          next[index] = { ...next[index], dateIssued: e.target.value };
                          setParsedRequests(next);
                        }}
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
  const [parsedReturns, setParsedReturns] = useState<ParsedReturnEntry[]>([]);
  const [reviewingPdf, setReviewingPdf] = useState(false);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [uploadedPdfName, setUploadedPdfName] = useState("");
  const [ocrProgress, setOcrProgress] = useState<PdfProgress | null>(null);
  const [rawExtractedText, setRawExtractedText] = useState("");
  const [rawTextWasOcr, setRawTextWasOcr] = useState(false);
  const [showRawText, setShowRawText] = useState(false);

  const filtered = records
    .filter((r) =>
      `${r.personName} ${r.keyStamp} ${r.roomDescription} ${r.roomNumber} ${r.building}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .slice(0, 8);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If reviewing PDF, apply bulk returns instead
    if (reviewingPdf) {
      await applyParsedReturns();
      return;
    }

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

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtractingPdf(true);
    setOcrProgress(null);
    setError("");
    setReviewingPdf(false);
    setParsedReturns([]);
    setRawExtractedText("");

    try {
      const { text, usedOcr } = await extractTextFromPdf(file, (p) => setOcrProgress(p));
      setRawExtractedText(text);
      setRawTextWasOcr(usedOcr);
      const parsed = extractReturnRequests(text);
      if (parsed.length === 0) {
        setShowRawText(true);
        setError(
          usedOcr
            ? "This looks like a scanned or handwritten form — OCR couldn't make out any return details from it. Check the extracted text below, or find the key manually above."
            : "We couldn't read any return details from that PDF. Check the extracted text below, or find the key manually above.",
        );
        return;
      }

      setUploadedPdfName(file.name);
      setParsedReturns(parsed);
      setReviewingPdf(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The PDF could not be read.");
    } finally {
      setExtractingPdf(false);
      setOcrProgress(null);
      e.target.value = "";
    }
  };

  const applyParsedReturns = async () => {
    if (parsedReturns.length === 0) return;

    setBusy(true);
    setError("");

    try {
      for (const entry of parsedReturns) {
        // Find the matching outstanding key by person name and key stamp
        const match = records.find(
          (r) => r.personName.toLowerCase() === entry.personName.toLowerCase() && 
                 r.keyStamp.toLowerCase() === entry.keyStamp.toLowerCase()
        );

        if (match) {
          await onReturn(match.assignmentId, entry.dateReturned || dateReturned);
        }
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
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
          <Button 
            type="submit" 
            form="return-form" 
            variant="dangerSolid" 
            disabled={busy || (reviewingPdf ? parsedReturns.length === 0 : !selected)}
          >
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

        {!reviewingPdf && (
          <div className="rounded-md border border-dashed p-3" style={{ borderColor: DSU.lightBorder, background: "#f9fafb" }}>
            <div className="text-[12px] font-semibold mb-2" style={{ color: "#004165" }}>
              Upload return form PDF
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors hover:bg-blue-50" style={{ borderColor: DSU.lightBorder, color: "#004165" }}>
              <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />
              {extractingPdf
                ? (ocrProgress ? `OCR page ${ocrProgress.page}/${ocrProgress.totalPages} — ${ocrProgress.status}` : "Reading PDF…")
                : uploadedPdfName ? `Re-upload PDF (${uploadedPdfName})` : "Choose PDF"}
            </label>
            <p className="mt-2 text-[11px]" style={{ color: DSU.midGray }}>
              Upload a return form and we'll read the keys being returned. Multiple entries in one form will be reviewed before saving.
              {extractingPdf && ocrProgress && " Scanned/handwritten forms are read with OCR, which takes longer and can misread handwriting — check the review step carefully."}
            </p>
          </div>
        )}

        {!reviewingPdf && (
          <ExtractedTextPanel
            text={rawExtractedText}
            usedOcr={rawTextWasOcr}
            open={showRawText}
            onToggle={() => setShowRawText((v) => !v)}
          />
        )}

        {reviewingPdf && parsedReturns.length > 0 && (
          <div className="rounded-md border p-3" style={{ borderColor: DSU.lightBorder, background: "#f8fbfd" }}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-[12px] font-semibold" style={{ color: "#004165" }}>
                Review keys to return
              </div>
              <Button type="button" onClick={applyParsedReturns} disabled={busy}>
                {busy ? "Saving…" : "Apply reviewed returns"}
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {parsedReturns.map((entry, index) => {
                const match = records.find(
                  (r) => r.personName.toLowerCase() === entry.personName.toLowerCase() && 
                         r.keyStamp.toLowerCase() === entry.keyStamp.toLowerCase()
                );
                const found = !!match;
                return (
                  <div
                    key={entry.id}
                    className="rounded-md border p-2.5"
                    style={{ borderColor: found ? "#e5e7eb" : "#ef5350", background: found ? "#fff" : "#fef4f3" }}
                  >
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Person">
                        <TextInput
                          value={entry.personName}
                          onChange={(e) => {
                            const next = [...parsedReturns];
                            next[index] = { ...next[index], personName: e.target.value };
                            setParsedReturns(next);
                          }}
                        />
                      </Field>
                      <Field label="Key Stamp">
                        <TextInput
                          value={entry.keyStamp}
                          onChange={(e) => {
                            const next = [...parsedReturns];
                            next[index] = { ...next[index], keyStamp: e.target.value };
                            setParsedReturns(next);
                          }}
                        />
                      </Field>
                      <Field label="Date Returned">
                        <TextInput
                          type="date"
                          value={entry.dateReturned}
                          onChange={(e) => {
                            const next = [...parsedReturns];
                            next[index] = { ...next[index], dateReturned: e.target.value };
                            setParsedReturns(next);
                          }}
                        />
                      </Field>
                    </div>
                    {!found && (
                      <div className="mt-2 text-[11px]" style={{ color: "#ef5350" }}>
                        ⚠ No matching outstanding key found for {entry.personName} / {entry.keyStamp}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
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

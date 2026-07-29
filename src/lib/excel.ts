import type ExcelJS from "exceljs";
import type { Snapshot, KeyRecord } from "./types";
import { newId } from "./id";
import { PERSON_CATEGORIES, DEFAULT_PERSON_CATEGORY, toRecords } from "./types";

/**
 * Excel import/export.
 *
 * The importer reads EVERY sheet in the workbook and stacks the rows, because
 * the source data is split across sheets (per building, per department, etc).
 * Columns are located by matching header text against the alias lists below, so
 * sheets with differing column orders still line up. Anything it cannot match
 * is reported back rather than silently dropped.
 *
 * ExcelJS is ~900KB, so it is imported on demand rather than at startup — only
 * visiting the Data tab and actually importing/exporting pays that cost.
 */

let excelModule: typeof import("exceljs") | null = null;

async function loadExcelJS() {
  if (!excelModule) excelModule = await import("exceljs");
  return excelModule.default ?? excelModule;
}

// ── column aliases ────────────────────────────────────────────────────────────
// Lowercased, punctuation-stripped. Add to these when a real sheet uses a
// heading that isn't recognized — that's the intended way to extend this.

const ALIASES: Record<string, string[]> = {
  personName: [
    "person", "person name", "name", "full name", "employee", "employee name",
    "holder", "key holder", "keyholder", "issued to", "assigned to", "staff",
    "faculty", "last first", "name last first",
  ],
  // The DSU audit workbook splits names across two columns; combined into one
  // full name during parsing.
  lastName: ["last name", "lastname", "last", "surname"],
  firstName: ["first name", "firstname", "first", "given name"],
  email: ["email", "e mail", "email address", "dsu email"],
  employeeId: ["employee id", "emp id", "id", "employee number", "empl id", "dsu id"],
  keyStamp: [
    "key stamp", "keystamp", "stamp", "key", "key code", "key id", "key no",
    "key number", "key #", "stamp code", "code",
  ],
  roomNumber: ["room number", "room no", "room #", "rm", "rm no", "room num"],
  roomDescription: [
    "room description", "description", "room desc", "desc", "room name",
    "area", "location", "space", "room",
    // DSU workbook merges number + description into one column.
    "room description num", "room description number", "room desc num",
    "room description room number", "room num description",
  ],
  building: ["building", "bldg", "building name", "facility"],
  department: ["department", "dept", "dept name", "division", "unit"],
  dateIssued: [
    "date issued", "issued", "issue date", "date out", "checkout date",
    "checked out", "date given", "issued on",
  ],
  dateReturned: [
    "date returned", "returned", "return date", "date in", "checkin date",
    "checked in", "returned on",
  ],
  numKeys: [
    "num keys", "number of keys", "of keys", "of key", "keys", "qty",
    "quantity", "count", "copies",
  ],
  notes: ["notes", "note", "comments", "comment", "remarks"],
};

type Field = keyof typeof ALIASES;

const canon = (s: unknown): string =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const ALIAS_LOOKUP: Map<string, Field> = (() => {
  const m = new Map<string, Field>();
  for (const field of Object.keys(ALIASES) as Field[]) {
    for (const alias of ALIASES[field]) m.set(canon(alias), field);
  }
  return m;
})();

// ── merge ─────────────────────────────────────────────────────────────────────

/**
 * Combines a freshly-parsed workbook into the current snapshot instead of
 * replacing it: people are matched by full name and keys by stamp (both
 * trimmed/case-folded) so re-importing the same roster doesn't duplicate
 * rows, and assignments are matched by person+key+issued/returned dates so
 * the same issuance isn't added twice. Anything that doesn't match becomes
 * a new row, remapped onto the incoming record's own IDs where needed.
 */
export function mergeSnapshots(current: Snapshot, incoming: Snapshot): Snapshot {
  const norm = (s: string) => s.trim().toLowerCase();

  const people = [...current.people];
  const personIdMap = new Map<string, string>();
  const peopleByName = new Map(current.people.map((p) => [norm(p.fullName), p.id]));
  for (const p of incoming.people) {
    const existingId = peopleByName.get(norm(p.fullName));
    if (existingId) {
      personIdMap.set(p.id, existingId);
    } else {
      personIdMap.set(p.id, p.id);
      people.push(p);
      peopleByName.set(norm(p.fullName), p.id);
    }
  }

  const keys = [...current.keys];
  const keyIdMap = new Map<string, string>();
  const keysByStamp = new Map(current.keys.map((k) => [norm(k.keyStamp), k.id]));
  for (const k of incoming.keys) {
    const existingId = keysByStamp.get(norm(k.keyStamp));
    if (existingId) {
      keyIdMap.set(k.id, existingId);
    } else {
      keyIdMap.set(k.id, k.id);
      keys.push(k);
      keysByStamp.set(norm(k.keyStamp), k.id);
    }
  }

  const assignments = [...current.assignments];
  const seen = new Set(
    current.assignments.map((a) => `${a.personId}|${a.keyId}|${a.dateIssued}|${a.dateReturned ?? ""}`),
  );
  for (const a of incoming.assignments) {
    const personId = personIdMap.get(a.personId) ?? a.personId;
    const keyId = keyIdMap.get(a.keyId) ?? a.keyId;
    const sig = `${personId}|${keyId}|${a.dateIssued}|${a.dateReturned ?? ""}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    assignments.push({ ...a, personId, keyId });
  }

  return { people, keys, assignments };
}

// ── import ────────────────────────────────────────────────────────────────────

export interface ImportReport {
  sheetsRead: string[];
  /** Rows successfully read from each sheet, in order. */
  perSheet: { name: string; rows: number }[];
  sheetsSkipped: { name: string; reason: string }[];
  unmappedHeaders: string[];
  rowsRead: number;
  rowsSkipped: { sheet: string; row: number; reason: string }[];
  people: number;
  keys: number;
  assignments: number;
}

export async function parseWorkbook(file: File): Promise<{ snapshot: Snapshot; report: ImportReport }> {
  if (/\.xls$/i.test(file.name)) {
    throw new Error(
      "That's an old .xls file. Open it in Excel and use File → Save As → Excel Workbook (.xlsx), then import again.",
    );
  }

  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const report: ImportReport = {
    sheetsRead: [], perSheet: [], sheetsSkipped: [], unmappedHeaders: [], rowsRead: 0,
    rowsSkipped: [], people: 0, keys: 0, assignments: 0,
  };

  const snap: Snapshot = { people: [], keys: [], assignments: [] };
  const peopleByName = new Map<string, string>();
  const keysByIdentity = new Map<string, string>();
  const unmapped = new Set<string>();

  wb.eachSheet((sheet) => {
    const header = findHeaderRow(sheet);
    if (!header) {
      report.sheetsSkipped.push({
        name: sheet.name,
        reason: "no recognizable column headings found in the first 15 rows",
      });
      return;
    }
    const hasName =
      header.map.has("personName") || header.map.has("firstName") || header.map.has("lastName");
    if (!hasName || !header.map.has("keyStamp")) {
      report.sheetsSkipped.push({
        name: sheet.name,
        reason: "needs at least a name column (or First/Last name) and a key-stamp column",
      });
      return;
    }

    report.sheetsRead.push(sheet.name);
    let sheetRows = 0;
    for (const h of header.unmapped) unmapped.add(h);

    const col = (row: ExcelJS.Row, field: Field): unknown => {
      const idx = header.map.get(field);
      return idx === undefined ? undefined : row.getCell(idx).value;
    };

    for (let rowNum = header.rowNumber + 1; rowNum <= sheet.rowCount; rowNum++) {
      const row = sheet.getRow(rowNum);

      // Name may be one column or split into First/Last. When split, display as
      // "First Last".
      const single = text(col(row, "personName"));
      const first = text(col(row, "firstName"));
      const last = text(col(row, "lastName"));
      const personName = single || [first, last].filter(Boolean).join(" ").trim();
      const keyStamp = text(col(row, "keyStamp"));
      if (!personName && !keyStamp) continue; // blank spacer row

      if (!personName) {
        report.rowsSkipped.push({ sheet: sheet.name, row: rowNum, reason: "no person name" });
        continue;
      }
      // Import any row with a person, even if they have no key assignment yet.
      // Only skip if there's no person name at all (truly empty row).

      // Date issued can be empty; use epoch date as placeholder for data entry gaps.
      const dateIssued = toIsoDate(col(row, "dateIssued")) || "1900-01-01";
      const dateReturned = toIsoDate(col(row, "dateReturned"));
      if (dateReturned && dateReturned < dateIssued) {
        report.rowsSkipped.push({
          sheet: sheet.name, row: rowNum, reason: "date returned is before date issued",
        });
        continue;
      }

      // Import any stamp as-is, even if it looks odd. User can clean up data later in the UI.

      const department = text(col(row, "department")) || null;
      // Sheets are often named after the building with no building column.
      const building = text(col(row, "building")) || guessBuilding(sheet.name);
      const roomNumber = text(col(row, "roomNumber")) || null;
      const roomDescription = text(col(row, "roomDescription")) || null;

      // person — always create or reuse
      const pKey = personName.toLowerCase();
      let personId = peopleByName.get(pKey);
      if (!personId) {
        personId = newId();
        peopleByName.set(pKey, personId);
        snap.people.push({
          id: personId,
          fullName: personName,
          email: text(col(row, "email")) || null,
          employeeId: text(col(row, "employeeId")) || null,
          department,
          building,
          // Which sheet this person's row first appeared on — lets export
          // rebuild the same multi-sheet layout. Sheets literally named
          // "Returned" carry that name through too, though export never uses
          // it for routing (it always routes by dateReturned instead).
          category: sheet.name,
        });
      }

      // key + assignment — only if this row has a key stamp
      if (keyStamp) {
        // key — identity is stamp + room + building, never stamp alone, since the
        // same stamp is legitimately held by many people.
        const kKey = `${keyStamp.toLowerCase()}|${(roomNumber ?? "").toLowerCase()}|${(building ?? "").toLowerCase()}`;
        let keyId = keysByIdentity.get(kKey);
        if (!keyId) {
          keyId = newId();
          keysByIdentity.set(kKey, keyId);
          snap.keys.push({
            id: keyId, keyStamp, roomNumber, roomDescription, building, department, notes: null,
          });
        }

        snap.assignments.push({
          id: newId(),
          personId,
          keyId,
          dateIssued,
          dateReturned,
          numKeys: toCount(col(row, "numKeys")),
          notes: text(col(row, "notes")) || null,
        });
      }
      report.rowsRead++;
      sheetRows++;
    }
    report.perSheet.push({ name: sheet.name, rows: sheetRows });
  });

  if (report.sheetsRead.length === 0) {
    throw new Error(
      "No usable sheets found. Each sheet needs a header row with at least a person-name column and a key-stamp column.",
    );
  }

  // Same person + same key + same issue date twice = the same real-world event
  // recorded in two sheets. Collapse it, otherwise every record double-counts.
  const seen = new Set<string>();
  const before = snap.assignments.length;
  snap.assignments = snap.assignments.filter((a) => {
    const sig = `${a.personId}|${a.keyId}|${a.dateIssued}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
  const deduped = before - snap.assignments.length;
  if (deduped > 0) {
    report.rowsSkipped.push({
      sheet: "(all)", row: 0,
      reason: `${deduped} duplicate row${deduped === 1 ? "" : "s"} collapsed (same person, key, and issue date)`,
    });
  }

  report.unmappedHeaders = [...unmapped];
  report.people = snap.people.length;
  report.keys = snap.keys.length;
  report.assignments = snap.assignments.length;
  return { snapshot: snap, report };
}

/** Find the row that looks most like a header, within the first 15 rows. */
function findHeaderRow(sheet: ExcelJS.Worksheet) {
  let best: { rowNumber: number; map: Map<Field, number>; unmapped: string[] } | null = null;

  const limit = Math.min(sheet.rowCount, 15);
  for (let rowNumber = 1; rowNumber <= limit; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const map = new Map<Field, number>();
    const unmapped: string[] = [];

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const raw = text(cell.value);
      if (!raw) return;
      const field = ALIAS_LOOKUP.get(canon(raw));
      // First match wins, so a stray later column can't hijack a mapping.
      if (field && !map.has(field)) map.set(field, colNumber);
      else if (!field) unmapped.push(raw);
    });

    if (!best || map.size > best.map.size) best = { rowNumber, map, unmapped };
    // Two recognized columns is enough to call it a header and stop looking.
    if (map.size >= 4) break;
  }

  return best && best.map.size >= 2 ? best : null;
}

// ── cell coercion ─────────────────────────────────────────────────────────────

function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const o = v as any;
  if (o.richText) return o.richText.map((t: any) => t.text).join("").trim();
  if (o.text !== undefined) return String(o.text).trim();       // hyperlink cell
  if (o.result !== undefined) return String(o.result).trim();   // formula cell
  if (o.error) return "";
  return String(v).trim();
}

/** Excel dates arrive as Date objects, serial numbers, or free text. */
function toIsoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;

  if (v instanceof Date) return isoFromUTC(v);

  if (typeof v === "number") {
    // Excel serial: days since 1899-12-30 (the offset absorbs Excel's
    // fictitious 1900 leap day).
    if (v < 1 || v > 80000) return null;
    return isoFromUTC(new Date(Date.UTC(1899, 11, 30) + v * 86400000));
  }

  const s = text(v);
  if (!s) return null;
  if (/^(n\/?a|none|never|open|out|-|—)$/i.test(s)) return null;

  // Already ISO
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // US-style m/d/yy or m/d/yyyy — the dominant format in these spreadsheets.
  const us = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (us) {
    let [, m, d, y] = us;
    let year = Number(y);
    if (y.length === 2) year += year < 70 ? 2000 : 1900;
    const dt = new Date(Date.UTC(year, Number(m) - 1, Number(d)));
    // Reject impossible dates like 13/45/2024 rather than letting JS roll over.
    if (dt.getUTCMonth() !== Number(m) - 1 || dt.getUTCDate() !== Number(d)) return null;
    return isoFromUTC(dt);
  }

  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : isoFromUTC(parsed);
}

/** Format in UTC — using local getters here shifts dates a day west of GMT. */
const isoFromUTC = (d: Date) => d.toISOString().slice(0, 10);

function toCount(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(text(v), 10);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** "Beadle Hall Keys" → "Beadle Hall"; generic sheet names yield null. */
function guessBuilding(sheetName: string): string | null {
  const cleaned = sheetName.replace(/\b(keys?|sheet\s*\d*|data|list|master)\b/gi, "").trim();
  if (!cleaned || /^\d+$/.test(cleaned)) return null;
  return cleaned;
}

// ── export ────────────────────────────────────────────────────────────────────
// Rebuilds the same shape as the source DSU audit workbook: one sheet per
// person category (Directory, Campus Watch, CommunityCenter, GA Forms,
// Sodexo, Facilities Department) holding that category's open assignments,
// plus one Returned sheet catching every closed-out assignment regardless of
// category — matching how the original file only ever grouped ACTIVE records
// by roster.

const AUDIT_HEADERS = [
  "LastName", "FirstName", "Building ", "Department",
  "Date Issued", "Date Returned", "# of Key", "Room Description/ Number ", "Key Stamp",
];

// Column widths copied from the source workbook's largest sheet (Directory) —
// applied to every sheet for a consistent look.
const AUDIT_COL_WIDTHS = [
  17, 18, 32.7109375, 64.85546875, 12.7109375, 15.85546875, 9.5703125, 52.42578125, 22.42578125,
];

// Tab colors copied cell-for-cell from the source workbook. Returned, and any
// custom category name an import brought in, get no tab color — same as the
// source's own Returned sheet.
const AUDIT_TAB_COLORS: Record<string, { argb: string } | { theme: number; tint: number }> = {
  "Directory": { argb: "FFD3F2F2" },
  "Campus Watch": { theme: 7, tint: 0.5999938962981048 },
  "CommunityCenter": { theme: 9, tint: 0.5999938962981048 },
  "GA Forms": { theme: 2, tint: -0.0999786370433668 },
  "Sodexo": { theme: 5, tint: 0.5999938962981048 },
  "Facilities Department": { theme: 4, tint: 0.5999938962981048 },
};

const RETURNED_SHEET_NAME = "Returned";

const THIN_BLACK = { style: "thin" as const, color: { argb: "FF000000" } };
const AUDIT_CELL_BORDER = { top: THIN_BLACK, left: THIN_BLACK, bottom: THIN_BLACK, right: THIN_BLACK };

/** "First Middle Last" → { lastName: "Last", firstName: "First Middle" } —
 *  the reverse of the join importers do, so a round trip through export and
 *  back in still lines up. Best-effort only: a name that's already just a
 *  single word has no last name to split off. */
function splitPersonName(fullName: string): { lastName: string; firstName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { lastName: "", firstName: "" };
  if (parts.length === 1) return { lastName: parts[0], firstName: "" };
  return { lastName: parts[parts.length - 1], firstName: parts.slice(0, -1).join(" ") };
}

/** Reassembles the source workbook's single combined room column. */
function combinedRoom(roomNumber: string, roomDescription: string): string {
  const rn = roomNumber.trim();
  const rd = roomDescription.trim();
  if (rn && rd) return rn === rd ? rd : `${rd} ${rn}`;
  return rd || rn;
}

function addAuditSheet(wb: ExcelJS.Workbook, name: string, records: KeyRecord[]): void {
  const sheet = wb.addWorksheet(name);
  sheet.addRow(AUDIT_HEADERS);

  const sorted = [...records].sort((a, b) => {
    const an = splitPersonName(a.personName);
    const bn = splitPersonName(b.personName);
    return an.lastName.localeCompare(bn.lastName) || an.firstName.localeCompare(bn.firstName);
  });
  for (const r of sorted) {
    const { lastName, firstName } = splitPersonName(r.personName);
    sheet.addRow([
      lastName,
      firstName,
      r.building,
      r.department,
      dateCell(r.dateIssued),
      dateCell(r.dateReturned),
      r.numKeys,
      combinedRoom(r.roomNumber, r.roomDescription),
      r.keyStamp,
    ]);
  }

  sheet.getRow(1).height = 15.75;
  AUDIT_COL_WIDTHS.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });
  for (let rowNum = 1; rowNum <= sorted.length + 1; rowNum++) {
    const row = sheet.getRow(rowNum);
    for (let col = 1; col <= AUDIT_HEADERS.length; col++) {
      const cell = row.getCell(col);
      cell.border = AUDIT_CELL_BORDER;
      cell.font = rowNum === 1
        ? { bold: true, italic: true, size: 12, name: "Calibri" }
        : { size: 11, name: "Calibri" };
    }
  }
  sheet.getColumn(5).numFmt = "mm-dd-yy"; // Date Issued
  sheet.getColumn(6).numFmt = "mm-dd-yy"; // Date Returned
  sheet.getColumn(9).numFmt = "@";        // Key Stamp — kept as text (e.g. "404.16")

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.pageSetup = {
    orientation: "landscape",
    margins: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    fitToWidth: 1,
    fitToHeight: 1,
  };
  const tabColor = AUDIT_TAB_COLORS[name];
  if (tabColor) sheet.properties.tabColor = tabColor;
}

/**
 * Writes a workbook shaped exactly like the source DSU audit spreadsheet:
 * Directory / Campus Watch / CommunityCenter / GA Forms / Sodexo / Facilities
 * Department / Returned, each with the same LastName…Key Stamp columns,
 * header styling, borders, frozen header row, and tab colors.
 */
export async function buildWorkbook(snap: Snapshot): Promise<Blob> {
  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  wb.created = new Date();

  const records = toRecords(snap);
  const active = records.filter((r) => r.isActive);
  const returned = records.filter((r) => !r.isActive);

  const byCategory = new Map<string, KeyRecord[]>();
  for (const r of active) {
    // An open (still-active) record can't really belong on the Returned
    // sheet — that name is reserved for the closed-out bucket below. Some
    // real source data has rows imported from a sheet literally named
    // "Returned" but with a blank Date Returned cell, which would otherwise
    // collide with it; fall back to Directory instead.
    let cat = r.category || DEFAULT_PERSON_CATEGORY;
    if (cat === RETURNED_SHEET_NAME) cat = DEFAULT_PERSON_CATEGORY;
    const list = byCategory.get(cat);
    if (list) list.push(r); else byCategory.set(cat, [r]);
  }

  // The six known categories always get a sheet, even empty, so the export
  // always has the same shape as the source workbook.
  for (const cat of PERSON_CATEGORIES) {
    addAuditSheet(wb, cat, byCategory.get(cat) ?? []);
    byCategory.delete(cat);
  }
  // Anything left over is a custom category name (from a hand-edited import)
  // — only worth a sheet if it actually has rows.
  for (const [cat, recs] of byCategory) {
    addAuditSheet(wb, cat, recs);
  }

  addAuditSheet(wb, RETURNED_SHEET_NAME, returned);

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Real Date so Excel sorts/filters it as a date, not a string. */
function dateCell(iso: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function downloadWorkbook(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

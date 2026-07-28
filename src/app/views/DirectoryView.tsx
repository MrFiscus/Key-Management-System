import { useMemo, useState } from "react";
import {
  ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp, CornerDownLeft,
  Pencil, Plus, Trash2, X, User, Briefcase, Building2, KeyRound, Tags, Settings2,
} from "lucide-react";
import { initialsOf, type KeyRecord, type Person } from "../../lib/types";
import { DSU, font, formatDate, headerFill, headerFillActive, radius, shadow } from "../theme";
import {
  Avatar, Button, EmptyState, PageSearchBar, SelectInput, Stamp,
} from "../components/primitives";
import type { RowActions } from "./KeyTable";

/** Shared row hover tint. */
const HOVER_ROW = "#f0f7fc";

/** Symmetric grid columns for the per-person expanded keys list. */
const DIRECTORY_KEYS_COLS = "100px minmax(0,1fr) minmax(0,1fr) 96px 108px";

/**
 * One row per person, expandable to show their keys in place. A row-per-person
 * list (rather than a stack of expanded cards) is what keeps this usable at a
 * few hundred staff — you can scan ~20 people per screen and expand only the
 * one you care about.
 */

type SortCol = "name" | "department" | "building" | "keys";
type SortDir = "asc" | "desc";

interface Row {
  person: Person;
  records: KeyRecord[];
}

export function DirectoryView({
  people, records, actions, onAddPerson, onEditPerson, onDeletePerson, onSelectPerson, onSelectKey,
  onSelectBuilding, onSelectDepartment,
}: {
  people: Person[];
  /** Active records only — returned keys live on the Returned tab. */
  records: KeyRecord[];
  actions: RowActions;
  onAddPerson: () => void;
  onEditPerson: (p: Person) => void;
  onDeletePerson: (p: Person) => void;
  onSelectPerson: (personId: string) => void;
  onSelectKey: (keyId: string) => void;
  onSelectBuilding?: (name: string) => void;
  onSelectDepartment?: (name: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterBuilding, setFilterBuilding] = useState("");
  const [withKeysOnly, setWithKeysOnly] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const departments = useMemo(
    () => [...new Set(people.map((p) => p.department).filter(Boolean) as string[])].sort(),
    [people],
  );
  const buildings = useMemo(
    () => [...new Set(people.map((p) => p.building).filter(Boolean) as string[])].sort(),
    [people],
  );

  const rows: Row[] = useMemo(() => {
    const byPerson = new Map<string, KeyRecord[]>();
    for (const r of records) {
      const list = byPerson.get(r.personId);
      if (list) list.push(r);
      else byPerson.set(r.personId, [r]);
    }

    const q = search.trim().toLowerCase();
    const result = people
      .map((person) => ({ person, records: byPerson.get(person.id) ?? [] }))
      .filter(({ person, records: rs }) => {
        if (filterDept && person.department !== filterDept) return false;
        if (filterBuilding && person.building !== filterBuilding) return false;
        if (withKeysOnly && rs.length === 0) return false;
        if (!q) return true;
        // Searching a stamp finds whoever holds it, which is a common lookup.
        return (
          person.fullName.toLowerCase().includes(q) ||
          (person.email ?? "").toLowerCase().includes(q) ||
          (person.department ?? "").toLowerCase().includes(q) ||
          (person.building ?? "").toLowerCase().includes(q) ||
          rs.some((r) => r.keyStamp.toLowerCase().includes(q))
        );
      });

    const dir = sortDir === "asc" ? 1 : -1;
    return result.sort((a, b) => {
      switch (sortCol) {
        case "keys":
          // Ties fall back to name so the order stays stable and predictable.
          return (a.records.length - b.records.length) * dir
            || a.person.fullName.localeCompare(b.person.fullName);
        case "department":
          return (a.person.department ?? "").localeCompare(b.person.department ?? "") * dir
            || a.person.fullName.localeCompare(b.person.fullName);
        case "building":
          return (a.person.building ?? "").localeCompare(b.person.building ?? "") * dir
            || a.person.fullName.localeCompare(b.person.fullName);
        default:
          return a.person.fullName.localeCompare(b.person.fullName) * dir;
      }
    });
  }, [people, records, search, filterDept, filterBuilding, withKeysOnly, sortCol, sortDir]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sortBy = (col: SortCol) => {
    // Counts read best highest-first; names lowest-first.
    setSortDir((d) => (col === sortCol ? (d === "asc" ? "desc" : "asc") : col === "keys" ? "desc" : "asc"));
    setSortCol(col);
  };

  const hasFilter = Boolean(search || filterDept || filterBuilding || withKeysOnly);
  const totalKeys = rows.reduce((sum, r) => sum + r.records.length, 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b flex-wrap" style={{ borderColor: DSU.lightBorder }}>
        <h1 className="text-[26px] font-semibold shrink-0" style={{ fontFamily: font.display, color: DSU.navy }}>
          Key Holder Directory
        </h1>

        <div className="flex items-center gap-2 flex-wrap">
          <PageSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by name, dept, building, or stamp…"
          />
          <SelectInput
            value={filterBuilding}
            onChange={(e) => setFilterBuilding(e.target.value)}
            aria-label="Building"
          >
            <option value="">All buildings</option>
            {buildings.map((b) => <option key={b}>{b}</option>)}
          </SelectInput>
          <SelectInput
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            aria-label="Department"
          >
            <option value="">All departments</option>
            {departments.map((d) => <option key={d}>{d}</option>)}
          </SelectInput>

          <label
            className="flex items-center gap-1.5 text-[13px] cursor-pointer select-none px-2.5 py-1.5 rounded-md border"
            style={{
              color: withKeysOnly ? DSU.navy : DSU.midGray,
              borderColor: withKeysOnly ? DSU.trojan : DSU.lightBorder,
              background: withKeysOnly ? "#eaf6fc" : "#fff",
            }}
          >
            <input
              type="checkbox"
              checked={withKeysOnly}
              onChange={(e) => setWithKeysOnly(e.target.checked)}
              className="accent-[#00A9E0]"
            />
            Holding keys
          </label>

          {hasFilter && (
            <Button
              onClick={() => {
                setSearch(""); setFilterDept(""); setFilterBuilding(""); setWithKeysOnly(false);
              }}
              style={{ color: DSU.trojan, borderColor: DSU.trojan }}
            >
              <X size={11} /> Clear
            </Button>
          )}
          <Button variant="primary" onClick={onAddPerson}>
            <Plus size={12} /> Add Person
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          message={
            hasFilter
              ? "No people match these filters."
              : "Nobody in the directory yet. Add a person or import your spreadsheet."
          }
        />
      ) : (
        <>
          <div
            className="overflow-x-auto border rounded"
            style={{ borderColor: DSU.lightBorder, boxShadow: shadow.md, borderRadius: radius.lg }}
          >
            <table className="w-full border-collapse text-[13px]" style={{ color: DSU.darkGray }}>
              <thead>
                <tr>
                  <th style={{ background: headerFill, width: 32 }} aria-label="Expand" />
                  <Th label="Person" col="name" sortCol={sortCol} sortDir={sortDir} onSort={sortBy} icon={<User size={12} />} />
                  <Th label="Department" col="department" sortCol={sortCol} sortDir={sortDir} onSort={sortBy} icon={<Briefcase size={12} />} />
                  <Th label="Building" col="building" sortCol={sortCol} sortDir={sortDir} onSort={sortBy} icon={<Building2 size={12} />} />
                  <Th label="Keys" col="keys" sortCol={sortCol} sortDir={sortDir} onSort={sortBy} align="center" icon={<KeyRound size={12} />} />
                  <th
                    className="px-3 py-2 text-[12px] font-semibold text-left"
                    style={{ background: headerFill, color: "rgba(255,255,255,0.88)" }}
                  >
                    <span className="inline-flex items-center gap-1.5" style={{ color: DSU.trojan }}>
                      <Tags size={12} />
                      <span style={{ color: "rgba(255,255,255,0.88)" }}>Holding</span>
                    </span>
                  </th>
                  <th
                    className="px-3 py-2 text-[12px] font-semibold text-right"
                    style={{ background: headerFill, color: "rgba(255,255,255,0.88)" }}
                  >
                    <span className="inline-flex items-center justify-end gap-1.5" style={{ color: DSU.trojan }}>
                      <Settings2 size={12} />
                      <span style={{ color: "rgba(255,255,255,0.88)" }}>Actions</span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ person, records: rs }, i) => (
                  <PersonRows
                    key={person.id}
                    person={person}
                    records={rs}
                    isOpen={expanded.has(person.id)}
                    index={i}
                    base={i % 2 === 0 ? "#ffffff" : DSU.zebra}
                    onToggle={() => toggle(person.id)}
                    onOpen={() => onSelectPerson(person.id)}
                    onEdit={() => onEditPerson(person)}
                    onDelete={() => onDeletePerson(person)}
                    onSelectKey={onSelectKey}
                    onSelectBuilding={onSelectBuilding}
                    onSelectDepartment={onSelectDepartment}
                    actions={actions}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] mt-2" style={{ color: DSU.midGray }}>
            {totalKeys} key{totalKeys === 1 ? "" : "s"} held across {rows.length} listed{" "}
            {rows.length === 1 ? "person" : "people"} · click the arrow to see which
          </p>
        </>
      )}
    </div>
  );
}

// ── header cell ───────────────────────────────────────────────────────────────

function Th({
  label, col, sortCol, sortDir, onSort, align = "left", icon,
}: {
  label: string; col: SortCol; sortCol: SortCol; sortDir: SortDir;
  onSort: (c: SortCol) => void; align?: "left" | "center"; icon?: React.ReactNode;
}) {
  const active = col === sortCol;
  return (
    <th
      onClick={() => onSort(col)}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      className="px-3 py-2 text-[12px] font-semibold whitespace-nowrap cursor-pointer select-none transition-colors"
      style={{
        background: active ? headerFillActive : headerFill,
        color: active ? "#fff" : "rgba(255,255,255,0.88)",
        textAlign: align,
      }}
    >
      <span className="inline-flex items-center gap-1.5">
        {icon && <span style={{ color: DSU.trojan }}>{icon}</span>}
        <span className="inline-flex items-center gap-0.5">
          {label}
          {active ? (
            sortDir === "asc"
              ? <ChevronUp size={11} style={{ color: DSU.trojan }} />
              : <ChevronDown size={11} style={{ color: DSU.trojan }} />
          ) : (
            <ChevronsUpDown size={11} style={{ opacity: 0.4 }} />
          )}
        </span>
      </span>
    </th>
  );
}

// ── one person: summary row plus an optional expanded detail row ──────────────

function PersonRows({
  person, records, isOpen, index, base, onToggle, onOpen, onEdit, onDelete, onSelectKey,
  onSelectBuilding, onSelectDepartment, actions,
}: {
  person: Person;
  records: KeyRecord[];
  isOpen: boolean;
  index: number;
  base: string;
  onToggle: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSelectKey: (keyId: string) => void;
  onSelectBuilding?: (name: string) => void;
  onSelectDepartment?: (name: string) => void;
  actions: RowActions;
}) {
  const ordered = useMemo(
    () => [...records].sort((a, b) => b.dateIssued.localeCompare(a.dateIssued)),
    [records],
  );

  const showCard = isOpen && ordered.length > 0;

  return (
    <>
      <tr
        className="border-b group transition-colors dsu-row-in"
        style={{
          borderColor: "#eaebec",
          background: showCard ? "#ffffff" : base,
          animationDelay: `${Math.min(index, 14) * 16}ms`,
        }}
        onMouseEnter={(e) => {
          if (showCard) return;
          e.currentTarget.style.background = HOVER_ROW;
          e.currentTarget.style.boxShadow = `inset 3px 0 0 ${DSU.trojan}`;
        }}
        onMouseLeave={(e) => {
          if (showCard) return;
          e.currentTarget.style.background = base;
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Toggle stays in this exact cell whichever state we're in, so the
            button never jumps when the row expands or collapses. */}
        <td
          className={`pl-2 align-top ${showCard ? "pt-[13px]" : "pt-1.5"}`}
          style={showCard ? { boxShadow: `inset 3px 0 0 ${DSU.trojan}` } : undefined}
        >
          <button
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-label={isOpen ? `Collapse ${person.fullName}` : `Expand ${person.fullName}`}
            disabled={records.length === 0}
            className="p-1 rounded hover:bg-black/[0.07] disabled:opacity-25 disabled:cursor-default"
            style={{ color: DSU.midGray }}
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>

        {showCard ? (
          <td colSpan={6} className="py-2.5 pr-8">
            <div className="overflow-hidden bg-white">
              {/* ── Person header ── the only place this person's identity
                  shows while expanded, since the rest of this row's columns
                  are hidden. Click it (like the chevron) to collapse. */}
              <div
                onClick={onToggle}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
                aria-expanded={isOpen}
                aria-label={`Collapse ${person.fullName}`}
                className="w-full flex items-center gap-3 px-4 py-3 border-b text-left transition-colors hover:bg-black/[0.02] cursor-pointer"
                style={{ borderColor: "#eef1f3" }}
              >
                <Avatar initials={initialsOf(person.fullName)} size={38} />
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold truncate" style={{ color: DSU.navy }}>
                    {person.fullName}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[12px] flex-wrap" style={{ color: DSU.midGray }}>
                    <span className="inline-flex items-center gap-1">
                      <Building2 size={11} style={{ color: DSU.trojan }} />
                      {person.building ? (
                        onSelectBuilding ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); onSelectBuilding(person.building!); }}
                            className="hover:underline"
                            style={{ font: "inherit" }}
                          >
                            {person.building}
                          </button>
                        ) : person.building
                      ) : <Dash />}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Briefcase size={11} style={{ color: DSU.trojan }} />
                      {person.department ? (
                        onSelectDepartment ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); onSelectDepartment(person.department!); }}
                            className="hover:underline"
                            style={{ font: "inherit" }}
                          >
                            {person.department}
                          </button>
                        ) : person.department
                      ) : <Dash />}
                    </span>
                  </div>
                </div>
              </div>

                <div
                  className="grid px-4 py-2 text-[11px] font-semibold"
                  style={{
                    gridTemplateColumns: DIRECTORY_KEYS_COLS, gap: 14,
                    background: "color-mix(in srgb, #00A9E0 7%, white)", color: DSU.midGray,
                  }}
                >
                  <div>Key</div>
                  <div>Room</div>
                  <div>Dept</div>
                  <div>Issued</div>
                  <div className="text-right">Actions</div>
                </div>
                {ordered.map((r, i) => {
                  const room = r.roomNumber || r.roomDescription
                    ? [r.roomNumber, r.roomDescription].filter(Boolean).join(" · ")
                    : null;
                  const rowBg = i % 2 === 0 ? "#ffffff" : "#f7f9fa";
                  return (
                    <div
                      key={r.assignmentId}
                      className="group/key grid items-center px-4 py-2 transition-colors"
                      style={{ gridTemplateColumns: DIRECTORY_KEYS_COLS, gap: 14, background: rowBg }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = HOVER_ROW;
                        e.currentTarget.style.boxShadow = `inset 3px 0 0 ${DSU.trojan}`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = rowBg;
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <button
                          onClick={() => onSelectKey(r.keyId)}
                          title={`View key ${r.keyStamp}`}
                          className="font-mono font-bold rounded-md px-2 py-1 transition-colors shrink-0"
                          style={{ fontSize: 12.5, color: "#fff", background: DSU.trojan }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = DSU.trojanDark)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = DSU.trojan)}
                        >
                          {r.keyStamp}
                        </button>
                        {r.numKeys > 1 && (
                          <span
                            className="text-[10px] font-semibold px-1 py-px rounded-sm shrink-0"
                            style={{ background: "#e8eaec", color: DSU.midGray }}
                            title={`${r.numKeys} copies`}
                          >
                            ×{r.numKeys}
                          </span>
                        )}
                      </div>

                      <div className="text-[13px] font-medium truncate min-w-0" style={{ color: DSU.darkGray }} title={room ?? undefined}>
                        {room ? (
                          <button onClick={() => onSelectKey(r.keyId)} className="hover:underline text-left" style={{ font: "inherit" }}>
                            {room}
                          </button>
                        ) : <Dash />}
                      </div>
                      <div className="text-[13px] truncate min-w-0" style={{ color: DSU.darkGray }} title={r.department || undefined}>
                        {r.department ? (
                          onSelectDepartment ? (
                            <button onClick={() => onSelectDepartment(r.department)} className="hover:underline text-left" style={{ font: "inherit" }}>
                              {r.department}
                            </button>
                          ) : r.department
                        ) : <Dash />}
                      </div>
                      <div className="text-[11.5px] tabular truncate" style={{ color: DSU.midGray }}>
                        {formatDate(r.dateIssued)}
                      </div>

                      <div className="flex items-center justify-end gap-1 opacity-40 group-hover/key:opacity-100 transition-opacity">
                        <button
                          onClick={() => actions.onReturn(r)}
                          title="Mark returned" aria-label="Mark returned"
                          className="p-1.5 rounded-lg hover:bg-black/[0.06]"
                          style={{ color: DSU.navy }}
                        >
                          <CornerDownLeft size={14} />
                        </button>
                        <button
                          onClick={() => actions.onEdit(r)}
                          title="Edit" aria-label="Edit"
                          className="p-1.5 rounded-lg hover:bg-black/[0.06]"
                          style={{ color: DSU.midGray }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => actions.onDelete(r)}
                          title="Delete" aria-label="Delete"
                          className="p-1.5 rounded-lg hover:bg-black/[0.06]"
                          style={{ color: DSU.danger }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </td>
        ) : (
          <>
            <td className="px-3 py-1.5 whitespace-nowrap">
              <button
                onClick={onOpen}
                className="inline-flex items-center gap-2 text-left hover:underline font-medium"
                style={{ color: DSU.navy }}
                title={`View ${person.fullName}`}
              >
                <Avatar initials={initialsOf(person.fullName)} size={26} />
                {person.fullName}
              </button>
            </td>

            <td className="px-3 py-1.5 whitespace-nowrap">
              {person.department ? (
                onSelectDepartment ? (
                  <button onClick={() => onSelectDepartment(person.department!)} className="hover:underline text-left" style={{ font: "inherit" }}>
                    {person.department}
                  </button>
                ) : person.department
              ) : <Dash />}
            </td>
            <td className="px-3 py-1.5 whitespace-nowrap">
              {person.building ? (
                onSelectBuilding ? (
                  <button onClick={() => onSelectBuilding(person.building!)} className="hover:underline text-left" style={{ font: "inherit" }}>
                    {person.building}
                  </button>
                ) : person.building
              ) : <Dash />}
            </td>

            <td className="px-3 py-1.5 text-center">
              {records.length > 0 ? (
                <span
                  className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-sm"
                  style={{ background: "#daf0fa", color: "#006a96", border: "1px solid #a8ddf4" }}
                >
                  {records.length}
                </span>
              ) : (
                <span className="text-[11px]" style={{ color: "#b0b2b5" }}>—</span>
              )}
            </td>

            {/* Stamps inline so "what does she have?" is answered without expanding. */}
            <td className="px-3 py-1.5">
              {ordered.length === 0 ? (
                <span className="text-[11px]" style={{ color: "#b0b2b5" }}>no keys out</span>
              ) : (
                <span className="flex items-center gap-1.5 flex-wrap">
                  {ordered.slice(0, 4).map((r) => (
                    <Stamp key={r.assignmentId} stamp={r.keyStamp} onClick={() => onSelectKey(r.keyId)} size={11} />
                  ))}
                  {ordered.length > 4 && (
                    <button onClick={onToggle} className="text-[11px] hover:underline" style={{ color: DSU.midGray }}>
                      +{ordered.length - 4} more
                    </button>
                  )}
                </span>
              )}
            </td>

            <td className="px-3 py-1.5">
              <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  onClick={onEdit}
                  title="Edit person" aria-label="Edit person"
                  className="p-1 rounded hover:bg-black/[0.07]"
                  style={{ color: DSU.midGray }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={onDelete}
                  title="Delete person" aria-label="Delete person"
                  className="p-1 rounded hover:bg-black/[0.07]"
                  style={{ color: DSU.danger }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </td>
          </>
        )}
      </tr>
    </>
  );
}

const Dash = () => <span style={{ color: "#b0b2b5" }}>—</span>;

import { ChevronUp, ChevronDown, ChevronsUpDown, Pencil, Trash2, CornerDownLeft } from "lucide-react";
import type { KeyRecord } from "../../lib/types";
import { DSU, formatDate, headerFill, headerFillActive, radius, shadow } from "../theme";
import { EmptyState, Pill, Stamp } from "../components/primitives";

/** Shared row hover tint. */
const HOVER_ROW = "#f0f7fc";


export type SortCol =
  | "personName" | "roomDescription" | "roomNumber" | "keyStamp"
  | "building" | "department" | "dateIssued" | "dateReturned" | "numKeys";

export type SortDir = "asc" | "desc";

export function sortRecords(records: KeyRecord[], col: SortCol, dir: SortDir): KeyRecord[] {
  return [...records].sort((a, b) => {
    const av = a[col] ?? "";
    const bv = b[col] ?? "";
    // Numeric-aware so "Rm 10" sorts after "Rm 9", and blanks sink to the end.
    if (av === "" && bv !== "") return 1;
    if (bv === "" && av !== "") return -1;
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return dir === "asc" ? cmp : -cmp;
  });
}

function Th({
  label, col, sortCol, sortDir, onSort, align = "left",
}: {
  label: string; col: SortCol; sortCol: SortCol; sortDir: SortDir;
  onSort: (c: SortCol) => void; align?: "left" | "right" | "center";
}) {
  const active = col === sortCol;
  return (
    <th
      onClick={() => onSort(col)}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      className="px-3 py-2 text-[12px] font-semibold whitespace-nowrap cursor-pointer select-none transition-colors"
      style={{
        background: active ? headerFillActive : headerFill,
        color: active ? "#ffffff" : "rgba(255,255,255,0.88)",
        textAlign: align,
      }}
    >
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
    </th>
  );
}

export interface RowActions {
  onEdit: (record: KeyRecord) => void;
  onDelete: (record: KeyRecord) => void;
  onReturn: (record: KeyRecord) => void;
}

export function KeyTable({
  records, sortCol, sortDir, onSort, showPerson = false, actions, onSelectPerson, onSelectKey,
  emptyMessage = "No matching records found.",
}: {
  records: KeyRecord[];
  sortCol: SortCol;
  sortDir: SortDir;
  onSort: (c: SortCol) => void;
  showPerson?: boolean;
  actions?: RowActions;
  onSelectPerson?: (personId: string) => void;
  onSelectKey?: (keyId: string) => void;
  emptyMessage?: string;
}) {
  if (records.length === 0) return <EmptyState message={emptyMessage} />;

  return (
    <div
      className="overflow-x-auto border rounded"
      style={{ borderColor: DSU.lightBorder, boxShadow: shadow.md, borderRadius: radius.lg }}
    >
      <table className="w-full border-collapse text-[13px]" style={{ color: DSU.darkGray }}>
        <thead>
          <tr>
            {showPerson && <Th label="Person" col="personName" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />}
            <Th label="Room Description" col="roomDescription" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <Th label="Room No." col="roomNumber" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <Th label="Key Stamp" col="keyStamp" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <Th label="Building" col="building" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <Th label="Department" col="department" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <Th label="Date Issued" col="dateIssued" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <Th label="Date Returned" col="dateReturned" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <Th label="# Keys" col="numKeys" sortCol={sortCol} sortDir={sortDir} onSort={onSort} align="center" />
            <th className="px-3 py-2 text-[12px] font-semibold text-left" style={{ background: headerFill, color: "rgba(255,255,255,0.88)" }}>
              Status
            </th>
            {actions && (
              <th className="px-3 py-2 text-[12px] font-semibold text-right" style={{ background: headerFill, color: "rgba(255,255,255,0.88)" }}>
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => {
            const base = i % 2 === 0 ? "#ffffff" : DSU.zebra;
            return (
              <tr
                key={r.assignmentId}
                className="border-b transition-colors group dsu-row-in"
                style={{ borderColor: "#eaebec", background: base, animationDelay: `${Math.min(i, 14) * 16}ms` }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = HOVER_ROW;
                  e.currentTarget.style.boxShadow = `inset 3px 0 0 ${DSU.trojan}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = base;
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {showPerson && (
                  <td className="px-3 py-2 whitespace-nowrap font-medium">
                    {onSelectPerson ? (
                      <button
                        onClick={() => onSelectPerson(r.personId)}
                        className="hover:underline text-left"
                        style={{ color: DSU.navy }}
                        title={`View ${r.personName}`}
                      >
                        {r.personName}
                      </button>
                    ) : (
                      r.personName
                    )}
                  </td>
                )}
                <td className="px-3 py-2">{r.roomDescription || <Dash />}</td>
                <td className="px-3 py-2 font-mono text-[12px]">{r.roomNumber || <Dash />}</td>
                <td className="px-3 py-2">
                  <Stamp
                    stamp={r.keyStamp}
                    onClick={onSelectKey ? () => onSelectKey(r.keyId) : undefined}
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{r.building || <Dash />}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.department || <Dash />}</td>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-[12px] tabular">{formatDate(r.dateIssued)}</td>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-[12px] tabular">
                  {r.dateReturned ? formatDate(r.dateReturned) : <Dash />}
                </td>
                <td className="px-3 py-2 text-center">{r.numKeys}</td>
                <td className="px-3 py-2"><Pill active={r.isActive} /></td>
                {actions && (
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                      {r.isActive && (
                        <IconBtn
                          title="Mark returned"
                          onClick={() => actions.onReturn(r)}
                          color={DSU.navy}
                        >
                          <CornerDownLeft size={13} />
                        </IconBtn>
                      )}
                      <IconBtn title="Edit" onClick={() => actions.onEdit(r)} color={DSU.midGray}>
                        <Pencil size={13} />
                      </IconBtn>
                      <IconBtn title="Delete" onClick={() => actions.onDelete(r)} color={DSU.danger}>
                        <Trash2 size={13} />
                      </IconBtn>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const Dash = () => <span style={{ color: "#b0b2b5" }}>—</span>;

function IconBtn({
  title, onClick, color, children,
}: {
  title: string; onClick: () => void; color: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="p-1 rounded transition-colors hover:bg-black/[0.07]"
      style={{ color }}
    >
      {children}
    </button>
  );
}

import { useMemo } from "react";
import { ArrowLeft, Key, Pencil, Plus, Trash2, Mail, IdCard, ChevronRight, CornerDownLeft } from "lucide-react";
import { initialsOf, type KeyRecord, type Person } from "../../lib/types";
import { DSU, formatDate, radius, font, shadow } from "../theme";
import { Avatar, Button, SectionHeader, Stamp } from "../components/primitives";
import type { RowActions } from "./KeyTable";

/** Shared row hover tint. */
const HOVER_ROW = "#f0f7fc";


/**
 * Everything about one person: who they are, what they currently hold, and the
 * full history of what they've had before. Reached by clicking a name anywhere
 * in the app.
 */
export function PersonView({
  person, records, actions, onBack, backLabel, onEdit, onDelete, onIssue, onSelectKey,
}: {
  person: Person;
  /** All records for this person, active and returned. */
  records: KeyRecord[];
  actions: RowActions;
  onBack: () => void;
  backLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  onIssue: () => void;
  onSelectKey: (keyId: string) => void;
}) {
  const active = useMemo(
    () => records.filter((r) => r.isActive).sort((a, b) => b.dateIssued.localeCompare(a.dateIssued)),
    [records],
  );
  const returned = useMemo(
    () =>
      records
        .filter((r) => !r.isActive)
        // Most recently returned first — the tail end of their history.
        .sort((a, b) => (b.dateReturned ?? "").localeCompare(a.dateReturned ?? "")),
    [records],
  );

  const copiesOut = active.reduce((sum, r) => sum + r.numKeys, 0);
  const buildings = [...new Set(active.map((r) => r.building).filter(Boolean))];

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] mb-3 transition-colors hover:underline"
        style={{ color: DSU.trojan }}
      >
        <ArrowLeft size={13} /> Back to {backLabel}
      </button>

      {/* ── Identity card ── */}
      <div
        className="bg-white rounded p-5 mb-4 flex items-start gap-4 flex-wrap"
        style={{ boxShadow: shadow.md, borderRadius: radius.lg }}
      >
        <Avatar initials={initialsOf(person.fullName)} size={64} />

        <div className="flex-1 min-w-[220px]">
          <h1 className="text-[26px] font-semibold leading-tight" style={{ fontFamily: font.display, color: DSU.navy }}>
            {person.fullName}
          </h1>
          <div className="flex items-center gap-1 mt-1 text-[13px] flex-wrap" style={{ color: DSU.darkGray }}>
            {person.department || "—"}
            <ChevronRight size={12} style={{ color: DSU.midGray }} />
            {person.building || "—"}
          </div>
          <div className="flex items-center gap-4 mt-2 text-[12px] flex-wrap" style={{ color: DSU.midGray }}>
            {person.email && (
              <a href={`mailto:${person.email}`} className="inline-flex items-center gap-1 hover:underline">
                <Mail size={11} /> {person.email}
              </a>
            )}
            {person.employeeId && (
              <span className="inline-flex items-center gap-1">
                <IdCard size={11} /> {person.employeeId}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="primary" onClick={onIssue}><Plus size={12} /> Issue Key</Button>
          <Button onClick={onEdit}><Pencil size={12} /> Edit</Button>
          <Button variant="danger" onClick={onDelete}><Trash2 size={12} /></Button>
        </div>
      </div>

      {/* ── At a glance ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Keys Held" value={active.length} sub={`${copiesOut} physical cop${copiesOut === 1 ? "y" : "ies"}`} accent />
        <Stat label="Buildings" value={buildings.length} sub={buildings.join(", ") || "none"} />
        <Stat label="Previously Returned" value={returned.length} sub="in history" />
        <Stat
          label="Longest Held"
          value={active.length > 0 ? daysSince(active[active.length - 1].dateIssued) : 0}
          sub={active.length > 0 ? `days · ${active[active.length - 1].keyStamp}` : "no keys out"}
        />
      </div>

      {/* ── Currently held ── */}
      <SectionHeader title="Currently Held" count={active.length} noun="key" />
      {active.length === 0 ? (
        <Empty>No keys are currently checked out to {person.fullName}.</Empty>
      ) : (
        <HistoryTable records={active} actions={actions} onSelectKey={onSelectKey} showReturned={false} />
      )}

      {/* ── History ── */}
      <div className="mt-6">
        <SectionHeader title="Key History" count={returned.length} noun="returned key" />
        {returned.length === 0 ? (
          <Empty>No returned keys on record.</Empty>
        ) : (
          <HistoryTable records={returned} actions={actions} onSelectKey={onSelectKey} showReturned />
        )}
      </div>
    </div>
  );
}

// ── pieces ────────────────────────────────────────────────────────────────────

function Stat({ label, value, sub, accent }: { label: string; value: number; sub: string; accent?: boolean }) {
  return (
    <div
      className="p-4 transition-shadow hover:shadow-md"
      style={{
        background: "#ffffff",
        borderLeft: `3px solid ${accent ? DSU.trojan : "#d3d8dc"}`,
        borderRadius: radius.lg,
        boxShadow: shadow.sm,
      }}
    >
      <div className="text-[26px] font-bold leading-none" style={{ color: accent ? DSU.trojan : DSU.navy }}>
        {value}
      </div>
      <div className="text-[12px] font-medium mt-0.5" style={{ color: DSU.darkGray }}>{label}</div>
      <div className="text-[11px] mt-0.5 truncate" style={{ color: DSU.midGray }} title={sub}>{sub}</div>
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div
    className="border px-4 py-5 text-[13px]"
    style={{
      borderColor: DSU.lightBorder,
      color: DSU.midGray,
      background: "#fcfdfe",
      borderStyle: "dashed",
      borderRadius: radius.lg,
    }}
  >
    {children}
  </div>
);

function HistoryTable({
  records, actions, onSelectKey, showReturned,
}: {
  records: KeyRecord[];
  actions: RowActions;
  onSelectKey: (keyId: string) => void;
  showReturned: boolean;
}) {
  return (
    <div
      className="overflow-x-auto border rounded bg-white"
      style={{ borderColor: DSU.lightBorder, boxShadow: shadow.md, borderRadius: radius.lg }}
    >
      <table className="w-full border-collapse text-[13px]" style={{ color: DSU.darkGray }}>
        <thead>
          <tr style={{ background: "#f5f8fa", borderBottom: `1px solid ${DSU.lightBorder}` }}>
            {["Key", "Room", "Building", "Issued"].map((h) => (
              <th key={h} className="px-3 py-1.5 text-left font-semibold text-[11px]" style={{ color: DSU.midGray }}>{h}</th>
            ))}
            {showReturned && (
              <>
                <th className="px-3 py-1.5 text-left font-semibold text-[11px]" style={{ color: DSU.midGray }}>Returned</th>
                <th className="px-3 py-1.5 text-right font-semibold text-[11px]" style={{ color: DSU.midGray }}>Held</th>
              </>
            )}
            <th className="px-3 py-1.5 text-right font-semibold text-[11px]" style={{ color: DSU.midGray }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => {
            const base = i % 2 === 0 ? "#ffffff" : DSU.zebra;
            return (
              <tr
                key={r.assignmentId}
                className="border-b group"
                style={{ borderColor: "#eaebec", background: base }}
                onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_ROW)}
                onMouseLeave={(e) => (e.currentTarget.style.background = base)}
              >
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <Stamp stamp={r.keyStamp} onClick={() => onSelectKey(r.keyId)} />
                  {r.numKeys > 1 && (
                    <span
                      className="ml-1.5 text-[10px] font-semibold px-1 py-px rounded-sm"
                      style={{ background: "#e8eaec", color: DSU.midGray }}
                      title={`${r.numKeys} copies`}
                    >
                      ×{r.numKeys}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  {r.roomNumber && <span className="font-mono text-[11px] font-medium">{r.roomNumber}</span>}
                  {r.roomNumber && r.roomDescription && <span style={{ color: "#c3c5c8" }}> · </span>}
                  {r.roomDescription}
                  {!r.roomNumber && !r.roomDescription && "—"}
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap">{r.building || "—"}</td>
                <td className="px-3 py-1.5 whitespace-nowrap font-mono text-[11px] tabular">{formatDate(r.dateIssued)}</td>
                {showReturned && (
                  <>
                    <td className="px-3 py-1.5 whitespace-nowrap font-mono text-[11px] tabular">
                      {formatDate(r.dateReturned)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-[11px] whitespace-nowrap" style={{ color: DSU.midGray }}>
                      {r.dateReturned ? `${daysBetween(r.dateIssued, r.dateReturned)} days` : "—"}
                    </td>
                  </>
                )}
                <td className="px-3 py-1.5">
                  <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                    {r.isActive && (
                      <button
                        onClick={() => actions.onReturn(r)}
                        title="Mark returned" aria-label="Mark returned"
                        className="p-1 rounded hover:bg-black/[0.07]"
                        style={{ color: DSU.navy }}
                      >
                        <CornerDownLeft size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => actions.onEdit(r)}
                      title="Edit" aria-label="Edit"
                      className="p-1 rounded hover:bg-black/[0.07]"
                      style={{ color: DSU.midGray }}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => actions.onDelete(r)}
                      title="Delete" aria-label="Delete"
                      className="p-1 rounded hover:bg-black/[0.07]"
                      style={{ color: DSU.danger }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Dates are plain yyyy-mm-dd, so parse as UTC to avoid a timezone off-by-one.
const asUTC = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((asUTC(to) - asUTC(from)) / 86400000));
}

function daysSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - asUTC(iso)) / 86400000));
}

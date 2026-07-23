import { useMemo } from "react";
import {
  ArrowLeft, Pencil, Plus, Trash2, CornerDownLeft, MapPin, Building2, StickyNote,
} from "lucide-react";
import type { KeyDef, KeyRecord } from "../../lib/types";
import { DSU, formatDate, radius, font, shadow } from "../theme";
import { Avatar, Button, HexBg, SectionHeader } from "../components/primitives";
import type { RowActions } from "./KeyTable";

/** Shared row hover tint. */
const HOVER_ROW = "#f0f7fc";

/**
 * Everything about one key: what it opens, who holds copies right now, and
 * everyone who has held it before. Reached by clicking a key stamp anywhere.
 */
export function KeyView({
  keyDef, records, actions, onBack, backLabel, onEdit, onDelete, onIssue, onSelectPerson,
}: {
  keyDef: KeyDef;
  /** All records for this key, active and returned. */
  records: KeyRecord[];
  actions: RowActions;
  onBack: () => void;
  backLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  onIssue: () => void;
  onSelectPerson: (personId: string) => void;
}) {
  const active = useMemo(
    () => records.filter((r) => r.isActive).sort((a, b) => a.personName.localeCompare(b.personName)),
    [records],
  );
  const past = useMemo(
    () =>
      records
        .filter((r) => !r.isActive)
        .sort((a, b) => (b.dateReturned ?? "").localeCompare(a.dateReturned ?? "")),
    [records],
  );

  const copiesOut = active.reduce((sum, r) => sum + r.numKeys, 0);
  const everHeld = new Set(records.map((r) => r.personId)).size;

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] mb-3 transition-colors hover:underline"
        style={{ color: DSU.trojan }}
      >
        <ArrowLeft size={13} /> Back to {backLabel}
      </button>

      {/* ── Key identity ── */}
      <div
        className="bg-white rounded p-5 mb-4 flex items-start gap-4 flex-wrap"
        style={{ boxShadow: shadow.md, borderRadius: radius.lg }}
      >
        {/* Hexagonal stamp badge — the key's identity at a glance. */}
        <div
          className="relative flex items-center justify-center flex-shrink-0 px-5 py-4 overflow-hidden"
          style={{
            background: DSU.navy,
            minWidth: 104,
            borderRadius: radius.lg,
            boxShadow: shadow.md,
          }}
        >
          <HexBg />
          <span className="relative font-mono text-[24px] font-bold text-white tracking-tight">
            {keyDef.keyStamp}
          </span>
        </div>

        <div className="flex-1 min-w-[220px]">
          <h1 className="text-[24px] font-semibold leading-tight" style={{ fontFamily: font.display, color: DSU.navy }}>
            {keyDef.roomDescription || "Unnamed room"}
          </h1>
          <div className="flex items-center gap-4 mt-1.5 text-[13px] flex-wrap" style={{ color: DSU.darkGray }}>
            {keyDef.roomNumber && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} style={{ color: DSU.midGray }} />
                Room <span className="font-mono font-medium">{keyDef.roomNumber}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Building2 size={12} style={{ color: DSU.midGray }} />
              {keyDef.building || "—"}
              {keyDef.department && (
                <span style={{ color: DSU.midGray }}> · {keyDef.department}</span>
              )}
            </span>
          </div>
          {keyDef.notes && (
            <div className="flex items-start gap-1.5 mt-2 text-[12px]" style={{ color: DSU.midGray }}>
              <StickyNote size={12} style={{ marginTop: 2, flexShrink: 0 }} />
              <span className="italic">{keyDef.notes}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="primary" onClick={onIssue}><Plus size={12} /> Issue This Key</Button>
          <Button onClick={onEdit}><Pencil size={12} /> Edit</Button>
          <Button variant="danger" onClick={onDelete}><Trash2 size={12} /></Button>
        </div>
      </div>

      {/* ── At a glance ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat
          label="Held Now"
          value={active.length}
          sub={active.length === 1 ? "person" : "people"}
          accent
        />
        <Stat label="Copies Out" value={copiesOut} sub="physical keys" />
        <Stat label="Times Issued" value={records.length} sub="all time" />
        <Stat label="Ever Held By" value={everHeld} sub={everHeld === 1 ? "person" : "people"} />
      </div>

      {/* ── Current holders ── */}
      <SectionHeader title="Currently Held By" count={active.length} noun="person" />
      {active.length === 0 ? (
        <Empty>Nobody currently holds this key.</Empty>
      ) : (
        <HolderTable records={active} actions={actions} onSelectPerson={onSelectPerson} showReturned={false} />
      )}

      {/* ── Past holders ── */}
      <div className="mt-6">
        <SectionHeader title="Previous Holders" count={past.length} noun="record" />
        {past.length === 0 ? (
          <Empty>This key has never been returned by anyone.</Empty>
        ) : (
          <HolderTable records={past} actions={actions} onSelectPerson={onSelectPerson} showReturned />
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

function HolderTable({
  records, actions, onSelectPerson, showReturned,
}: {
  records: KeyRecord[];
  actions: RowActions;
  onSelectPerson: (personId: string) => void;
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
            <th className="px-3 py-1.5 text-left font-semibold text-[11px]" style={{ color: DSU.midGray }}>Person</th>
            <th className="px-3 py-1.5 text-left font-semibold text-[11px]" style={{ color: DSU.midGray }}>Department</th>
            <th className="px-3 py-1.5 text-left font-semibold text-[11px]" style={{ color: DSU.midGray }}>Issued</th>
            {showReturned && (
              <>
                <th className="px-3 py-1.5 text-left font-semibold text-[11px]" style={{ color: DSU.midGray }}>Returned</th>
                <th className="px-3 py-1.5 text-right font-semibold text-[11px]" style={{ color: DSU.midGray }}>Held</th>
              </>
            )}
            <th className="px-3 py-1.5 text-center font-semibold text-[11px]" style={{ color: DSU.midGray }}>Copies</th>
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
                  <button
                    onClick={() => onSelectPerson(r.personId)}
                    className="inline-flex items-center gap-2 hover:underline text-left font-medium"
                    style={{ color: DSU.navy }}
                    title={`View ${r.personName}`}
                  >
                    <Avatar initials={r.initials} size={24} />
                    {r.personName}
                  </button>
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap">{r.department || "—"}</td>
                <td className="px-3 py-1.5 whitespace-nowrap font-mono text-[11px] tabular">{formatDate(r.dateIssued)}</td>
                {showReturned && (
                  <>
                    <td className="px-3 py-1.5 whitespace-nowrap font-mono text-[11px] tabular">{formatDate(r.dateReturned)}</td>
                    <td className="px-3 py-1.5 text-right text-[11px] whitespace-nowrap" style={{ color: DSU.midGray }}>
                      {r.dateReturned ? `${daysBetween(r.dateIssued, r.dateReturned)} days` : "—"}
                    </td>
                  </>
                )}
                <td className="px-3 py-1.5 text-center">{r.numKeys}</td>
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

const asUTC = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((asUTC(to) - asUTC(from)) / 86400000));
}

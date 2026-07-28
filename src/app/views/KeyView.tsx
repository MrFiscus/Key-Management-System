import { useMemo } from "react";
import {
  ArrowLeft, Pencil, Plus, Trash2, CornerDownLeft, MapPin, Building2, StickyNote,
  Users, CalendarClock, KeyRound,
} from "lucide-react";
import type { KeyDef, KeyRecord } from "../../lib/types";
import { DSU, formatDate, font, shadow } from "../theme";
import { Avatar, Button, HexBg } from "../components/primitives";
import type { RowActions } from "./KeyTable";

/** Shared row hover tint. */
const HOVER_ROW = "#f0f7fc";

/** Same white-card chrome as the Dashboard's stat tiles and panels — no
 *  hairline border, just a soft shadow and generous rounding. */
const CARD: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  boxShadow: shadow.sm,
};

/** Small circular icon badge — a size down from the Dashboard's, since these
 *  tiles are a secondary, page-local summary rather than the headline view. */
function IconBadge({ icon, bg, fg }: { icon: React.ReactNode; bg: string; fg: string }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{ width: 28, height: 28, background: bg, color: fg }}
    >
      {icon}
    </span>
  );
}

/**
 * Everything about one key: what it opens, who holds copies right now, and
 * everyone who has held it before. Reached by clicking a key stamp anywhere.
 * Same visual language as the Dashboard and PersonView — rounded shadow-card
 * masthead, icon-badge stat tiles, serif panel titles — so a key record and a
 * person record read as two views into the same system, not two different apps.
 */
export function KeyView({
  keyDef, records, actions, onBack, backLabel, onEdit, onDelete, onIssue, onSelectPerson,
  onSelectBuilding, onSelectDepartment,
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
  onSelectBuilding?: (name: string) => void;
  onSelectDepartment?: (name: string) => void;
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
    <div className="dsu-fade-in">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] mb-4 transition-colors hover:underline"
        style={{ color: DSU.trojan }}
      >
        <ArrowLeft size={13} /> Back to {backLabel}
      </button>

      {/* ── Masthead ── identity, same rounded shadow-card language as the
          Dashboard/PersonView — no full-bleed banner or watermark. */}
      <div className="p-5 sm:p-6 mb-4" style={CARD}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex items-start gap-4 min-w-0">
            {/* Hexagonal stamp badge — the key's identity at a glance. */}
            <div
              className="relative flex items-center justify-center flex-shrink-0 px-4 py-3.5 overflow-hidden rounded-2xl"
              style={{ background: DSU.navy, minWidth: 88, boxShadow: shadow.sm }}
            >
              <HexBg />
              <span className="relative font-mono text-[20px] font-bold text-white tracking-tight">
                {keyDef.keyStamp}
              </span>
            </div>

            <div className="min-w-0">
              <div
                className="text-[11px] font-semibold uppercase mb-1"
                style={{ color: DSU.trojan, letterSpacing: "0.14em" }}
              >
                Key Record
              </div>
              <h1 className="text-[26px] font-semibold leading-tight" style={{ fontFamily: font.display, color: DSU.navy }}>
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
                  {keyDef.building ? (
                    onSelectBuilding ? (
                      <button onClick={() => onSelectBuilding(keyDef.building!)} className="hover:underline" style={{ font: "inherit" }}>
                        {keyDef.building}
                      </button>
                    ) : keyDef.building
                  ) : "—"}
                  {keyDef.department && (
                    <span style={{ color: DSU.midGray }}>
                      {" · "}
                      {onSelectDepartment ? (
                        <button onClick={() => onSelectDepartment(keyDef.department!)} className="hover:underline" style={{ font: "inherit" }}>
                          {keyDef.department}
                        </button>
                      ) : keyDef.department}
                    </span>
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
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <Button variant="primary" onClick={onIssue} style={{ background: DSU.navy, borderColor: DSU.navyDark }}>
              <Plus size={12} /> Issue This Key
            </Button>
            <Button onClick={onEdit}><Pencil size={12} /> Edit</Button>
            <Button variant="danger" onClick={onDelete}><Trash2 size={12} /></Button>
          </div>
        </div>
      </div>

      {/* ── Stat tiles ── a solid-navy featured card for the headline number,
          three white supporting cards — same card language as the Dashboard. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="p-4" style={{ ...CARD, background: DSU.navy, color: "#fff" }}>
          <div className="flex items-start justify-between mb-2.5">
            <span className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>Held Now</span>
            <IconBadge icon={<Users size={14} />} bg="#ffffff" fg={DSU.navy} />
          </div>
          <div className="text-[24px] font-bold leading-none tabular">{active.length.toLocaleString()}</div>
          <p className="text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.7)" }}>
            {active.length === 1 ? "person" : "people"}
          </p>
        </div>

        <StatTile
          icon={<KeyRound size={14} />} badgeBg={DSU.trojan}
          label="Copies Out" value={copiesOut} sub="physical keys"
        />
        <StatTile
          icon={<CalendarClock size={14} />} badgeBg={DSU.navy}
          label="Times Issued" value={records.length} sub="all time"
        />
        <StatTile
          icon={<Users size={14} />} badgeBg={DSU.trojan}
          label="Ever Held By" value={everHeld} sub={everHeld === 1 ? "person" : "people"}
        />
      </div>

      {/* ── Current holders ── */}
      <div className="mb-8">
        <Panel title="Currently Held By" icon={<Users size={13} />} count={active.length} noun="person">
          {active.length === 0 ? (
            <Empty>Nobody currently holds this key.</Empty>
          ) : (
            <HolderTable records={active} actions={actions} onSelectPerson={onSelectPerson} showReturned={false} />
          )}
        </Panel>
      </div>

      {/* ── Past holders ── */}
      <Panel title="Previous Holders" icon={<CornerDownLeft size={13} />} count={past.length} noun="record">
        {past.length === 0 ? (
          <Empty>This key has never been returned by anyone.</Empty>
        ) : (
          <HolderTable records={past} actions={actions} onSelectPerson={onSelectPerson} showReturned />
        )}
      </Panel>
    </div>
  );
}

// ── pieces ────────────────────────────────────────────────────────────────────

/** One white supporting stat tile — icon badge + label on top, big number
 *  below, small sub-caption — same spec as the Dashboard's StatCard. */
function StatTile({
  icon, badgeBg, label, value, sub,
}: {
  icon: React.ReactNode; badgeBg: string; label: string; value: number; sub: string;
}) {
  return (
    <div className="p-4" style={CARD}>
      <div className="flex items-start justify-between mb-2.5">
        <span className="text-[13px] font-medium" style={{ color: DSU.midGray }}>{label}</span>
        <IconBadge icon={icon} bg={badgeBg} fg="#fff" />
      </div>
      <div className="text-[24px] font-bold leading-none tabular" style={{ color: DSU.navy }}>
        {value.toLocaleString()}
      </div>
      <p className="text-[11px] mt-2 truncate" style={{ color: DSU.midGray }} title={sub}>
        {sub}
      </p>
    </div>
  );
}

/** Panel chrome matching the Dashboard's — serif title, icon, optional count,
 *  rounded shadow-card, no border. */
function Panel({
  title, icon, count, noun, children,
}: {
  title: string; icon?: React.ReactNode; count?: number; noun?: string; children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden" style={CARD}>
      <div className="px-5 pt-4 pb-2 text-[18px] font-semibold flex items-center gap-2 flex-wrap" style={{ color: DSU.navy, fontFamily: font.sans }}>
        {icon && <span style={{ color: DSU.trojan }}>{icon}</span>}
        {title}
        {count !== undefined && (
          <span className="tabular font-normal text-[12px]" style={{ color: DSU.midGray, fontFamily: font.sans }}>
            · {count.toLocaleString()} {noun}{count !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="px-5 py-4 text-[12px]" style={{ color: DSU.midGray }}>{children}</div>
);

function HolderTable({
  records, actions, onSelectPerson, showReturned,
}: {
  records: KeyRecord[];
  actions: RowActions;
  onSelectPerson: (personId: string) => void;
  showReturned: boolean;
}) {
  // Symmetric grid columns — same template on the header and every row, so
  // Person and Department each get their own share of the card's width
  // instead of crowding together, and the list fills the card evenly.
  const cols = showReturned
    ? "minmax(0,1.2fr) minmax(0,1fr) 108px 108px 64px 70px 128px"
    : "minmax(0,1.2fr) minmax(0,1fr) 150px 70px 128px";

  return (
    <div style={{ fontFamily: font.sans }}>
      <div
        className="grid px-5 py-2 text-[11px] font-semibold"
        style={{ gridTemplateColumns: cols, gap: 16, background: "color-mix(in srgb, #00A9E0 7%, white)", color: DSU.midGray, borderBottom: `1px solid ${DSU.lightBorder}` }}
      >
        <div>Person</div>
        <div>Department</div>
        <div>Issued</div>
        {showReturned && <div>Returned</div>}
        {showReturned && <div className="text-right">Held</div>}
        <div className="text-center">Copies</div>
        <div className="text-right">Actions</div>
      </div>

      <div className="pb-1">
        {records.map((r, i) => {
          const base = i % 2 === 0 ? "#ffffff" : "#f7f9fa";
          return (
            <div
              key={r.assignmentId}
              className="group grid items-center px-5 py-2.5 transition-colors dsu-row-in"
              style={{ gridTemplateColumns: cols, gap: 16, background: base, animationDelay: `${Math.min(i, 14) * 16}ms` }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = HOVER_ROW;
                e.currentTarget.style.boxShadow = `inset 3px 0 0 ${DSU.trojan}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = base;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <button
                onClick={() => onSelectPerson(r.personId)}
                className="inline-flex items-center gap-2 hover:underline text-left font-semibold min-w-0"
                style={{ color: DSU.navy, fontSize: 14 }}
                title={`View ${r.personName}`}
              >
                <Avatar initials={r.initials} size={28} />
                <span className="truncate">{r.personName}</span>
              </button>

              <div className="text-[13px] truncate min-w-0" style={{ color: DSU.darkGray }}>
                {r.department || "—"}
              </div>

              <div className="text-[11.5px] tabular truncate" style={{ color: DSU.midGray }}>
                {formatDate(r.dateIssued)}
              </div>
              {showReturned && (
                <div className="text-[11.5px] tabular truncate" style={{ color: DSU.midGray }}>
                  {formatDate(r.dateReturned)}
                </div>
              )}
              {showReturned && (
                <div className="text-[11.5px] tabular text-right" style={{ color: DSU.midGray }}>
                  {r.dateReturned ? `${daysBetween(r.dateIssued, r.dateReturned)}d` : "—"}
                </div>
              )}

              <div className="text-[13px] font-semibold tabular text-center" style={{ color: DSU.navy }}>
                {r.numKeys}
              </div>

              <div className="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                {r.isActive && (
                  <button
                    onClick={() => actions.onReturn(r)}
                    title="Mark returned" aria-label="Mark returned"
                    className="p-2 rounded-lg hover:bg-black/[0.06]"
                    style={{ color: DSU.navy }}
                  >
                    <CornerDownLeft size={16} />
                  </button>
                )}
                <button
                  onClick={() => actions.onEdit(r)}
                  title="Edit" aria-label="Edit"
                  className="p-2 rounded-lg hover:bg-black/[0.06]"
                  style={{ color: DSU.midGray }}
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => actions.onDelete(r)}
                  title="Delete" aria-label="Delete"
                  className="p-2 rounded-lg hover:bg-black/[0.06]"
                  style={{ color: DSU.danger }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const asUTC = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((asUTC(to) - asUTC(from)) / 86400000));
}

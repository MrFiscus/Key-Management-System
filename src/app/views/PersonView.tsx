import { useMemo, useState } from "react";
import {
  ArrowLeft, Pencil, Plus, Trash2, Mail, IdCard, ChevronRight, CornerDownLeft,
  KeyRound, Building2, Undo2, Clock3,
} from "lucide-react";
import { initialsOf, type KeyRecord, type Person } from "../../lib/types";
import { DSU, formatDate, font, shadow } from "../theme";
import { Avatar, Button } from "../components/primitives";
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
 * Everything about one person: who they are, what they currently hold, and the
 * full history of what they've had before. Reached by clicking a name anywhere
 * in the app. Restyled to match the Dashboard's visual language — rounded
 * shadow-elevated cards, icon-badge stat tiles, serif panel titles — so a key
 * holder's record reads as part of the same system as the rest of the app.
 */
export function PersonView({
  person, records, actions, onBack, backLabel, onEdit, onDelete, onIssue, onSelectKey,
  onSelectBuilding, onSelectDepartment,
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
  onSelectBuilding?: (name: string) => void;
  onSelectDepartment?: (name: string) => void;
}) {
  const [heroHover, setHeroHover] = useState(false);
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
  const longestStamp = active.length > 0 ? active[active.length - 1] : null;

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
          Dashboard's panels, no full-bleed banner or watermark. */}
      <div className="p-5 sm:p-6 mb-4" style={CARD}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex items-start gap-4 min-w-0">
            <Avatar initials={initialsOf(person.fullName)} size={56} />
            <div className="min-w-0">
              <div
                className="text-[11px] font-semibold uppercase mb-1"
                style={{ color: DSU.trojan, letterSpacing: "0.14em" }}
              >
                Key Holder
              </div>
              <h1
                className="text-[26px] font-semibold leading-tight truncate"
                style={{ fontFamily: font.display, color: DSU.navy }}
              >
                {person.fullName}
              </h1>
              <div className="flex items-center gap-1 mt-1 text-[13px] flex-wrap" style={{ color: DSU.darkGray }}>
                {person.department ? (
                  onSelectDepartment ? (
                    <button onClick={() => onSelectDepartment(person.department!)} className="hover:underline" style={{ font: "inherit" }}>
                      {person.department}
                    </button>
                  ) : person.department
                ) : "—"}
                <ChevronRight size={12} style={{ color: DSU.midGray }} />
                {person.building ? (
                  onSelectBuilding ? (
                    <button onClick={() => onSelectBuilding(person.building!)} className="hover:underline" style={{ font: "inherit" }}>
                      {person.building}
                    </button>
                  ) : person.building
                ) : "—"}
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
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <Button variant="primary" onClick={onIssue} style={{ background: DSU.navy, borderColor: DSU.navyDark }}>
              <Plus size={12} /> Issue Key
            </Button>
            <Button onClick={onEdit}><Pencil size={12} /> Edit</Button>
            <Button variant="danger" onClick={onDelete}><Trash2 size={12} /></Button>
          </div>
        </div>
      </div>

      {/* ── Stat tiles ── a solid-navy featured card for the headline number,
          three white supporting cards — same card language as the Dashboard. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div
          onMouseEnter={() => setHeroHover(true)}
          onMouseLeave={() => setHeroHover(false)}
          className="p-4"
          style={{
            ...CARD,
            background: heroHover ? DSU.navyHover : DSU.navy,
            color: "#fff",
            boxShadow: heroHover ? shadow.lg : shadow.sm,
            transform: heroHover ? "translateY(-4px)" : "translateY(0)",
            transition: "background-color 180ms ease, box-shadow 220ms ease, transform 220ms ease",
          }}
        >
          <div className="flex items-start justify-between mb-2.5">
            <span className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>Keys Held</span>
            <IconBadge icon={<KeyRound size={14} />} bg="#ffffff" fg={DSU.navy} />
          </div>
          <div className="text-[24px] font-bold leading-none tabular">{active.length.toLocaleString()}</div>
          <p className="text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.7)" }}>
            {copiesOut.toLocaleString()} physical cop{copiesOut === 1 ? "y" : "ies"}
          </p>
        </div>

        <StatTile
          icon={<Building2 size={14} />} badgeBg={DSU.trojan}
          label="Buildings" value={buildings.length} sub={buildings.join(", ") || "none"}
        />
        <StatTile
          icon={<Undo2 size={14} />} badgeBg={DSU.navy}
          label="Previously Returned" value={returned.length} sub="in history"
        />
        <StatTile
          icon={<Clock3 size={14} />} badgeBg={DSU.trojan}
          label="Longest Held"
          value={longestStamp ? daysSince(longestStamp.dateIssued) : 0}
          sub={longestStamp ? `days · ${longestStamp.keyStamp}` : "no keys out"}
        />
      </div>

      {/* ── Currently held ── */}
      <div className="mb-8">
        <Panel title="Currently Held" icon={<KeyRound size={13} />} count={active.length} noun="key">
          {active.length === 0 ? (
            <Empty>No keys are currently checked out to {person.fullName}.</Empty>
          ) : (
            <HistoryTable records={active} actions={actions} onSelectKey={onSelectKey} onSelectBuilding={onSelectBuilding} showReturned={false} />
          )}
        </Panel>
      </div>

      {/* ── History ── */}
      <Panel title="Key History" icon={<Undo2 size={13} />} count={returned.length} noun="returned key">
        {returned.length === 0 ? (
          <Empty>No returned keys on record.</Empty>
        ) : (
          <HistoryTable records={returned} actions={actions} onSelectKey={onSelectKey} onSelectBuilding={onSelectBuilding} showReturned />
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
  // Same lift/tint/shadow language as the Dashboard's stat cards.
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="p-4"
      style={{
        ...CARD,
        background: hover ? DSU.tintBg : "#ffffff",
        boxShadow: hover ? shadow.lg : shadow.sm,
        transform: hover ? "translateY(-4px)" : "translateY(0)",
        transition: "background-color 180ms ease, box-shadow 220ms ease, transform 220ms ease",
      }}
    >
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

function HistoryTable({
  records, actions, onSelectKey, onSelectBuilding, showReturned,
}: {
  records: KeyRecord[];
  actions: RowActions;
  onSelectKey: (keyId: string) => void;
  onSelectBuilding?: (name: string) => void;
  showReturned: boolean;
}) {
  // Symmetric grid columns — same template on the header and every row.
  // Room and Building get their own columns (not stacked in one), so the
  // wide center of the card actually gets used instead of everything
  // crowding into a single narrow text block.
  const cols = showReturned
    ? "100px minmax(0,1fr) minmax(0,1fr) 108px 108px 64px 128px"
    : "100px minmax(0,1fr) minmax(0,1fr) 130px 128px";

  return (
    <div style={{ fontFamily: font.sans }}>
      <div
        className="grid px-5 py-2 text-[11px] font-semibold"
        style={{ gridTemplateColumns: cols, gap: 16, background: "color-mix(in srgb, #00A9E0 7%, white)", color: DSU.midGray, borderBottom: `1px solid ${DSU.lightBorder}` }}
      >
        <div>Key</div>
        <div>Room</div>
        <div>Building</div>
        <div>Issued</div>
        {showReturned && <div>Returned</div>}
        {showReturned && <div className="text-right">Held</div>}
        <div className="text-right">Actions</div>
      </div>

      <div className="pb-1">
        {records.map((r, i) => {
          const room = r.roomNumber || r.roomDescription
            ? [r.roomNumber, r.roomDescription].filter(Boolean).join(" · ")
            : "—";
          const held = r.dateReturned ? daysBetween(r.dateIssued, r.dateReturned) : null;
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
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  onClick={() => onSelectKey(r.keyId)}
                  title={`View key ${r.keyStamp}`}
                  className="font-mono font-bold rounded-md px-2 py-1 transition-colors shrink-0"
                  style={{ fontSize: 14, color: "#fff", background: DSU.trojan }}
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

              <div className="text-[13px] font-medium truncate min-w-0" style={{ color: DSU.darkGray }} title={room}>
                {room !== "—" ? (
                  <button onClick={() => onSelectKey(r.keyId)} className="hover:underline text-left" style={{ font: "inherit" }}>
                    {room}
                  </button>
                ) : room}
              </div>
              <div className="text-[13px] truncate min-w-0" style={{ color: DSU.darkGray }} title={r.building ?? undefined}>
                {r.building ? (
                  onSelectBuilding ? (
                    <button onClick={() => onSelectBuilding(r.building)} className="hover:underline text-left" style={{ font: "inherit" }}>
                      {r.building}
                    </button>
                  ) : r.building
                ) : "—"}
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
                  {held !== null ? `${held}d` : "—"}
                </div>
              )}

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

// Dates are plain yyyy-mm-dd, so parse as UTC to avoid a timezone off-by-one.
const asUTC = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((asUTC(to) - asUTC(from)) / 86400000));
}

function daysSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - asUTC(iso)) / 86400000));
}

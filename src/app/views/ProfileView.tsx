import {
  ArrowLeft, ChevronRight, Mail, Calendar, KeyRound, Users, Building2, LogOut, Settings2,
  Plus, Pencil, History, ArrowUpRight, CornerDownLeft,
} from "lucide-react";
import type { KeyActivity, Snapshot } from "../../lib/types";
import { DSU, font, formatDate, shadow } from "../theme";
import { Avatar, Button } from "../components/primitives";

/** Shared row hover tint — same as PersonView's HistoryTable. */
const HOVER_ROW = "#f0f7fc";

/** Icon and label for each kind of key activity row — color follows the same
 *  navy/trojan alternation PersonView uses for its own row accents. */
const ACTIVITY_STYLE: Record<KeyActivity["action"], { icon: React.ReactNode; color: string; label: string }> = {
  created: { icon: <Plus size={12} />, color: DSU.trojan, label: "Created" },
  updated: { icon: <Pencil size={12} />, color: DSU.navy, label: "Updated" },
  issued: { icon: <ArrowUpRight size={12} />, color: DSU.trojan, label: "Issued" },
  returned: { icon: <CornerDownLeft size={12} />, color: DSU.navy, label: "Returned" },
};

/** Same white-card chrome as the Dashboard's stat tiles and panels — no
 *  hairline border, just a soft shadow and generous rounding. */
const CARD: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  boxShadow: shadow.sm,
};

/** "Jul 28, 3:15 PM" — activity timestamps carry a time-of-day, unlike the
 *  plain yyyy-mm-dd dates formatDate() elsewhere in the app expects. */
function formatActivityTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/** Small circular icon badge — matches PersonView's secondary-tile size. */
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
 * The signed-in account's own page — same masthead/stat-tile/panel language
 * as PersonView (a key holder's page), just pointed at the account instead
 * of a person record: who's signed in, since when, and what the current
 * dataset looks like at a glance.
 */
export function ProfileView({
  email, storeKind, createdAt, snapshot, onBack, backLabel, onSignOut, onOpenSettings, keyActivity, onSelectKey,
}: {
  email: string | null;
  storeKind: "local" | "supabase";
  createdAt: string | null;
  snapshot: Snapshot;
  onBack: () => void;
  backLabel: string;
  onSignOut: () => void;
  onOpenSettings: () => void;
  /** Newest-first; capped to 5 by the caller. */
  keyActivity: KeyActivity[];
  onSelectKey: (keyId: string) => void;
}) {
  const initials = email ? email.slice(0, 2).toUpperCase() : "LS";
  const buildings = new Set(
    [...snapshot.people.map((p) => p.building), ...snapshot.keys.map((k) => k.building)].filter(Boolean),
  );

  return (
    <div className="dsu-fade-in">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] mb-4 transition-colors hover:underline"
        style={{ color: DSU.trojan }}
      >
        <ArrowLeft size={13} /> Back to {backLabel}
      </button>

      {/* ── Masthead ── identical shape to PersonView's: avatar, eyebrow,
          serif name, a breadcrumb-style detail line, actions top-right. */}
      <div className="p-5 sm:p-6 mb-4" style={CARD}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex items-start gap-4 min-w-0">
            <Avatar initials={initials} size={56} />
            <div className="min-w-0">
              <div
                className="text-[11px] font-semibold uppercase mb-1"
                style={{ color: DSU.trojan, letterSpacing: "0.14em" }}
              >
                Account
              </div>
              <h1
                className="text-[26px] font-semibold leading-tight truncate"
                style={{ fontFamily: font.display, color: DSU.navy }}
              >
                {email ?? "Local Storage Mode"}
              </h1>
              <div className="flex items-center gap-1 mt-1 text-[13px] flex-wrap" style={{ color: DSU.darkGray }}>
                {storeKind === "supabase" ? "Supabase account" : "Local session"}
                <ChevronRight size={12} style={{ color: DSU.midGray }} />
                {storeKind === "supabase" ? "Synced" : "This browser only"}
              </div>
              <div className="flex items-center gap-4 mt-2 text-[12px] flex-wrap" style={{ color: DSU.midGray }}>
                {email && (
                  <a href={`mailto:${email}`} className="inline-flex items-center gap-1 hover:underline">
                    <Mail size={11} /> {email}
                  </a>
                )}
                {createdAt && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={11} /> Member since {formatDate(createdAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <Button onClick={onOpenSettings}><Settings2 size={12} /> Settings</Button>
            {email && (
              <Button variant="danger" onClick={onSignOut}><LogOut size={12} /> Sign out</Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stat tiles ── the dataset this account is looking at, same
          solid-navy-hero + three-white-tiles card language as PersonView. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="p-4" style={{ ...CARD, background: DSU.navy, color: "#fff" }}>
          <div className="flex items-start justify-between mb-2.5">
            <span className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>Records</span>
            <IconBadge icon={<KeyRound size={14} />} bg="#ffffff" fg={DSU.navy} />
          </div>
          <div className="text-[24px] font-bold leading-none tabular">{snapshot.assignments.length.toLocaleString()}</div>
          <p className="text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.7)" }}>issuance records on file</p>
        </div>

        <StatTile
          icon={<Users size={14} />} badgeBg={DSU.trojan}
          label="People" value={snapshot.people.length} sub="in the directory"
        />
        <StatTile
          icon={<KeyRound size={14} />} badgeBg={DSU.navy}
          label="Keys" value={snapshot.keys.length} sub="in the catalog"
        />
        <StatTile
          icon={<Building2 size={14} />} badgeBg={DSU.trojan}
          label="Buildings" value={buildings.size} sub="represented"
        />
      </div>

      {/* ── Recent key activity ── the last few keys this account has
          created, edited, issued, or had returned, so catalog changes stay
          attributable instead of anonymous. Local storage has no accounts,
          so this is just this browser's own recent edits. Same HistoryTable
          grid PersonView uses for "Currently Held". */}
      <Panel title="Recently Updated Keys" icon={<History size={13} />} count={keyActivity.length} noun="key">
        {keyActivity.length === 0 ? (
          <Empty>No key edits recorded yet.</Empty>
        ) : (
          <ActivityTable rows={keyActivity} keys={snapshot.keys} onSelectKey={onSelectKey} />
        )}
      </Panel>
    </div>
  );
}

function ActivityTable({
  rows, keys, onSelectKey,
}: {
  rows: KeyActivity[];
  keys: Snapshot["keys"];
  onSelectKey: (keyId: string) => void;
}) {
  const cols = "100px minmax(0,1fr) minmax(0,1fr) 100px 140px";

  return (
    <div style={{ fontFamily: font.sans }}>
      <div
        className="grid px-5 py-2 text-[11px] font-semibold"
        style={{ gridTemplateColumns: cols, gap: 16, background: "color-mix(in srgb, #00A9E0 7%, white)", color: DSU.midGray, borderBottom: `1px solid ${DSU.lightBorder}` }}
      >
        <div>Key</div>
        <div>Room</div>
        <div>Building</div>
        <div>Action</div>
        <div className="text-right">When</div>
      </div>

      <div className="pb-1">
        {rows.map((a, i) => {
          const key = keys.find((k) => k.id === a.keyId);
          const room = key && (key.roomNumber || key.roomDescription)
            ? [key.roomNumber, key.roomDescription].filter(Boolean).join(" · ")
            : "—";
          const style = ACTIVITY_STYLE[a.action];
          const base = i % 2 === 0 ? "#ffffff" : "#f7f9fa";
          return (
            <div
              key={a.id}
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
                  onClick={() => onSelectKey(a.keyId)}
                  title={`View key ${a.keyStamp}`}
                  className="font-mono font-bold rounded-md px-2 py-1 transition-colors shrink-0"
                  style={{ fontSize: 14, color: "#fff", background: DSU.trojan }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = DSU.trojanDark)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = DSU.trojan)}
                >
                  {a.keyStamp}
                </button>
              </div>

              <div className="text-[13px] font-medium truncate min-w-0" style={{ color: DSU.darkGray }} title={room}>
                {room}
              </div>
              <div className="text-[13px] truncate min-w-0" style={{ color: DSU.darkGray }} title={key?.building ?? undefined}>
                {key?.building || "—"}
              </div>

              <div className="flex items-center gap-1.5 text-[11.5px] font-semibold truncate" style={{ color: style.color }}>
                {style.icon} {style.label}
              </div>
              <div className="text-[11.5px] tabular text-right truncate" style={{ color: DSU.midGray }}>
                {formatActivityTime(a.at)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Panel chrome matching PersonView's — icon, title, optional count, rounded
 *  shadow-card, no border. */
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
      <p className="text-[11px] mt-2 truncate" style={{ color: DSU.midGray }}>{sub}</p>
    </div>
  );
}

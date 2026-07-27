import { useId, useMemo, useRef, useState } from "react";
import { Users, ArrowUpRight, ArrowDownLeft, Search, Maximize2, Building2, Briefcase, PieChart, Plus, Undo2, KeyRound, Download } from "lucide-react";
import type { KeyRecord, Snapshot } from "../../lib/types";
import { DSU, formatDate, isStampQuery, radius, font, shadow } from "../theme";
import { Avatar, Button, Modal, Stamp } from "../components/primitives";

/** Shared white-card chrome for stat tiles and panels — no hairline border,
 *  just a soft shadow and generous rounding, so cards separate by elevation
 *  alone (matches the reference: no visible card outlines anywhere). */
const CARD: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  boxShadow: shadow.sm,
};

/** Small circular icon badge used at the top of every stat card. */
function IconBadge({ icon, bg, fg }: { icon: React.ReactNode; bg: string; fg: string }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{ width: 34, height: 34, background: bg, color: fg }}
    >
      {icon}
    </span>
  );
}

/**
 * Landing page. Answers "what's going on right now" in one screen: how much is
 * out and what changed recently. Everything on it links through to the person
 * or key it refers to.
 *
 * Deliberately has no "needs attention" alerts. Both obvious candidates are
 * normal here: keys are issued for years at a time, and one stamp is legitimately
 * held by several people at once. Flagging either would train you to ignore it.
 */
export function DashboardView({
  snapshot, records, onSelectPerson, onSelectKey, onGoToTab, onSearch, onIssue, onReturnKeys,
}: {
  snapshot: Snapshot;
  records: KeyRecord[];
  onSelectPerson: (id: string) => void;
  onSelectKey: (id: string) => void;
  onGoToTab: (tab: "returned" | "keys" | "directory" | "data") => void;
  onSearch: (query: string) => void;
  onIssue: () => void;
  onReturnKeys: () => void;
}) {
  const active = useMemo(() => records.filter((r) => r.isActive), [records]);
  const returned = useMemo(() => records.filter((r) => !r.isActive), [records]);

  const copiesOut = active.reduce((sum, r) => sum + r.numKeys, 0);
  const holders = new Set(active.map((r) => r.personId)).size;
  const buildings = new Set(active.map((r) => r.building).filter(Boolean)).size;

  /** Keys more than one person currently holds — informational, not a problem. */
  const shared = useMemo(() => {
    const m = new Map<string, { record: KeyRecord; holders: Set<string> }>();
    for (const r of active) {
      const e = m.get(r.keyId) ?? { record: r, holders: new Set<string>() };
      e.holders.add(r.personName);
      m.set(r.keyId, e);
    }
    return [...m.values()]
      .filter((e) => e.holders.size > 1)
      .sort((a, b) => b.holders.size - a.holders.size);
  }, [active]);

  // Full, sorted activity lists. The panels preview the first handful; the
  // expand popup shows the rest.
  const issuedSorted = useMemo(
    () => [...active].sort((a, b) => b.dateIssued.localeCompare(a.dateIssued)),
    [active],
  );
  const returnedSorted = useMemo(
    () => [...returned].sort((a, b) => (b.dateReturned ?? "").localeCompare(a.dateReturned ?? "")),
    [returned],
  );
  const recentlyIssued = issuedSorted.slice(0, 6);
  const recentlyReturned = returnedSorted.slice(0, 6);

  const byBuilding = useMemo(() => groupCounts(records, (r) => r.building || "(unspecified)"), [records]);
  const byDept = useMemo(() => groupCounts(records, (r) => r.department || "(unspecified)"), [records]);

  // Top slices for the bar charts — only places that actually have keys out.
  const buildingBars = useMemo(
    () => byBuilding.filter(([, c]) => c.active > 0).slice(0, 7).map(([n, c]) => [n, c.active] as [string, number]),
    [byBuilding],
  );
  const deptBars = useMemo(
    () => byDept.filter(([, c]) => c.active > 0).slice(0, 7).map(([n, c]) => [n, c.active] as [string, number]),
    [byDept],
  );

  const empty = records.length === 0;

  // ── Prominent, page-level search (dashboard only) ──
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return { people: [], keys: [] };
    return {
      people: snapshot.people.filter((p) => p.fullName.toLowerCase().includes(t)).slice(0, 6),
      keys: snapshot.keys
        .filter((k) => (k.keyStamp + " " + (k.roomDescription ?? "")).toLowerCase().includes(t))
        .slice(0, 6),
    };
  }, [q, snapshot]);

  const hasMatches = matches.people.length > 0 || matches.keys.length > 0;

  // Which activity list is expanded into a popup, if any.
  const [expanded, setExpanded] = useState<null | "issued" | "returned">(null);

  return (
    <div>
      {/* ── Page header ── title + a real Export action (same export the Data
          tab offers), matching the reference's masthead row. No fake period/
          filter controls — nothing behind them to page. */}
      {!empty && (
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <h1 className="text-[26px] font-semibold" style={{ fontFamily: font.display, color: DSU.navy }}>
            Dashboard
          </h1>
          <Button onClick={() => onGoToTab("data")} className="!rounded-full !px-4">
            <Download size={13} /> Export
          </Button>
        </div>
      )}

      {empty ? (
        <div className="mb-6 px-6 py-10 text-center">
          <h1 className="text-[26px] font-semibold" style={{ fontFamily: font.display, color: DSU.navy }}>
            Nothing on record yet
          </h1>
          <p className="text-[14px] mt-2" style={{ color: DSU.midGray }}>
            <Linkish onClick={() => onGoToTab("data")}>Import your spreadsheet</Linkish> to get started.
          </p>
        </div>
      ) : (
        <>
          {/* ── Stat row ── a solid-navy featured card (the headline number),
              four white supporting cards, and a dashed "Add data" tile — same
              size/card language throughout: circular icon badge + label on
              top, big number below. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            <HeroStatCard
              icon={<ArrowUpRight size={16} />} label="Keys Out" value={active.length}
            />

            <StatCard
              icon={<Users size={16} />} badgeBg={DSU.navy}
              label="Holders" value={holders} onClick={() => onGoToTab("directory")}
            />
            <StatCard
              icon={<KeyRound size={16} />} badgeBg={DSU.trojan}
              label="Catalog" value={snapshot.keys.length} onClick={() => onGoToTab("keys")}
            />
            <StatCard
              icon={<Building2 size={16} />} badgeBg={DSU.navy}
              label="Buildings" value={buildings}
            />
            <StatCard
              icon={<Undo2 size={16} />} badgeBg={DSU.trojan}
              label="Returned" value={returned.length} onClick={() => onGoToTab("returned")}
            />

            {/* Real action, not decoration: goes straight to the Data tab's import flow. */}
            <button
              onClick={() => onGoToTab("data")}
              className="p-5 flex flex-col items-center justify-center gap-2 text-center transition-colors"
              style={{
                borderRadius: 20,
                border: `1.5px dashed ${DSU.lightBorder}`,
                color: DSU.midGray,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = DSU.trojan; e.currentTarget.style.color = DSU.trojan; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = DSU.lightBorder; e.currentTarget.style.color = DSU.midGray; }}
            >
              <span className="inline-flex items-center justify-center rounded-full" style={{ width: 34, height: 34, background: DSU.tintBg }}>
                <Plus size={16} />
              </span>
              <span className="text-[14px] font-medium">Add data</span>
            </button>
          </div>

          {/* Search + key actions — unchanged design/position, just no longer
              nested inside a special masthead surface. */}
          <div className="mb-10 flex flex-col items-center gap-6">
          <form
            ref={searchRef}
            onSubmit={(e) => { e.preventDefault(); onSearch(q); }}
            className="relative w-full max-w-[560px]"
            onBlur={(e) => { if (!searchRef.current?.contains(e.relatedTarget as Node)) setFocused(false); }}
          >
            <Search
              size={19}
              className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: DSU.midGray }}
            />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setFocused(true)}
              placeholder="Search a person or key stamp…"
              aria-label="Search records"
              autoComplete="off"
              className="w-full pl-12 pr-4 py-3.5 text-[15px] bg-white outline-none transition-all duration-150"
              style={{
                border: `1px solid ${focused ? DSU.trojan : "#dfe3e7"}`,
                // When the dropdown is open, drop the bottom edge so the input and
                // the suggestions read as one continuous outlined box.
                borderBottom: focused && q.trim() ? "none" : `1px solid ${focused ? DSU.trojan : "#dfe3e7"}`,
                borderRadius: focused && q.trim() ? `${radius.xl}px ${radius.xl}px 0 0` : radius.xl,
                // No shadow while the dropdown is open — it carries one shadow for
                // the whole shape. Otherwise a soft focus/idle elevation.
                boxShadow: focused && q.trim()
                  ? "none"
                  : focused
                    ? "0 4px 16px -4px rgba(16,40,56,0.14)"
                    : shadow.sm,
                color: DSU.darkGray,
              }}
            />

            {/* Live suggestions, Google-style, attached to the field. */}
            {focused && q.trim() && (
              <div
                className="absolute left-0 right-0 top-full bg-white overflow-hidden z-30"
                style={{
                  border: `1px solid ${DSU.trojan}`,
                  borderTop: "none",
                  borderRadius: `0 0 ${radius.xl}px ${radius.xl}px`,
                  boxShadow: "0 10px 28px -10px rgba(16,40,56,0.22)",
                }}
              >
                {matches.people.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setQ(""); onSelectPerson(p.id); }}
                    className="flex items-center gap-3 w-full text-left px-4 py-2.5 hover:bg-[#f4f8fb] transition-colors"
                  >
                    <Avatar initials={p.fullName.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase()} size={26} />
                    <span className="text-[14px]" style={{ color: DSU.darkGray }}>{p.fullName}</span>
                    {p.department && <span className="text-[12px] ml-auto" style={{ color: DSU.midGray }}>{p.department}</span>}
                  </button>
                ))}
                {matches.keys.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setQ(""); onSelectKey(k.id); }}
                    className="flex items-center gap-3 w-full text-left px-4 py-2.5 hover:bg-[#f4f8fb] transition-colors"
                  >
                    <Search size={14} style={{ color: DSU.midGray }} />
                    <Stamp stamp={k.keyStamp} />
                    {k.roomDescription && <span className="text-[13px]" style={{ color: DSU.darkGray }}>{k.roomDescription}</span>}
                  </button>
                ))}
                <button
                  type="submit"
                  onMouseDown={(e) => e.preventDefault()}
                  className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#f4f8fb] transition-colors"
                  style={{ color: DSU.tintText, borderTop: hasMatches ? "1px solid #eef1f3" : "none" }}
                >
                  <Search size={13} />
                  See all results for “{q.trim()}”{isStampQuery(q) ? " (key stamp)" : ""}
                </button>
              </div>
            )}
          </form>

          {/* Primary key actions, centred under the search. Navy + brick red
              keeps them in the flat brand palette rather than a bright accent. */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={onIssue}
              className="!px-5 !py-2.5 !text-[13px] !rounded-[6px]"
              style={{ background: DSU.navy, borderColor: DSU.navyDark }}
            >
              <Plus size={15} /> Issue Key
            </Button>
            <Button
              variant="dangerSolid"
              onClick={onReturnKeys}
              className="!px-5 !py-2.5 !text-[13px] !rounded-[6px]"
            >
              <Undo2 size={15} /> Return Key
            </Button>
          </div>
          </div>

          {/* ── Big chart row ── the two headline charts, promoted right below
              search. Building chart a touch smaller, donut column a touch
              wider (3:2 rather than 2:1) so the donut's stat tiles have room
              to breathe. Each panel carries its own title, no umbrella heading. */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-14 dsu-stagger">
            <div className="lg:col-span-3">
              <Panel title="Keys Out by Building" icon={<Building2 size={13} />}>
                <ColumnChart rows={buildingBars} color={DSU.navy} tint="color-mix(in srgb, #004165 24%, white)" empty="No keys out." />
              </Panel>
            </div>
            <div className="lg:col-span-2">
              <Panel title="Out vs Returned" icon={<PieChart size={13} />}>
                <Donut
                  segments={[
                    { label: "Out now", value: active.length, color: DSU.trojan },
                    { label: "Returned", value: returned.length, color: DSU.navy },
                  ]}
                  tiles={[
                    { label: "Active checkouts", value: active.length },
                    { label: "All-time returns", value: returned.length },
                    { label: "Physical copies out", value: copiesOut },
                    { label: "Shared keys", value: shared.length },
                  ]}
                />
              </Panel>
            </div>
          </div>
        </>
      )}

      {/* ── Recent activity ── */}
      {!empty && (
        <div className="mb-14">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 dsu-stagger">
            <Panel
              title="Recently Issued"
              icon={<ArrowUpRight size={13} />}
              onExpand={issuedSorted.length > 6 ? () => setExpanded("issued") : undefined}
            >
              {recentlyIssued.length === 0 ? (
                <Empty>Nothing is currently out.</Empty>
              ) : (
                <MiniTable
                  head={["Person", "Key", "Room", "Issued"]}
                  rows={recentlyIssued.map((r) => [
                    <PersonLink record={r} onClick={onSelectPerson} />,
                    <Stamp stamp={r.keyStamp} onClick={() => onSelectKey(r.keyId)} />,
                    <span style={{ color: DSU.darkGray }}>{roomLabel(r)}</span>,
                    <Mono>{dateLabel(r.dateIssued)}</Mono>,
                  ])}
                />
              )}
            </Panel>

            <Panel
              title="Recently Returned"
              icon={<ArrowDownLeft size={13} />}
              onExpand={returnedSorted.length > 6 ? () => setExpanded("returned") : undefined}
            >
              {recentlyReturned.length === 0 ? (
                <Empty>No keys returned yet.</Empty>
              ) : (
                <MiniTable
                  head={["Person", "Key", "Room", "Returned"]}
                  rows={recentlyReturned.map((r) => [
                    <PersonLink record={r} onClick={onSelectPerson} />,
                    <Stamp stamp={r.keyStamp} onClick={() => onSelectKey(r.keyId)} />,
                    <span style={{ color: DSU.darkGray }}>{roomLabel(r)}</span>,
                    <Mono>{dateLabel(r.dateReturned)}</Mono>,
                  ])}
                />
              )}
            </Panel>
          </div>
        </div>
      )}

      {/* ── Breakdown ── the two supporting charts that didn't make the
          promoted row. */}
      {!empty && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 dsu-stagger mb-14">
          <Panel title="Keys Out by Department" icon={<Briefcase size={13} />}>
            <ColumnChart rows={deptBars} color={DSU.trojan} tint="color-mix(in srgb, #00A9E0 24%, white)" empty="No keys out." />
          </Panel>
          <Panel title="Most Shared Keys" icon={<Users size={13} />}>
            <HorizontalBarChart
              color={DSU.navy}
              empty="No shared keys."
              rows={shared.slice(0, 6).map((s) => ({
                label: <Stamp stamp={s.record.keyStamp} onClick={() => onSelectKey(s.record.keyId)} />,
                value: s.holders.size,
                title: [...s.holders].join(", "),
              }))}
            />
          </Panel>
        </div>
      )}

      {/* ── Expanded activity popup ── */}
      {expanded && (
        <Modal
          title={expanded === "issued" ? "Recently Issued" : "Recently Returned"}
          onClose={() => setExpanded(null)}
          wide
        >
          <div className="max-h-[60vh] overflow-y-auto -mx-4 -my-4">
            <MiniTable
              head={["Person", "Key", "Room", expanded === "issued" ? "Issued" : "Returned"]}
              rows={(expanded === "issued" ? issuedSorted : returnedSorted).map((r) => [
                <PersonLink record={r} onClick={(id) => { setExpanded(null); onSelectPerson(id); }} />,
                <Stamp stamp={r.keyStamp} onClick={() => { setExpanded(null); onSelectKey(r.keyId); }} />,
                <span style={{ color: DSU.darkGray }}>{roomLabel(r)}</span>,
                <Mono>{dateLabel(expanded === "issued" ? r.dateIssued : r.dateReturned)}</Mono>,
              ])}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── pieces ────────────────────────────────────────────────────────────────────

/**
 * A single stat tile: label + circular icon badge on top, big number below —
 * same card chrome as the hero and every panel, so the whole page reads as
 * one family of cards. No trend/comparison chip — there's no prior-period
 * data to back one, and a fabricated percentage would be actively misleading.
 */
function StatCard({
  icon, badgeBg, label, value, onClick,
}: {
  icon: React.ReactNode; badgeBg: string; label: string; value: number; onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const inner = (
    <>
      <div className="flex items-start justify-between mb-4">
        <span className="text-[14px] font-medium" style={{ color: DSU.midGray }}>{label}</span>
        <IconBadge icon={icon} bg={badgeBg} fg="#fff" />
      </div>
      <div className="text-[34px] font-bold leading-none tabular" style={{ color: DSU.navy }}>
        {value.toLocaleString()}
      </div>
    </>
  );
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`p-5 text-left w-full ${onClick ? "cursor-pointer" : ""}`}
      style={{
        ...CARD,
        background: hover ? DSU.tintBg : "#ffffff",
        boxShadow: hover ? shadow.lg : shadow.sm,
        transform: hover ? "translateY(-4px)" : "translateY(0)",
        transition: "background-color 180ms ease, box-shadow 220ms ease, transform 220ms ease",
      }}
    >
      {inner}
    </Tag>
  );
}

/** The featured solid-navy hero tile — same lift/shadow language as StatCard,
 *  but darkens toward navyHover instead of tinting toward the accent wash. */
function HeroStatCard({
  icon, label, value, onClick,
}: {
  icon: React.ReactNode; label: string; value: number; onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`p-5 text-left w-full ${onClick ? "cursor-pointer" : ""}`}
      style={{
        ...CARD,
        background: hover ? DSU.navyHover : DSU.navy,
        color: "#fff",
        boxShadow: hover ? shadow.lg : shadow.sm,
        transform: hover ? "translateY(-4px)" : "translateY(0)",
        transition: "background-color 180ms ease, box-shadow 220ms ease, transform 220ms ease",
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-[14px] font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>{label}</span>
        <IconBadge icon={icon} bg="#ffffff" fg={DSU.navy} />
      </div>
      <div className="text-[34px] font-bold leading-none tabular">
        {value.toLocaleString()}
      </div>
    </Tag>
  );
}

function Panel({
  title, icon, children, onExpand, total,
}: {
  title: string; icon?: React.ReactNode; children: React.ReactNode;
  onExpand?: () => void; total?: number;
}) {
  return (
    <div className="h-full flex flex-col overflow-hidden" style={CARD}>
      <div className="px-5 pt-4 pb-2 text-[18px] font-semibold flex items-center gap-2" style={{ color: DSU.navy, fontFamily: font.display }}>
        {icon && <span style={{ color: DSU.trojan }}>{icon}</span>}
        {title}
        {total !== undefined && total > 0 && (
          <span className="tabular font-normal text-[12px]" style={{ color: DSU.midGray }}>· {total.toLocaleString()}</span>
        )}
        {onExpand && (
          <button
            onClick={onExpand}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-1 transition-colors"
            style={{ color: DSU.tintText }}
            onMouseEnter={(e) => (e.currentTarget.style.background = DSU.tintBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Maximize2 size={11} /> View all
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="px-5 py-4 text-[12px]" style={{ color: DSU.midGray }}>{children}</div>
);

const Mono = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-[12px]">{children}</span>
);

/** Room text for a record, treating blanks and stray "0" placeholders as none. */
function roomLabel(r: KeyRecord): string {
  const desc = r.roomDescription?.trim();
  const num = r.roomNumber?.trim();
  const val = desc || num || "";
  return val && val !== "0" ? val : "—";
}

/** Formatted date, with the "1900-01-01" import placeholder and junk shown as "—". */
function dateLabel(iso: string | null): string {
  if (!iso || iso === "1900-01-01") return "—";
  const out = formatDate(iso);
  // A real date always formats to mm/dd/yyyy (two slashes); anything else is junk.
  return out && out.split("/").length === 3 && !out.includes("undefined") ? out : "—";
}

function Linkish({
  onClick, color = DSU.trojan, children,
}: {
  onClick: () => void; color?: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className="underline hover:no-underline font-medium" style={{ color }}>
      {children}
    </button>
  );
}

function PersonLink({ record, onClick }: { record: KeyRecord; onClick: (id: string) => void }) {
  return (
    <button
      onClick={() => onClick(record.personId)}
      className="inline-flex items-center gap-1.5 hover:underline text-left font-medium"
      style={{ color: DSU.navy }}
      title={`View ${record.personName}`}
    >
      <Avatar initials={record.initials} size={20} />
      {record.personName}
    </button>
  );
}

function MiniTable({
  head, rows, more = 0,
}: {
  head: string[]; rows: React.ReactNode[][]; more?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]" style={{ fontFamily: font.sans }}>
        <thead>
          <tr style={{ background: "#f5f6f7", borderBottom: `1px solid ${DSU.lightBorder}` }}>
            {head.map((h, i) => (
              <th
                key={h}
                className={`py-1.5 text-[11px] font-semibold whitespace-nowrap ${i === 0 ? "pl-5 pr-3" : i === head.length - 1 ? "pl-3 pr-5" : "px-3"}`}
                style={{ color: DSU.midGray, textAlign: i === head.length - 1 && head.length > 3 ? "right" : "left" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => {
            const base = i % 2 === 0 ? "#fff" : DSU.zebra;
            return (
              <tr
                key={i}
                className="dsu-row-in transition-colors"
                style={{ background: base, borderBottom: "1px solid #eaebec", animationDelay: `${Math.min(i, 10) * 18}ms` }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f0f7fc";
                  e.currentTarget.style.boxShadow = `inset 3px 0 0 ${DSU.trojan}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = base;
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {cells.map((c, j) => (
                  <td
                    key={j}
                    className={`py-1.5 whitespace-nowrap ${j === 0 ? "pl-5 pr-3" : j === cells.length - 1 ? "pl-3 pr-5" : "px-3"}`}
                    style={{ color: DSU.darkGray, textAlign: j === cells.length - 1 && cells.length > 3 ? "right" : "left" }}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            );
          })}
          {more > 0 && (
            <tr>
              <td colSpan={head.length} className="pl-5 pr-3 py-1.5 text-[11px]" style={{ color: DSU.midGray }}>
                …and {more} more
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function groupCounts(records: KeyRecord[], keyOf: (r: KeyRecord) => string) {
  const m = new Map<string, { active: number; returned: number }>();
  for (const r of records) {
    const k = keyOf(r);
    const e = m.get(k) ?? { active: 0, returned: 0 };
    if (r.isActive) e.active++;
    else e.returned++;
    m.set(k, e);
  }
  return [...m.entries()].sort((a, b) => b[1].active - a[1].active || a[0].localeCompare(b[0]));
}

/**
 * Nice gridline step (1/2/5 × a power of ten — no 2.5, so every tick stays a
 * clean integer for this app's whole-number key counts) for roughly N steps
 * across the data's max. Ticks are then built as multiples of this step,
 * never by slicing an already-rounded max into fractions — that's what
 * produced skipped/uneven labels like "0, 1, 3, 4, 5" before this fix.
 */
function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * pow;
}

/** SVG path for a bar with rounded top corners, square at the baseline. */
function topRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, Math.max(h, 0));
  if (h <= 0) return "";
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

/**
 * Horizontal bar-list chart — a different mark than the vertical ColumnChart
 * (progress-bar rows rather than SVG columns + gridlines), used where the
 * "category" is a short chip (a key stamp) rather than a name. Value sits at
 * the end of each bar, same "labelled directly, no gating on hover" rule as
 * the column chart.
 */
function HorizontalBarChart({
  rows, color, empty = "No data yet.",
}: {
  rows: { label: React.ReactNode; value: number; title?: string }[];
  color: string;
  empty?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="px-5 pb-4 pt-1 flex flex-col gap-3">
      {rows.map((r, i) => {
        const pct = Math.max(6, (r.value / max) * 100);
        const isHover = hover === i;
        return (
          <div
            key={i}
            className="flex items-center gap-3 cursor-pointer"
            tabIndex={0}
            role="button"
            title={r.title}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          >
            <div className="w-[52px] shrink-0">{r.label}</div>
            <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "#eef1f3" }}>
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${pct}%`, background: color, opacity: isHover ? 1 : 0.8 }}
              />
            </div>
            <div className="w-6 shrink-0 text-[12px] font-semibold tabular text-right" style={{ color: DSU.navy }}>
              {r.value.toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Vertical column chart: hairline gridlines, thin rounded-cap columns in a
 * de-emphasised tint by default, and a per-bar hover/focus state that lifts
 * the hovered column to its full categorical color with a tooltip — "gray
 * until you point at it," not eight loud hues doing the emphasis job color
 * shouldn't. One hue per chart; buildings/departments have no natural rank,
 * so every bar shares the same color at rest (see dataviz anti-patterns).
 */
function ColumnChart({
  rows, color, tint, empty = "No data yet.",
}: {
  rows: [string, number][]; color: string; tint: string; empty?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const patternId = useId();
  if (rows.length === 0) return <Empty>{empty}</Empty>;

  const W = 600, H = 220;
  const padL = 34, padR = 8, padT = 10, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const step = niceStep(Math.max(1, ...rows.map(([, v]) => v)) / 4);
  const max = step * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);
  const slot = plotW / rows.length;
  const barW = Math.min(44, slot * 0.62);
  // The largest column stays in full color at rest — a permanent "the leader"
  // emphasis (one bar, not a rank-ramp) — every other bar still starts in the
  // de-emphasised tint and only lifts to full color on hover/focus.
  const maxIdx = rows.reduce((best, row, i) => (row[1] > rows[best][1] ? i : best), 0);

  const active = hover !== null ? rows[hover] : null;
  const activeX = hover !== null ? padL + slot * (hover + 0.5) : 0;
  const activeTopY = hover !== null ? padT + plotH * (1 - rows[hover][1] / max) : 0;
  // %-of-viewBox positioning: the wrapper below has no padding of its own, so
  // these percentages land exactly on the SVG's box — no left/top drift.
  const tipLeftPct = (activeX / W) * 100;
  const tipTopPct = (activeTopY / H) * 100;

  return (
    <div className="px-5 pb-4">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="block overflow-visible" role="img" aria-label="Column chart">
          <defs>
            {/* 45° hatch — decorative hover-only accent on the single active bar, not a permanent encoding */}
            <pattern id={`${patternId}-hatch`} width={6} height={6} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <rect width={6} height={6} fill={color} />
              <line x1={0} y1={0} x2={0} y2={6} stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
            </pattern>
          </defs>
          {/* gridlines, one step off the surface, solid hairline */}
          {ticks.map((t, i) => {
            const y = padT + plotH * (1 - i / 4);
            return (
              <g key={t}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#eef1f3" strokeWidth={1} />
                <text x={padL - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={9} fill={DSU.midGray}>
                  {t.toLocaleString()}
                </text>
              </g>
            );
          })}

          {rows.map(([name, val], i) => {
            const cx = padL + slot * (i + 0.5);
            const h = (val / max) * plotH;
            const y = padT + plotH - h;
            const isHover = hover === i;
            const isLeader = i === maxIdx;
            return (
              <g
                key={name}
                tabIndex={0}
                role="button"
                aria-label={`${name}: ${val.toLocaleString()}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                style={{ cursor: "pointer", outline: "none" }}
              >
                {/* full-column hit area — bigger than the visible bar, per dataviz interaction spec */}
                <rect x={padL + slot * i} y={padT} width={slot} height={plotH} fill="transparent" />
                <path
                  d={topRoundedRect(cx - barW / 2, y, barW, h, 4)}
                  fill={isHover ? `url(#${patternId}-hatch)` : isLeader ? color : tint}
                  className="transition-colors duration-150"
                />
                {isHover && (
                  <circle cx={cx} cy={y} r={4} fill="#fff" stroke={color} strokeWidth={2} />
                )}
                <text x={cx} y={H - 8} textAnchor="middle" fontSize={8} fill={DSU.midGray}>
                  {name.length > 12 ? `${name.slice(0, 11)}…` : name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip — enhances, doesn't gate: category + value are already on the axis/legend. */}
        {active && (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              left: `${tipLeftPct}%`,
              top: `${tipTopPct}%`,
              transform: "translate(-50%, calc(-100% - 12px))",
            }}
          >
            <div
              className="px-3 py-2 rounded-xl text-[11px] whitespace-nowrap"
              style={{ background: DSU.navy, color: "#fff", boxShadow: shadow.md }}
            >
              <div className="font-semibold flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
                {active[0]}
              </div>
              <div className="tabular mt-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>{active[1].toLocaleString()} keys out</div>
            </div>
            <div
              className="absolute left-1/2"
              style={{ bottom: -4, width: 8, height: 8, background: DSU.navy, transform: "translateX(-50%) rotate(45deg)", borderRadius: 2 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Donut chart from stacked SVG arcs, with a centred total, a legend, and an
 * optional pair of mini stat tiles below (an inset light-gray strip) — the
 * same "key numbers restated near the chart" pattern the reference uses under
 * its gauge.
 */
function Donut({
  segments, tiles,
}: {
  segments: { label: string; value: number; color: string }[];
  tiles?: { label: string; value: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId();
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const size = 208, stroke = 38, r = (size - stroke) / 2, circ = 2 * Math.PI * r, cx = size / 2, cy = size / 2;
  const gap = 3; // surface gap between segments, in dash-length units

  // Precompute each arc's dash + a mid-angle point (for the hover tooltip),
  // in the SAME rotated frame the arcs are drawn in (start at 12 o'clock).
  let acc = 0;
  const arcs = segments.map((seg) => {
    const raw = (seg.value / total) * circ;
    const dash = Math.max(raw - gap, 0);
    const start = acc;
    acc += raw;
    const midFrac = (start + dash / 2) / circ;
    const angle = -90 + midFrac * 360;
    const rad = (angle * Math.PI) / 180;
    return { ...seg, dash, offset: -start, x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  });

  const active = hover !== null ? { ...arcs[hover], pct: Math.round((arcs[hover].value / total) * 100) } : null;
  // Faint tick marks at the quarter-points give the ring a "gauge" reading,
  // purely decorative (not a value encoding) so they sit under everything.
  const ticks = [0, 25, 50, 75].map((pct) => -90 + (pct / 100) * 360);

  return (
    <div className="px-5 py-4 h-full flex flex-col justify-center">
      <div className="flex flex-col md:flex-row gap-4 items-center">
        {/* Left — the donut is the card's dominant visual element, with its
            dot-legend riding directly beneath it. Half the card's width, same
            as the tile column, so the two sides read as a deliberate split. */}
        <div className="flex flex-col items-center flex-1 basis-1/2 min-w-0">
        <div className="relative dsu-pop-in w-full" style={{ maxWidth: size, aspectRatio: "1 / 1" }}>
          <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" role="img" aria-label="Out versus returned" className="overflow-visible">
            <defs>
              {arcs.map((a, i) => (
                <linearGradient key={i} id={`${gradientId}-g${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={`color-mix(in srgb, ${a.color} 68%, white)`} />
                  <stop offset="100%" stopColor={a.color} />
                </linearGradient>
              ))}
              <filter id={`${gradientId}-lift`} x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={arcs[0]?.color ?? DSU.navy} floodOpacity="0.35" />
              </filter>
            </defs>

            {/* quarter-point gauge ticks, recessive — decoration, not data */}
            {ticks.map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const inner = r - stroke / 2 - 3, outer = r + stroke / 2 + 3;
              return (
                <line
                  key={deg}
                  x1={cx + inner * Math.cos(rad)} y1={cy + inner * Math.sin(rad)}
                  x2={cx + outer * Math.cos(rad)} y2={cy + outer * Math.sin(rad)}
                  stroke="#e4e9ec" strokeWidth={2} strokeLinecap="round"
                />
              );
            })}

            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef1f3" strokeWidth={stroke} />
            {arcs.map((a, i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={`url(#${gradientId}-g${i})`}
                strokeWidth={hover === i ? stroke + 4 : stroke}
                strokeLinecap="round"
                strokeDasharray={`${a.dash} ${circ - a.dash}`}
                strokeDashoffset={a.offset}
                transform={`rotate(-90 ${cx} ${cy})`}
                filter={hover === i ? `url(#${gradientId}-lift)` : undefined}
                className="transition-[stroke-width] duration-150"
                style={{ cursor: "pointer" }}
                tabIndex={0}
                role="button"
                aria-label={`${a.label}: ${a.value.toLocaleString()} (${Math.round((a.value / total) * 100)}%)`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            ))}
            {hover !== null && (
              <circle
                cx={arcs[hover].x} cy={arcs[hover].y} r={5}
                fill="#fff" stroke={arcs[hover].color} strokeWidth={2.5}
                className="pointer-events-none"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="tabular" style={{ fontFamily: font.display, fontSize: 28, fontWeight: 600, color: DSU.navy }}>
              {total.toLocaleString()}
            </span>
            <span className="text-[10px] mt-0.5" style={{ letterSpacing: "0.08em", color: DSU.midGray }}>TOTAL</span>
          </div>

          {active && (
            <div
              className="absolute px-2.5 py-1.5 rounded-lg text-[11px] pointer-events-none whitespace-nowrap z-10"
              style={{
                left: `${(active.x / size) * 100}%`,
                top: `${(active.y / size) * 100}%`,
                transform: "translate(-50%, -50%)",
                background: DSU.navy,
                color: "#fff",
                boxShadow: shadow.md,
              }}
            >
              <div className="font-semibold">{active.value.toLocaleString()} <span className="font-normal" style={{ color: "rgba(255,255,255,0.75)" }}>({active.pct}%)</span></div>
              <div style={{ color: "rgba(255,255,255,0.75)" }}>{active.label}</div>
            </div>
          )}
        </div>

        {/* Simple two-line legend — a colored dot, the label, and its value. */}
        <div className="flex flex-col gap-2 items-center mt-4">
          {segments.map((seg, i) => (
            <div
              key={seg.label}
              className="flex items-center gap-2 text-[12px] cursor-pointer"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color, opacity: hover === null || hover === i ? 1 : 0.45 }} />
              <span style={{ color: DSU.darkGray }}>{seg.label}</span>
              <span className="font-semibold tabular" style={{ color: DSU.navy }}>{seg.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
        </div>

        {/* Right — the same shaded stat tiles from the original card, re-flowed
            into a single vertical column instead of a 2x2 grid. */}
        {tiles && tiles.length > 0 && (
          <div className="flex flex-col gap-2.5 flex-1 basis-1/2 min-w-0 w-full">
            {tiles.map((t) => (
              <div key={t.label} className="px-4 py-3 rounded-xl" style={{ background: "#f7f9fa" }}>
                <div className="text-[14px]" style={{ fontFamily: font.display, color: DSU.midGray }}>{t.label}</div>
                <div className="text-[22px] font-bold tabular mt-0.5" style={{ color: DSU.navy }}>{t.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

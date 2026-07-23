import { useMemo, useRef, useState } from "react";
import { Users, ArrowUpRight, ArrowDownLeft, Search, Maximize2, Building2, Briefcase, PieChart, Plus, Undo2 } from "lucide-react";
import type { KeyRecord, Snapshot } from "../../lib/types";
import { DSU, formatDate, isStampQuery, radius, font, shadow } from "../theme";
import { Avatar, Button, Modal, SectionHeader, Stamp } from "../components/primitives";

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
      {/* ── Masthead ── One surface: the headline number on the left, the
          supporting metrics as a divider-separated row on the right. No grid
          of identical cards. */}
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
        <div
          className="relative mb-12 -mx-4 sm:-mx-6 -mt-5"
          style={{ background: "#ffffff", boxShadow: shadow.md, borderTop: `2px solid ${DSU.trojan}` }}
        >
          <HexWatermark />
          <div className="relative px-4 sm:px-8 lg:px-12 pt-8 pb-14">
          <div className="mb-12 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
          {/* Headline figure */}
          <div>
            <div
              className="text-[11px] font-semibold uppercase mb-1.5"
              style={{ color: DSU.trojan, letterSpacing: "0.14em" }}
            >
              Out on loan right now
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span
                className="leading-none tabular"
                style={{ fontFamily: font.display, fontSize: "clamp(46px, 7vw, 72px)", fontWeight: 600, color: DSU.navy }}
              >
                {active.length.toLocaleString()}
              </span>
              <span className="text-[16px]" style={{ color: DSU.darkGray }}>
                {active.length === 1 ? "key" : "keys"} in {copiesOut.toLocaleString()}{" "}
                {copiesOut === 1 ? "copy" : "copies"}
              </span>
            </div>
            <p className="text-[13px] mt-2.5" style={{ color: DSU.midGray }}>
              held by{" "}
              <Linkish onClick={() => onGoToTab("directory")}>{holders.toLocaleString()} {holders === 1 ? "person" : "people"}</Linkish>
              {buildings > 0 && <> across {buildings.toLocaleString()} building{buildings === 1 ? "" : "s"}</>}.
            </p>
          </div>

          {/* Supporting metrics — inline, split by hairlines, not boxed. */}
          <div className="flex items-stretch">
            <Metric label="Holders" value={holders} onClick={() => onGoToTab("directory")} first />
            <Metric label="Catalog" value={snapshot.keys.length} onClick={() => onGoToTab("keys")} />
            <Metric label="Buildings" value={buildings} />
            <Metric label="Returned" value={returned.length} onClick={() => onGoToTab("returned")} />
          </div>
        </div>

          {/* Search + key actions, sharing the same command surface. */}
          <div className="pt-8 flex flex-col items-center gap-6">
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
          </div>
        </div>
      )}

      {/* ── Recent activity ── */}
      {!empty && (
        <div className="mb-14">
          <SectionHeader title="Recent Activity" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel
              title="Recently Issued"
              icon={<ArrowUpRight size={13} />}
              onExpand={issuedSorted.length > 6 ? () => setExpanded("issued") : undefined}
              total={issuedSorted.length}
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
              total={returnedSorted.length}
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

      {/* ── Breakdowns ── */}
      {!empty && (
        <div>
          <SectionHeader title="Breakdown" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Keys Out by Building" icon={<Building2 size={13} />}>
              <BarChart rows={buildingBars} color={DSU.navy} empty="No keys out." />
            </Panel>
            <Panel title="Keys Out by Department" icon={<Briefcase size={13} />}>
              <BarChart rows={deptBars} color={DSU.trojan} empty="No keys out." />
            </Panel>
            <Panel title="Out vs Returned" icon={<PieChart size={13} />}>
              <Donut
                segments={[
                  { label: "Out now", value: active.length, color: DSU.trojan },
                  { label: "Returned", value: returned.length, color: DSU.navy },
                ]}
              />
            </Panel>
            {shared.length > 0 && (
              <Panel title="Most Shared Keys" icon={<Users size={13} />}>
                <MiniTable
                  head={["Key", "Room", "Holders"]}
                  rows={shared.slice(0, 6).map((s) => [
                    <Stamp stamp={s.record.keyStamp} onClick={() => onSelectKey(s.record.keyId)} />,
                    s.record.roomDescription || s.record.roomNumber || "—",
                    <span title={[...s.holders].join(", ")}>{s.holders.size} people</span>,
                  ])}
                  more={shared.length > 6 ? shared.length - 6 : 0}
                />
              </Panel>
            )}
          </div>
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
 * Faint DSU honeycomb texture for light surfaces — the brand manual's signature
 * hexagon motif, in a barely-there navy tint. Gives the command panel some
 * crafted brand character instead of a flat white void.
 */
function HexWatermark() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='64'%3E%3Cpath d='M28 4L52 18v28L28 60 4 46V18Z' stroke='rgba(0,65,101,0.05)' stroke-width='1' fill='none'/%3E%3C/svg%3E\")",
        backgroundSize: "56px 64px",
        maskImage: "radial-gradient(circle at 50% 42%, #000 0%, rgba(0,0,0,0.55) 55%, transparent 82%)",
        WebkitMaskImage: "radial-gradient(circle at 50% 42%, #000 0%, rgba(0,0,0,0.55) 55%, transparent 82%)",
      }}
    />
  );
}

/**
 * A single supporting metric in the masthead row. These sit side by side split
 * only by a hairline rule — deliberately not individual cards, so the header
 * reads as one composed unit rather than a grid of boxes.
 */
function Metric({
  label, value, onClick, first,
}: {
  label: string; value: number; onClick?: () => void; first?: boolean;
}) {
  const inner = (
    <>
      <div className="text-[26px] font-bold leading-none tabular" style={{ color: DSU.navy }}>
        {value.toLocaleString()}
      </div>
      <div className="text-[11px] font-medium mt-1 uppercase" style={{ color: DSU.midGray, letterSpacing: "0.06em" }}>
        {label}
      </div>
    </>
  );
  const divider: React.CSSProperties = first ? {} : { borderLeft: `1px solid #e3e7ea` };
  if (!onClick) return <div className="px-4 sm:px-5 py-1" style={divider}>{inner}</div>;
  return (
    <button
      onClick={onClick}
      className="px-4 sm:px-5 py-1 text-left"
      style={divider}
      onMouseEnter={(e) => { e.currentTarget.querySelector("span")!.style.color = DSU.trojan; }}
      onMouseLeave={(e) => { e.currentTarget.querySelector("span")!.style.color = DSU.midGray; }}
    >
      <div className="text-[26px] font-bold leading-none tabular" style={{ color: DSU.navy }}>
        {value.toLocaleString()}
      </div>
      <span
        className="block text-[11px] font-medium mt-1 uppercase transition-colors"
        style={{ color: DSU.midGray, letterSpacing: "0.06em" }}
      >
        {label}
      </span>
    </button>
  );
}

function Panel({
  title, icon, children, onExpand, total,
}: {
  title: string; icon?: React.ReactNode; children: React.ReactNode;
  onExpand?: () => void; total?: number;
}) {
  return (
    <div
      className="bg-white overflow-hidden"
      style={{ boxShadow: shadow.md, borderRadius: radius.lg }}
    >
      <div
        className="px-4 py-2.5 text-[12px] font-semibold flex items-center gap-1.5"
        style={{ color: DSU.navy, borderBottom: `1px solid #eef1f3` }}
      >
        {icon && <span style={{ color: DSU.trojan }}>{icon}</span>}
        {title}
        {total !== undefined && total > 0 && (
          <span className="tabular font-normal" style={{ color: DSU.midGray }}>· {total.toLocaleString()}</span>
        )}
        {onExpand && (
          <button
            onClick={onExpand}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium rounded px-1.5 py-0.5 transition-colors"
            style={{ color: DSU.tintText }}
            onMouseEnter={(e) => (e.currentTarget.style.background = DSU.tintBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Maximize2 size={11} /> View all
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="px-3 py-4 text-[12px]" style={{ color: DSU.midGray }}>{children}</div>
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
      <table className="w-full text-[13px]">
        <thead>
          <tr style={{ background: "#f5f6f7", borderBottom: `1px solid ${DSU.lightBorder}` }}>
            {head.map((h, i) => (
              <th
                key={h}
                className="px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap"
                style={{ color: DSU.midGray, textAlign: i === head.length - 1 && head.length > 3 ? "right" : "left" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : DSU.zebra, borderBottom: "1px solid #eaebec" }}>
              {cells.map((c, j) => (
                <td
                  key={j}
                  className="px-3 py-1.5 whitespace-nowrap"
                  style={{ color: DSU.darkGray, textAlign: j === cells.length - 1 && cells.length > 3 ? "right" : "left" }}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
          {more > 0 && (
            <tr>
              <td colSpan={head.length} className="px-3 py-1.5 text-[11px]" style={{ color: DSU.midGray }}>
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

/** Horizontal bar chart — pure CSS, no chart library. Bars scale to the max. */
function BarChart({
  rows, color, empty = "No data yet.",
}: {
  rows: [string, number][]; color: string; empty?: string;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <div className="px-4 py-3.5 flex flex-col gap-2.5">
      {rows.map(([name, val]) => (
        <div key={name} className="flex items-center gap-2.5 text-[12px]">
          <div className="w-[104px] shrink-0 truncate" style={{ color: DSU.darkGray }} title={name}>{name}</div>
          <div className="flex-1 h-[17px] rounded-sm overflow-hidden" style={{ background: "#eef1f3" }}>
            <div
              className="h-full rounded-sm flex items-center justify-end pr-1.5 transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max((val / max) * 100, 7)}%`, background: color }}
            >
              <span className="text-[10px] font-semibold text-white tabular">{val}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Donut chart from stacked SVG arcs, with a centred total and a legend. */
function Donut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const size = 132, stroke = 18, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="px-4 py-4 flex items-center gap-5 flex-wrap">
      <svg width={size} height={size} className="shrink-0" role="img" aria-label="Out versus returned">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1f3" strokeWidth={stroke} />
          {segments.map((seg, i) => {
            const dash = (seg.value / total) * circ;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-acc}
              />
            );
            acc += dash;
            return el;
          })}
        </g>
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: font.display, fontSize: 26, fontWeight: 600, fill: DSU.navy }}>
          {total.toLocaleString()}
        </text>
        <text x="50%" y="62%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10, letterSpacing: "0.08em", fill: DSU.midGray }}>
          TOTAL
        </text>
      </svg>
      <div className="flex flex-col gap-2.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-[12px]">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: seg.color }} />
            <span style={{ color: DSU.darkGray }}>{seg.label}</span>
            <span className="font-semibold tabular" style={{ color: DSU.navy }}>{seg.value.toLocaleString()}</span>
            <span className="tabular" style={{ color: DSU.midGray }}>({Math.round((seg.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { ArrowLeft, Building2, Briefcase, KeyRound, Users, Undo2 } from "lucide-react";
import type { KeyRecord } from "../../lib/types";
import { DSU, font, shadow } from "../theme";
import { KeyTable, sortRecords, type RowActions, type SortCol, type SortDir } from "./KeyTable";

/** Same white-card chrome as the Dashboard's stat tiles and panels — no
 *  hairline border, just a soft shadow and generous rounding. */
const CARD: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  boxShadow: shadow.sm,
};

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
 * A building or a department, viewed the same way a person or a key is:
 * masthead + stat tiles + the full record history, reached by clicking the
 * building/department text anywhere it appears. One component for both,
 * since "every key/assignment where this field matches" is the same shape
 * of page either way — only the icon, eyebrow, and matched field differ.
 */
export function GroupView({
  kind, name, records, actions, onBack, backLabel, onSelectPerson, onSelectKey,
}: {
  kind: "building" | "department";
  name: string;
  /** Already filtered to this building/department, active and returned. */
  records: KeyRecord[];
  actions: RowActions;
  onBack: () => void;
  backLabel: string;
  onSelectPerson: (personId: string) => void;
  onSelectKey: (keyId: string) => void;
}) {
  const [sortCol, setSortCol] = useState<SortCol>("dateIssued");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [heroHover, setHeroHover] = useState(false);

  const active = useMemo(() => records.filter((r) => r.isActive), [records]);
  const returned = useMemo(() => records.filter((r) => !r.isActive), [records]);
  const people = useMemo(() => new Set(records.map((r) => r.personId)).size, [records]);
  const keys = useMemo(() => new Set(records.map((r) => r.keyId)).size, [records]);
  const copiesOut = active.reduce((sum, r) => sum + r.numKeys, 0);

  const sorted = useMemo(() => sortRecords(records, sortCol, sortDir), [records, sortCol, sortDir]);
  const handleSort = (col: SortCol) => {
    setSortDir((d) => (col === sortCol ? (d === "asc" ? "desc" : "asc") : "asc"));
    setSortCol(col);
  };

  const isBuilding = kind === "building";
  const Icon = isBuilding ? Building2 : Briefcase;

  return (
    <div className="dsu-fade-in">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] mb-4 transition-colors hover:underline"
        style={{ color: DSU.trojan }}
      >
        <ArrowLeft size={13} /> Back to {backLabel}
      </button>

      {/* ── Masthead ── same rounded shadow-card language as Person/Key. */}
      <div className="p-5 sm:p-6 mb-4" style={CARD}>
        <div className="flex items-start gap-4 min-w-0">
          <div
            className="flex items-center justify-center flex-shrink-0 rounded-2xl"
            style={{ width: 56, height: 56, background: DSU.navy, boxShadow: shadow.sm }}
          >
            <Icon size={24} color="#fff" />
          </div>
          <div className="min-w-0">
            <div
              className="text-[11px] font-semibold uppercase mb-1"
              style={{ color: DSU.trojan, letterSpacing: "0.14em" }}
            >
              {isBuilding ? "Building" : "Department"}
            </div>
            <h1 className="text-[26px] font-semibold leading-tight truncate" style={{ fontFamily: font.display, color: DSU.navy }}>
              {name}
            </h1>
          </div>
        </div>
      </div>

      {/* ── Stat tiles ── */}
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
            <span className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>Keys Out</span>
            <IconBadge icon={<KeyRound size={14} />} bg="#ffffff" fg={DSU.navy} />
          </div>
          <div className="text-[24px] font-bold leading-none tabular">{active.length.toLocaleString()}</div>
          <p className="text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.7)" }}>
            {copiesOut.toLocaleString()} physical cop{copiesOut === 1 ? "y" : "ies"}
          </p>
        </div>

        <StatTile icon={<Users size={14} />} badgeBg={DSU.trojan} label="People" value={people} sub="hold or held a key" />
        <StatTile icon={<KeyRound size={14} />} badgeBg={DSU.navy} label="Keys" value={keys} sub="distinct stamps" />
        <StatTile icon={<Undo2 size={14} />} badgeBg={DSU.trojan} label="Returned" value={returned.length} sub="in history" />
      </div>

      {/* ── Full record history ── */}
      <KeyTable
        records={sorted}
        sortCol={sortCol}
        sortDir={sortDir}
        onSort={handleSort}
        showPerson
        actions={actions}
        onSelectPerson={onSelectPerson}
        onSelectKey={onSelectKey}
        emptyMessage={`No records for ${name}.`}
      />
    </div>
  );
}

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
      <p className="text-[11px] mt-2 truncate" style={{ color: DSU.midGray }}>{sub}</p>
    </div>
  );
}

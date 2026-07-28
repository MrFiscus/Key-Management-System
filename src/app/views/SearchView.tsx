import { useMemo } from "react";
import { Key, Search, ChevronRight, Building2, Briefcase } from "lucide-react";
import type { KeyRecord } from "../../lib/types";
import { DSU, isStampQuery, radius, font, shadow } from "../theme";
import { Avatar, SectionHeader } from "../components/primitives";
import { KeyTable, sortRecords, type RowActions, type SortCol, type SortDir } from "./KeyTable";

/**
 * Search results. A query that looks like a stamp (2A.9) matches key stamps
 * exactly; anything else is a substring match across person, room, building,
 * and department — so one search box reaches everything that has a page.
 */
export function SearchView({
  query, records, sortCol, sortDir, onSort, actions, onSelectPerson, onSelectKey,
  onSelectBuilding, onSelectDepartment,
}: {
  query: string;
  records: KeyRecord[];
  sortCol: SortCol;
  sortDir: SortDir;
  onSort: (c: SortCol) => void;
  actions: RowActions;
  onSelectPerson: (personId: string) => void;
  onSelectKey: (keyId: string) => void;
  onSelectBuilding?: (name: string) => void;
  onSelectDepartment?: (name: string) => void;
}) {
  const trimmed = query.trim();
  const isStamp = isStampQuery(trimmed);

  const matched = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (isStamp) return records.filter((r) => r.keyStamp.toLowerCase() === q);
    return records.filter((r) =>
      [r.personName, r.keyStamp, r.roomNumber, r.roomDescription, r.building, r.department, r.notes]
        .some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [records, trimmed, isStamp]);

  const sorted = useMemo(() => sortRecords(matched, sortCol, sortDir), [matched, sortCol, sortDir]);

  /** One card per distinct person in the results. */
  const holders = useMemo(() => {
    const byPerson = new Map<string, { record: KeyRecord; active: number; total: number }>();
    for (const r of matched) {
      const entry = byPerson.get(r.personId) ?? { record: r, active: 0, total: 0 };
      entry.total++;
      if (r.isActive) entry.active++;
      byPerson.set(r.personId, entry);
    }
    return [...byPerson.values()].sort((a, b) => b.active - a.active);
  }, [matched]);

  /** Buildings/departments whose name itself matches the query — a quick jump
   *  straight to that group's page, same idea as the person holder cards. */
  const buildingHits = useMemo(() => {
    if (isStamp || !trimmed) return [];
    const q = trimmed.toLowerCase();
    const byName = new Map<string, { active: number; total: number }>();
    for (const r of records) {
      if (!r.building || !r.building.toLowerCase().includes(q)) continue;
      const e = byName.get(r.building) ?? { active: 0, total: 0 };
      e.total++;
      if (r.isActive) e.active++;
      byName.set(r.building, e);
    }
    return [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [records, trimmed, isStamp]);

  const departmentHits = useMemo(() => {
    if (isStamp || !trimmed) return [];
    const q = trimmed.toLowerCase();
    const byName = new Map<string, { active: number; total: number }>();
    for (const r of records) {
      if (!r.department || !r.department.toLowerCase().includes(q)) continue;
      const e = byName.get(r.department) ?? { active: 0, total: 0 };
      e.total++;
      if (r.isActive) e.active++;
      byName.set(r.department, e);
    }
    return [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [records, trimmed, isStamp]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-[13px] flex-wrap" style={{ color: DSU.midGray }}>
        Showing results for
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium text-[12px]"
          style={{ background: "#e6f5fc", color: DSU.navy, border: "1px solid #b8dff4" }}
        >
          {isStamp ? <Key size={11} /> : <Search size={11} />}
          {trimmed}
        </span>
        — {matched.length} record{matched.length !== 1 ? "s" : ""}
        {isStamp && (
          <span className="text-[12px]" style={{ color: "#9a9c9f" }}>
            (searched key stamps)
          </span>
        )}
      </div>

      {isStamp && matched.length > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded border mb-4 text-[13px] flex-wrap"
          style={{ background: "#f0f8fe", borderColor: "#b8dff4" }}
        >
          <Key size={16} style={{ color: DSU.trojan }} />
          <div>
            <span className="font-semibold font-mono text-[15px]" style={{ color: DSU.navy }}>{trimmed}</span>
            <span className="ml-3" style={{ color: DSU.midGray }}>
              {matched[0].roomDescription || "—"} · {matched[0].building || "—"}
            </span>
          </div>
          <div className="flex-1" />
          <span className="text-[12px]" style={{ color: DSU.midGray }}>
            Held by {holders.filter((h) => h.active > 0).length} {holders.filter((h) => h.active > 0).length === 1 ? "person" : "people"} right now
          </span>
        </div>
      )}

      {(buildingHits.length > 0 || departmentHits.length > 0) && (
        <div className="mb-4">
          <SectionHeader title="Buildings & Departments" />
          <div className="flex flex-wrap gap-2">
            {buildingHits.map(([name, counts]) => (
              <button
                key={`b:${name}`}
                onClick={() => onSelectBuilding?.(name)}
                disabled={!onSelectBuilding}
                className="flex items-center gap-2 px-3 py-2 bg-white rounded border text-left hover:bg-black/[0.02] transition-colors disabled:cursor-default"
                style={{ borderColor: DSU.lightBorder, boxShadow: shadow.md, borderRadius: radius.lg }}
              >
                <Building2 size={14} style={{ color: DSU.trojan }} />
                <span className="text-[13px] font-medium" style={{ color: DSU.navy }}>{name}</span>
                <span className="text-[11px]" style={{ color: DSU.midGray }}>{counts.active} out</span>
              </button>
            ))}
            {departmentHits.map(([name, counts]) => (
              <button
                key={`d:${name}`}
                onClick={() => onSelectDepartment?.(name)}
                disabled={!onSelectDepartment}
                className="flex items-center gap-2 px-3 py-2 bg-white rounded border text-left hover:bg-black/[0.02] transition-colors disabled:cursor-default"
                style={{ borderColor: DSU.lightBorder, boxShadow: shadow.md, borderRadius: radius.lg }}
              >
                <Briefcase size={14} style={{ color: DSU.trojan }} />
                <span className="text-[13px] font-medium" style={{ color: DSU.navy }}>{name}</span>
                <span className="text-[11px]" style={{ color: DSU.midGray }}>{counts.active} out</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {holders.length > 0 && (
        <div className="mb-4">
          <SectionHeader
            title={
              isStamp
                ? `Assigned to ${holders.length} ${holders.length === 1 ? "person" : "people"}`
                : holders.length === 1 ? "Key Holder" : "Key Holders"
            }
          />
          <div className="flex flex-col gap-1">
            {holders.map(({ record, active, total }) => (
              <div
                key={record.personId}
                className="flex items-start gap-4 p-4 bg-white rounded border"
                style={{ borderColor: DSU.lightBorder, boxShadow: shadow.md, borderRadius: radius.lg }}
              >
                <button onClick={() => onSelectPerson(record.personId)} title={`View ${record.personName}`}>
                  <Avatar initials={record.initials} size={60} />
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => onSelectPerson(record.personId)}
                    className="text-[20px] font-semibold leading-tight text-left hover:underline"
                    style={{ fontFamily: font.display, color: DSU.navy }}
                    title={`View ${record.personName}`}
                  >
                    {record.personName}
                  </button>
                  <div className="flex items-center gap-1 mt-0.5 text-[13px]" style={{ color: DSU.darkGray }}>
                    {record.department ? (
                      onSelectDepartment ? (
                        <button onClick={() => onSelectDepartment(record.department)} className="hover:underline" style={{ font: "inherit" }}>
                          {record.department}
                        </button>
                      ) : record.department
                    ) : "—"}
                    <ChevronRight size={12} style={{ color: DSU.midGray }} />
                    {record.building ? (
                      onSelectBuilding ? (
                        <button onClick={() => onSelectBuilding(record.building)} className="hover:underline" style={{ font: "inherit" }}>
                          {record.building}
                        </button>
                      ) : record.building
                    ) : "—"}
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[11px] px-1.5 py-px rounded-sm font-medium"
                      style={{ background: "#daf0fa", color: "#006a96" }}
                    >
                      {active} active key{active !== 1 ? "s" : ""}
                    </span>
                    {total > active && (
                      <span className="text-[11px]" style={{ color: DSU.midGray }}>
                        {total - active} returned
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <SectionHeader title="Key Records" count={sorted.length} />
      <KeyTable
        records={sorted}
        sortCol={sortCol}
        sortDir={sortDir}
        onSort={onSort}
        showPerson={isStamp || holders.length > 1}
        actions={actions}
        onSelectPerson={onSelectPerson}
        onSelectKey={onSelectKey}
        onSelectBuilding={onSelectBuilding}
        onSelectDepartment={onSelectDepartment}
        emptyMessage={`Nothing matched "${trimmed}".`}
      />
    </div>
  );
}

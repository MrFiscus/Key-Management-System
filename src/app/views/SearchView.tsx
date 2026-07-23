import { useMemo } from "react";
import { Key, Search, ChevronRight } from "lucide-react";
import type { KeyRecord } from "../../lib/types";
import { DSU, isStampQuery, radius, font, shadow } from "../theme";
import { Avatar, SectionHeader } from "../components/primitives";
import { KeyTable, sortRecords, type RowActions, type SortCol, type SortDir } from "./KeyTable";

/**
 * Search results. A query that looks like a stamp (2A.9) matches key stamps
 * exactly; anything else is a substring match on person names.
 */
export function SearchView({
  query, records, sortCol, sortDir, onSort, actions, onSelectPerson, onSelectKey,
}: {
  query: string;
  records: KeyRecord[];
  sortCol: SortCol;
  sortDir: SortDir;
  onSort: (c: SortCol) => void;
  actions: RowActions;
  onSelectPerson: (personId: string) => void;
  onSelectKey: (keyId: string) => void;
}) {
  const trimmed = query.trim();
  const isStamp = isStampQuery(trimmed);

  const matched = useMemo(() => {
    const q = trimmed.toLowerCase();
    return records.filter((r) =>
      isStamp ? r.keyStamp.toLowerCase() === q : r.personName.toLowerCase().includes(q),
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
                    {record.department || "—"}
                    <ChevronRight size={12} style={{ color: DSU.midGray }} />
                    {record.building || "—"}
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
        emptyMessage={`Nothing matched "${trimmed}".`}
      />
    </div>
  );
}

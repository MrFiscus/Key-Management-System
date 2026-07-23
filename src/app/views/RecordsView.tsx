import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { KeyRecord } from "../../lib/types";
import { DSU } from "../theme";
import { Button, SectionHeader, SelectInput, TextInput } from "../components/primitives";
import { KeyTable, sortRecords, type RowActions, type SortCol, type SortDir } from "./KeyTable";

/**
 * Flat, filterable list of key records. Used for both the Active and Returned
 * tabs — the caller decides which records to hand in, so neither tab needs its
 * own status filter.
 */
export function RecordsView({
  title, records, sortCol, sortDir, onSort, actions, onSelectPerson, onSelectKey, emptyMessage,
}: {
  title: string;
  records: KeyRecord[];
  sortCol: SortCol;
  sortDir: SortDir;
  onSort: (c: SortCol) => void;
  actions: RowActions;
  onSelectPerson?: (personId: string) => void;
  onSelectKey?: (keyId: string) => void;
  emptyMessage: string;
}) {
  const [building, setBuilding] = useState("");
  const [dept, setDept] = useState("");
  const [search, setSearch] = useState("");

  // Options come from the records actually in view, so a filter can never be
  // set to something that yields nothing.
  const buildings = useMemo(
    () => [...new Set(records.map((r) => r.building).filter(Boolean))].sort(),
    [records],
  );
  const departments = useMemo(
    () => [...new Set(records.map((r) => r.department).filter(Boolean))].sort(),
    [records],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = records.filter((r) => {
      if (building && r.building !== building) return false;
      if (dept && r.department !== dept) return false;
      if (!q) return true;
      return [r.personName, r.keyStamp, r.roomNumber, r.roomDescription]
        .some((v) => (v ?? "").toLowerCase().includes(q));
    });
    return sortRecords(base, sortCol, sortDir);
  }, [records, building, dept, search, sortCol, sortDir]);

  const hasFilter = Boolean(building || dept || search);

  return (
    <div>
      <SectionHeader title={title} count={filtered.length}>
        <div className="flex items-center gap-2 flex-wrap">
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter…"
            className="!text-[12px] !py-1"
            aria-label="Filter records"
          />
          <SelectInput
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            className="!text-[12px] !py-1"
            aria-label="Building"
          >
            <option value="">All buildings</option>
            {buildings.map((b) => <option key={b}>{b}</option>)}
          </SelectInput>
          <SelectInput
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="!text-[12px] !py-1"
            aria-label="Department"
          >
            <option value="">All departments</option>
            {departments.map((d) => <option key={d}>{d}</option>)}
          </SelectInput>
          {hasFilter && (
            <Button
              onClick={() => { setBuilding(""); setDept(""); setSearch(""); }}
              style={{ color: DSU.trojan, borderColor: DSU.trojan }}
            >
              <X size={11} /> Clear
            </Button>
          )}
        </div>
      </SectionHeader>

      <KeyTable
        records={filtered}
        sortCol={sortCol}
        sortDir={sortDir}
        onSort={onSort}
        showPerson
        actions={actions}
        onSelectPerson={onSelectPerson}
        onSelectKey={onSelectKey}
        emptyMessage={hasFilter ? "No records match these filters." : emptyMessage}
      />
    </div>
  );
}

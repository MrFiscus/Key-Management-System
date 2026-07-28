import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { KeyRecord } from "../../lib/types";
import { DSU, font } from "../theme";
import { Button, PageSearchBar, SelectInput } from "../components/primitives";
import { KeyTable, sortRecords, type RowActions, type SortCol, type SortDir } from "./KeyTable";

/**
 * Flat, filterable list of key records. Used for both the Active and Returned
 * tabs — the caller decides which records to hand in, so neither tab needs its
 * own status filter.
 */
export function RecordsView({
  title, records, sortCol, sortDir, onSort, actions, onSelectPerson, onSelectKey,
  onSelectBuilding, onSelectDepartment, onAddReturned, emptyMessage,
}: {
  title: string;
  records: KeyRecord[];
  sortCol: SortCol;
  sortDir: SortDir;
  onSort: (c: SortCol) => void;
  actions: RowActions;
  onSelectPerson?: (personId: string) => void;
  onSelectKey?: (keyId: string) => void;
  onSelectBuilding?: (name: string) => void;
  onSelectDepartment?: (name: string) => void;
  /** Shows a "+ Add Returned" button, top-right — only passed on the
   *  Returned tab, for recording a historical issuance directly. */
  onAddReturned?: () => void;
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
      <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b flex-wrap" style={{ borderColor: DSU.lightBorder }}>
        <h1 className="text-[26px] font-semibold shrink-0" style={{ fontFamily: font.display, color: DSU.navy }}>
          {title}
        </h1>

        <div className="flex items-center gap-2 flex-wrap">
          <PageSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by person, stamp, or room…"
          />
          <SelectInput
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            aria-label="Building"
          >
            <option value="">All buildings</option>
            {buildings.map((b) => <option key={b}>{b}</option>)}
          </SelectInput>
          <SelectInput
            value={dept}
            onChange={(e) => setDept(e.target.value)}
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
          {onAddReturned && (
            <Button variant="primary" onClick={onAddReturned}>
              <Plus size={12} /> Add Returned
            </Button>
          )}
        </div>
      </div>

      <KeyTable
        records={filtered}
        sortCol={sortCol}
        sortDir={sortDir}
        onSort={onSort}
        showPerson
        actions={actions}
        onSelectPerson={onSelectPerson}
        onSelectKey={onSelectKey}
        onSelectBuilding={onSelectBuilding}
        onSelectDepartment={onSelectDepartment}
        emptyMessage={hasFilter ? "No records match these filters." : emptyMessage}
      />
    </div>
  );
}

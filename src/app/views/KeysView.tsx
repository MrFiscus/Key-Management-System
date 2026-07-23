import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X, Users } from "lucide-react";
import type { KeyDef, KeyRecord } from "../../lib/types";
import { DSU, headerFill, radius, shadow } from "../theme";
import { Button, EmptyState, SectionHeader, SelectInput, Stamp, TextInput } from "../components/primitives";

/** Shared row hover tint. */
const HOVER_ROW = "#f0f7fc";


/**
 * The key catalog — one row per key stamp/room, independent of who holds it.
 * "Held by" counts how many people currently have an open assignment, which is
 * the number that matters when a key goes missing.
 */
export function KeysView({
  keys, records, onAdd, onEdit, onDelete, onSelectKey,
}: {
  keys: KeyDef[];
  records: KeyRecord[];
  onAdd: () => void;
  onEdit: (k: KeyDef) => void;
  onDelete: (k: KeyDef) => void;
  onSelectKey: (keyId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [building, setBuilding] = useState("");

  const buildings = useMemo(
    () => [...new Set(keys.map((k) => k.building).filter(Boolean) as string[])].sort(),
    [keys],
  );

  const holdersByKey = useMemo(() => {
    const m = new Map<string, { active: number; total: number }>();
    for (const r of records) {
      const e = m.get(r.keyId) ?? { active: 0, total: 0 };
      e.total++;
      if (r.isActive) e.active++;
      m.set(r.keyId, e);
    }
    return m;
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return keys
      .filter((k) => {
        if (building && k.building !== building) return false;
        if (!q) return true;
        return [k.keyStamp, k.roomNumber, k.roomDescription, k.building, k.department]
          .some((v) => (v ?? "").toLowerCase().includes(q));
      })
      .sort((a, b) => a.keyStamp.localeCompare(b.keyStamp, undefined, { numeric: true }));
  }, [keys, search, building]);

  return (
    <div>
      <SectionHeader title="Key Catalog" count={filtered.length} noun="key">
        <div className="flex items-center gap-2 flex-wrap">
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter keys…"
            className="!text-[12px] !py-1"
            aria-label="Filter keys"
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
          {(search || building) && (
            <Button
              onClick={() => { setSearch(""); setBuilding(""); }}
              style={{ color: DSU.trojan, borderColor: DSU.trojan }}
            >
              <X size={11} /> Clear
            </Button>
          )}
          <Button variant="primary" onClick={onAdd}><Plus size={12} /> Add Key</Button>
        </div>
      </SectionHeader>

      {filtered.length === 0 ? (
        <EmptyState message={keys.length === 0 ? "No keys yet. Add one or import your spreadsheet." : "No keys match this filter."} />
      ) : (
        <div
          className="overflow-x-auto border rounded"
          style={{ borderColor: DSU.lightBorder, boxShadow: shadow.md, borderRadius: radius.lg }}
        >
          <table className="w-full border-collapse text-[13px]" style={{ color: DSU.darkGray }}>
            <thead>
              <tr>
                {["Key Stamp", "Room No.", "Room Description", "Building", "Department", "Notes"].map((h) => (
                  <th key={h} className="px-3 py-2 text-[12px] font-semibold text-left whitespace-nowrap"
                    style={{ background: headerFill, color: "rgba(255,255,255,0.88)" }}>
                    {h}
                  </th>
                ))}
                <th className="px-3 py-2 text-[12px] font-semibold text-center whitespace-nowrap"
                  style={{ background: headerFill, color: "rgba(255,255,255,0.88)" }}>
                  Held By
                </th>
                <th className="px-3 py-2 text-[12px] font-semibold text-right"
                  style={{ background: headerFill, color: "rgba(255,255,255,0.88)" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((k, i) => {
                const base = i % 2 === 0 ? "#ffffff" : DSU.zebra;
                const counts = holdersByKey.get(k.id) ?? { active: 0, total: 0 };
                return (
                  <tr
                    key={k.id}
                    className="border-b group"
                    style={{ borderColor: "#eaebec", background: base }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_ROW)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = base)}
                  >
                    <td className="px-3 py-2">
                      <Stamp stamp={k.keyStamp} onClick={() => onSelectKey(k.id)} />
                    </td>
                    <td className="px-3 py-2 font-mono text-[12px]">{k.roomNumber || <Dash />}</td>
                    <td className="px-3 py-2">{k.roomDescription || <Dash />}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{k.building || <Dash />}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{k.department || <Dash />}</td>
                    <td className="px-3 py-2 text-[12px]" style={{ color: DSU.midGray }}>{k.notes || <Dash />}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {counts.active > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-sm"
                          style={{ background: "#daf0fa", color: "#006a96", border: "1px solid #a8ddf4" }}
                          title={`${counts.total} total assignment${counts.total === 1 ? "" : "s"} over time`}
                        >
                          <Users size={10} /> {counts.active}
                        </span>
                      ) : (
                        <span className="text-[11px]" style={{ color: "#b0b2b5" }}>none out</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEdit(k)} title="Edit" aria-label="Edit"
                          className="p-1 rounded hover:bg-black/[0.07]" style={{ color: DSU.midGray }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => onDelete(k)} title="Delete" aria-label="Delete"
                          className="p-1 rounded hover:bg-black/[0.07]" style={{ color: DSU.danger }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const Dash = () => <span style={{ color: "#b0b2b5" }}>—</span>;

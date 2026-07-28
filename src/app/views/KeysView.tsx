import { useMemo, useState } from "react";
import {
  Pencil, Plus, Trash2, X, Users, KeyRound, Hash, StickyNote, Building2, Briefcase, Settings2,
} from "lucide-react";
import type { KeyDef, KeyRecord } from "../../lib/types";
import { DSU, font, headerFill, radius, shadow } from "../theme";
import { Button, EmptyState, PageSearchBar, SelectInput, Stamp } from "../components/primitives";

/** Shared row hover tint. */
const HOVER_ROW = "#f0f7fc";


/**
 * The key catalog — one row per key stamp/room, independent of who holds it.
 * "Held by" counts how many people currently have an open assignment, which is
 * the number that matters when a key goes missing.
 */
export function KeysView({
  keys, records, onAdd, onEdit, onDelete, onSelectKey, onSelectBuilding, onSelectDepartment,
}: {
  keys: KeyDef[];
  records: KeyRecord[];
  onAdd: () => void;
  onEdit: (k: KeyDef) => void;
  onDelete: (k: KeyDef) => void;
  onSelectKey: (keyId: string) => void;
  onSelectBuilding?: (name: string) => void;
  onSelectDepartment?: (name: string) => void;
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
      <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b flex-wrap" style={{ borderColor: DSU.lightBorder }}>
        <h1 className="text-[26px] font-semibold shrink-0" style={{ fontFamily: font.display, color: DSU.navy }}>
          Key Catalog
        </h1>

        <div className="flex items-center gap-2 flex-wrap">
          <PageSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by stamp, room, building…"
          />
          <SelectInput
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
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
      </div>

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
                {[
                  { label: "Key Stamp", icon: <KeyRound size={12} /> },
                  { label: "Room No.", icon: <Hash size={12} /> },
                  { label: "Room Description", icon: <StickyNote size={12} /> },
                  { label: "Building", icon: <Building2 size={12} /> },
                  { label: "Department", icon: <Briefcase size={12} /> },
                  { label: "Notes", icon: <StickyNote size={12} /> },
                ].map(({ label, icon }) => (
                  <th key={label} className="px-3 py-2 text-[12px] font-semibold text-left whitespace-nowrap"
                    style={{ background: headerFill, color: "rgba(255,255,255,0.88)" }}>
                    <span className="inline-flex items-center gap-1.5" style={{ color: DSU.trojan }}>
                      {icon}
                      <span style={{ color: "rgba(255,255,255,0.88)" }}>{label}</span>
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 text-[12px] font-semibold text-center whitespace-nowrap"
                  style={{ background: headerFill, color: "rgba(255,255,255,0.88)" }}>
                  <span className="inline-flex items-center gap-1.5" style={{ color: DSU.trojan }}>
                    <Users size={12} />
                    <span style={{ color: "rgba(255,255,255,0.88)" }}>Held By</span>
                  </span>
                </th>
                <th className="px-3 py-2 text-[12px] font-semibold text-right"
                  style={{ background: headerFill, color: "rgba(255,255,255,0.88)" }}>
                  <span className="inline-flex items-center justify-end gap-1.5" style={{ color: DSU.trojan }}>
                    <Settings2 size={12} />
                    <span style={{ color: "rgba(255,255,255,0.88)" }}>Actions</span>
                  </span>
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
                    className="border-b group transition-colors dsu-row-in"
                    style={{ borderColor: "#eaebec", background: base, animationDelay: `${Math.min(i, 14) * 16}ms` }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = HOVER_ROW;
                      e.currentTarget.style.boxShadow = `inset 3px 0 0 ${DSU.trojan}`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = base;
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <td className="px-3 py-2">
                      <Stamp stamp={k.keyStamp} onClick={() => onSelectKey(k.id)} />
                    </td>
                    <td className="px-3 py-2 font-mono text-[12px]">
                      {k.roomNumber ? (
                        <button onClick={() => onSelectKey(k.id)} className="hover:underline text-left" style={{ font: "inherit" }}>
                          {k.roomNumber}
                        </button>
                      ) : <Dash />}
                    </td>
                    <td className="px-3 py-2">
                      {k.roomDescription ? (
                        <button onClick={() => onSelectKey(k.id)} className="hover:underline text-left" style={{ font: "inherit" }}>
                          {k.roomDescription}
                        </button>
                      ) : <Dash />}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {k.building ? (
                        onSelectBuilding ? (
                          <button onClick={() => onSelectBuilding(k.building!)} className="hover:underline text-left" style={{ font: "inherit" }}>
                            {k.building}
                          </button>
                        ) : k.building
                      ) : <Dash />}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {k.department ? (
                        onSelectDepartment ? (
                          <button onClick={() => onSelectDepartment(k.department!)} className="hover:underline text-left" style={{ font: "inherit" }}>
                            {k.department}
                          </button>
                        ) : k.department
                      ) : <Dash />}
                    </td>
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

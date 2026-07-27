import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search, X, MapPin, Plus, Minus, Maximize, KeyRound, Building2, Users,
  Pencil, Copy, RotateCcw, Check,
} from "lucide-react";
import type { KeyRecord, DataStore, MapBoxRect } from "../../lib/types";
import { DSU, font, shadow } from "../theme";
import { Avatar, Button, Modal, Stamp } from "../components/primitives";
import { BUILDING_LAYOUT, MAP_ASPECT, matchBuildingId, type BuildingBox } from "../map/buildingLayout";
import { useDragBox } from "../map/useDragBox";

// Static campus map image, dropped into /public. BUILDING_LAYOUT's %-coordinates
// are calibrated directly against this image, so the marker overlay lines up
// with no further transform needed.
const MAP_IMG = "/campus-map.png?v=4hq";

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 6;
// Default view frames the lower campus (the academic core, where the buildings
// and keys are), as a fraction of the stage: full width, from ~38% down.
const DEFAULT_VIEW = { x0: 0, y0: 0.38, x1: 1, y1: 1 };

/**
 * Campus key map: a static Google/parking map image with clickable building
 * markers overlaid at their true footprints. Key counts come from the live
 * active records; clicking a building opens its key drawer.
 */
export function KeyMapView({
  records, onSelectKey, onSelectPerson, store, editing = false,
}: {
  records: KeyRecord[]; // active checkouts
  onSelectKey: (id: string) => void;
  onSelectPerson: (id: string) => void;
  /** Optional — enables the drag/resize position tool with persistence. */
  store?: DataStore | null;
  /** Controlled from the Data page's "Enable Map Editing" toggle (an admin
   *  control, not something this page decides for itself). */
  editing?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [imgAspect, setImgAspect] = useState(MAP_ASPECT);
  const [imgOk, setImgOk] = useState(true);

  // ── manual position/size editing ── whether it's unlocked is controlled by
  // the `editing` prop (toggled from the Data page); positions are loaded from
  // the store once, then kept in local state — every drag/resize end both
  // updates this state and persists immediately, so a refresh never loses work.
  const [overrides, setOverrides] = useState<Record<string, MapBoxRect>>({});
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!store) return;
    store.loadMapLayout().then((layout) => {
      if (!cancelled) setOverrides(layout.overrides);
    });
    return () => { cancelled = true; };
  }, [store]);

  const layout = useMemo(
    () => BUILDING_LAYOUT.map((b) => ({ ...b, ...(overrides[b.id] ?? {}) })),
    [overrides],
  );

  const persist = useCallback((next: Record<string, MapBoxRect>) => {
    setOverrides(next);
    store?.saveMapLayout({ overrides: next, locked: false });
  }, [store]);

  const updateBox = useCallback((id: string, rect: MapBoxRect) => {
    setOverrides((prev) => ({ ...prev, [id]: rect }));
  }, []);

  const commitBox = useCallback((id: string, rect: MapBoxRect) => {
    persist({ ...overrides, [id]: rect });
  }, [overrides, persist]);

  const resetLayout = useCallback(() => {
    if (!confirm("Reset every building back to its default position?")) return;
    persist({});
  }, [persist]);

  const copyLayout = useCallback(async () => {
    const lines = BUILDING_LAYOUT.map((b) => {
      const r = overrides[b.id];
      const x = (r?.x ?? b.x).toFixed(1), y = (r?.y ?? b.y).toFixed(1);
      const w = (r?.width ?? b.width).toFixed(1), h = (r?.height ?? b.height).toFixed(1);
      return `  ${b.id}: { x: ${x}, y: ${y}, width: ${w}, height: ${h} },`;
    });
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [overrides]);

  const stageRef = useRef<HTMLDivElement>(null);
  const getStageRect = useCallback(() => stageRef.current?.getBoundingClientRect() ?? null, []);

  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const centeredRef = useRef(false);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setViewport({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const stageBase = useMemo(() => {
    const { w, h } = viewport;
    if (!w || !h) return { w: 0, h: 0 };
    return w / h > imgAspect ? { w: h * imgAspect, h } : { w, h: w / imgAspect };
  }, [viewport, imgAspect]);

  const centerAt = useCallback((z: number) => {
    if (!stageBase.w || !viewport.w) return;
    setZoom(z);
    setPan({ x: (viewport.w - stageBase.w * z) / 2, y: (viewport.h - stageBase.h * z) / 2 });
  }, [stageBase, viewport]);

  // Fit a sub-region of the stage (fractions) into the viewport.
  const focusRegion = useCallback((r: { x0: number; y0: number; x1: number; y1: number }) => {
    if (!stageBase.w || !viewport.w) return;
    const rw = (r.x1 - r.x0) * stageBase.w, rh = (r.y1 - r.y0) * stageBase.h;
    const z = clamp(Math.min(viewport.w / rw, viewport.h / rh), ZOOM_MIN, ZOOM_MAX);
    const cx = ((r.x0 + r.x1) / 2) * stageBase.w, cy = ((r.y0 + r.y1) / 2) * stageBase.h;
    setZoom(z);
    setPan({ x: viewport.w / 2 - cx * z, y: viewport.h / 2 - cy * z });
  }, [stageBase, viewport]);

  useEffect(() => {
    if (centeredRef.current || !stageBase.w || !viewport.w) return;
    focusRegion(DEFAULT_VIEW);
    centeredRef.current = true;
  }, [stageBase, viewport, focusRegion]);

  const keysByBuilding = useMemo(() => {
    const m = new Map<string, KeyRecord[]>();
    for (const r of records) {
      const id = matchBuildingId(r.building);
      if (!id) continue;
      (m.get(id) ?? m.set(id, []).get(id)!).push(r);
    }
    return m;
  }, [records]);

  const ranked = useMemo(
    () => BUILDING_LAYOUT
      .map((b) => ({ b, count: (keysByBuilding.get(b.id) ?? []).length }))
      .filter((x) => x.count > 0)
      .sort((a, c) => c.count - a.count || a.b.name.localeCompare(c.b.name)),
    [keysByBuilding],
  );
  const totalMatched = useMemo(() => [...keysByBuilding.values()].reduce((s, a) => s + a.length, 0), [keysByBuilding]);
  const holders = useMemo(() => new Set(records.map((r) => r.personId)).size, [records]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return { buildings: [] as typeof BUILDING_LAYOUT, keys: [] as KeyRecord[] };
    const buildings = BUILDING_LAYOUT.filter(
      (b) => b.name.toLowerCase().includes(q) || (b.aliases ?? []).some((a) => a.toLowerCase().includes(q)),
    ).slice(0, 6);
    const keys = records.filter((r) =>
      `${r.keyStamp} ${r.roomDescription ?? ""} ${r.roomNumber ?? ""} ${r.personName}`.toLowerCase().includes(q),
    ).slice(0, 6);
    return { buildings, keys };
  }, [search, records]);

  const matchIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const set = new Set<string>();
    for (const b of BUILDING_LAYOUT) {
      const nameHit = b.name.toLowerCase().includes(q) || (b.aliases ?? []).some((a) => a.toLowerCase().includes(q));
      const keyHit = (keysByBuilding.get(b.id) ?? []).some((r) =>
        `${r.keyStamp} ${r.roomDescription} ${r.personName}`.toLowerCase().includes(q));
      if (nameHit || keyHit) set.add(b.id);
    }
    return set;
  }, [search, keysByBuilding]);

  // pan / zoom
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY, start = { ...pan };
    const move = (ev: PointerEvent) => setPan({ x: start.x + (ev.clientX - sx), y: start.y + (ev.clientY - sy) });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = clamp(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), ZOOM_MIN, ZOOM_MAX);
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    setPan((p) => ({ x: cx - (cx - p.x) * (next / zoom), y: cy - (cy - p.y) * (next / zoom) }));
    setZoom(next);
  };
  const zoomBy = (f: number) => {
    const next = clamp(zoom * f, ZOOM_MIN, ZOOM_MAX);
    const cx = viewport.w / 2, cy = viewport.h / 2;
    setPan((p) => ({ x: cx - (cx - p.x) * (next / zoom), y: cy - (cy - p.y) * (next / zoom) }));
    setZoom(next);
  };

  const selected = selectedId ? BUILDING_LAYOUT.find((b) => b.id === selectedId) ?? null : null;
  const selectedKeys = selectedId ? keysByBuilding.get(selectedId) ?? [] : [];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 118px)" }}>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div
          className="relative flex-1 min-w-[200px] max-w-[360px]"
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSearchFocused(false); }}
        >
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: DSU.midGray }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder="Search a building or key…"
            aria-label="Search buildings or keys"
            autoComplete="off"
            className="w-full pl-8 pr-8 py-1.5 text-[13px] rounded-md border outline-none transition-all focus:shadow-[0_0_0_3px_rgba(0,169,224,0.20)]"
            style={{ borderColor: DSU.lightBorder, color: DSU.darkGray, background: "#fff" }}
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: DSU.midGray }}>
              <X size={13} />
            </button>
          )}
          {searchFocused && search.trim() && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-md overflow-y-auto z-40" style={{ borderColor: DSU.lightBorder, boxShadow: shadow.lg, maxHeight: 320 }}>
              {suggestions.buildings.length === 0 && suggestions.keys.length === 0 && (
                <div className="px-3 py-2.5 text-[12px]" style={{ color: DSU.midGray }}>No matches.</div>
              )}
              {suggestions.buildings.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: DSU.midGray, background: "#f5f6f7" }}>Buildings</div>
                  {suggestions.buildings.map((b) => (
                    <button key={b.id} type="button" onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setSelectedId(b.id); setSearchFocused(false); }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-[13px] hover:bg-blue-50 border-b" style={{ borderColor: "#eef1f3" }}>
                      <MapPin size={13} style={{ color: DSU.trojan, flexShrink: 0 }} />
                      <span className="font-medium truncate" style={{ color: DSU.navy }}>{b.name}</span>
                      <span className="ml-auto text-[12px] tabular whitespace-nowrap" style={{ color: DSU.midGray }}>{(keysByBuilding.get(b.id) ?? []).length} keys</span>
                    </button>
                  ))}
                </div>
              )}
              {suggestions.keys.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: DSU.midGray, background: "#f5f6f7" }}>Keys</div>
                  {suggestions.keys.map((r) => (
                    <button key={r.assignmentId} type="button" onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { onSelectKey(r.keyId); setSearchFocused(false); }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-[13px] hover:bg-blue-50 border-b last:border-0" style={{ borderColor: "#eef1f3" }}>
                      <Stamp stamp={r.keyStamp} />
                      <span className="truncate" style={{ color: DSU.darkGray }}>{r.personName}</span>
                      {(r.roomDescription || r.roomNumber) && <span className="ml-auto text-[12px] truncate" style={{ color: DSU.midGray }}>{r.roomDescription || r.roomNumber}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {editing && (
          <>
            <Button onClick={copyLayout} title="Copy every building's current position as code">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy Layout"}
            </Button>
            <Button onClick={resetLayout} title="Reset all buildings to their default position">
              <RotateCcw size={13} /> Reset
            </Button>
          </>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <Button onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out" className="!px-2"><Minus size={14} /></Button>
          <span className="text-[12px] tabular w-11 text-center" style={{ color: DSU.midGray }}>{Math.round(zoom * 100)}%</span>
          <Button onClick={() => zoomBy(1.2)} aria-label="Zoom in" className="!px-2"><Plus size={14} /></Button>
        </div>
        <Button onClick={() => centerAt(1)} title="Fit the whole map"><Maximize size={13} /> Fit</Button>
      </div>

      {editing && (
        <div
          className="mb-3 px-3 py-2 rounded-md text-[12px] flex items-center gap-2"
          style={{ background: DSU.tintBg, color: DSU.tintText, border: `1px solid ${DSU.tintBorder}` }}
        >
          <Pencil size={13} className="shrink-0" />
          Map editing is unlocked from the Data page. Drag any building box to move it, or drag its
          bottom-right corner to resize — changes save automatically.
        </div>
      )}


      {/* ── Left panel + Map + right list ── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0">
        {/* Overview + legend */}
        <aside
          className="shrink-0 lg:w-[236px] flex flex-col rounded-lg border overflow-hidden"
          style={{ borderColor: DSU.lightBorder, background: "#fff", boxShadow: shadow.sm }}
        >
          <div className="px-3 py-2 border-b" style={{ borderColor: DSU.lightBorder }}>
            <span className="text-[14px] font-semibold" style={{ color: DSU.navy, fontFamily: font.display }}>Overview</span>
          </div>

          {/* stats, grouped and vertically centered */}
          <div className="flex-1 flex flex-col justify-center gap-1 px-4">
            {[
              { icon: <KeyRound size={17} />, n: totalMatched, label: "Keys out" },
              { icon: <Building2 size={17} />, n: ranked.length, label: "Buildings with keys" },
              { icon: <Users size={17} />, n: holders, label: "Key holders" },
            ].map((s, i) => (
              <div
                key={s.label}
                className="flex items-center gap-3 py-3"
                style={{ borderTop: i === 0 ? "none" : "1px solid #eef1f3" }}
              >
                <span className="inline-flex items-center justify-center rounded-lg shrink-0"
                  style={{ width: 34, height: 34, background: DSU.tintBg, color: DSU.trojan }}>
                  {s.icon}
                </span>
                <div>
                  <div className="text-[24px] font-bold leading-none tabular" style={{ color: DSU.navy }}>{s.n.toLocaleString()}</div>
                  <div className="text-[11px] mt-1" style={{ color: DSU.midGray }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* legend pinned to the bottom */}
          <div className="border-t px-4 py-3" style={{ borderColor: DSU.lightBorder, background: "#fafbfa" }}>
            <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: DSU.midGray }}>Legend</div>
            <div className="flex items-center gap-2 text-[12px] mb-2" style={{ color: DSU.darkGray }}>
              <span className="inline-flex items-center justify-center rounded-full text-white font-bold shrink-0"
                style={{ minWidth: 18, height: 18, fontSize: 10, padding: "0 4px", background: DSU.trojan, border: "1.5px solid #fff", boxShadow: shadow.sm }}>3</span>
              Keys currently out here
            </div>
            <div className="flex items-center gap-2 text-[12px] mb-2" style={{ color: DSU.darkGray }}>
              <span className="shrink-0 rounded-sm" style={{ width: 18, height: 14, background: "rgba(0,169,224,0.22)", outline: `2px solid ${DSU.trojan}` }} />
              Hover to highlight a building
            </div>
            <div className="text-[12px]" style={{ color: DSU.midGray }}>
              Click any building for its full key list.
            </div>
          </div>
        </aside>

        <div
          ref={viewportRef}
          onPointerDown={onCanvasPointerDown}
          onWheel={onWheel}
          className="relative flex-1 min-w-0 overflow-hidden rounded-lg select-none border"
          style={{ background: "#768b48", borderColor: DSU.lightBorder, cursor: "grab", touchAction: "none" }}
        >
          <div
            ref={stageRef}
            className="absolute top-0 left-0"
            style={{
              width: stageBase.w || 1,
              height: stageBase.h || 1,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              boxShadow: shadow.md,
            }}
          >
            <img
              src={MAP_IMG}
              alt="DSU campus map"
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget;
                if (el.naturalWidth && el.naturalHeight) setImgAspect(el.naturalWidth / el.naturalHeight);
                setImgOk(true);
              }}
              onError={() => setImgOk(false)}
              className="block w-full h-full select-none"
              style={{ pointerEvents: "none" }}
            />

            {imgOk && layout.map((box) => (
              <BuildingMarker
                key={box.id}
                box={box}
                count={(keysByBuilding.get(box.id) ?? []).length}
                dimmed={matchIds !== null && !matchIds.has(box.id)}
                highlighted={(matchIds !== null && matchIds.has(box.id)) || spotlightId === box.id}
                onOpen={() => setSelectedId(box.id)}
                editing={editing}
                getStageRect={getStageRect}
                onMove={(r) => updateBox(box.id, r)}
                onEnd={(r) => commitBox(box.id, r)}
              />
            ))}

            {/* Resize handles render in their own pass, after every marker, so a
                handle is never covered by a neighboring building's larger box. */}
            {imgOk && editing && layout.map((box) => (
              <ResizeHandle
                key={`${box.id}-resize`}
                box={box}
                getStageRect={getStageRect}
                onMove={(r) => updateBox(box.id, r)}
                onEnd={(r) => commitBox(box.id, r)}
              />
            ))}
          </div>

          {!imgOk && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <div className="max-w-[420px] text-[13px]" style={{ color: DSU.darkGray }}>
                <MapPin size={22} style={{ color: DSU.trojan }} className="mx-auto mb-2" />
                <p className="font-semibold mb-1" style={{ color: DSU.navy }}>Campus map image not found</p>
                <p>Save the campus map as <code>public/campus-map.png</code> and reload. The building markers below are ready to overlay it.</p>
              </div>
            </div>
          )}

          <div className="absolute bottom-2 left-3 text-[11px] pointer-events-none" style={{ color: DSU.darkGray }}>
            Click a building for its keys · drag to pan · scroll to zoom
          </div>
        </div>

        {/* Keys-by-building side panel */}
        <aside
          className="shrink-0 lg:w-[272px] flex flex-col rounded-lg border overflow-hidden max-h-[260px] lg:max-h-none"
          style={{ borderColor: DSU.lightBorder, background: "#fff", boxShadow: shadow.sm }}
        >
          <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: DSU.lightBorder }}>
            <span className="text-[14px] font-semibold" style={{ color: DSU.navy, fontFamily: font.display }}>Keys by Building</span>
            <span className="ml-auto text-[12px] tabular" style={{ color: DSU.midGray }}>{totalMatched} out</span>
          </div>
          <div className="overflow-y-auto flex-1">
            {ranked.length === 0 ? (
              <div className="px-3 py-4 text-[12px]" style={{ color: DSU.midGray }}>No keys currently out.</div>
            ) : (
              ranked.map(({ b, count }) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  onMouseEnter={() => setSpotlightId(b.id)}
                  onMouseLeave={() => setSpotlightId(null)}
                  className="flex items-center gap-2 w-full text-left px-3 py-[7px] border-b transition-colors hover:bg-[#f4f8fb]"
                  style={{ borderColor: "#eef1f3" }}
                >
                  <span className="text-[12.5px] truncate" style={{ color: DSU.darkGray }}>{b.name}</span>
                  <span className="ml-auto inline-flex items-center justify-center rounded-full tabular font-bold text-white shrink-0"
                    style={{ minWidth: 21, height: 18, fontSize: 11, padding: "0 6px", background: DSU.trojan }}>
                    {count}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* ── Building key list drawer ── */}
      {selected && (
        <Modal title={selected.name} onClose={() => setSelectedId(null)} wide>
          <div className="flex items-center gap-2 mb-3 text-[13px]" style={{ color: DSU.midGray }}>
            <MapPin size={14} style={{ color: DSU.trojan }} />
            {selectedKeys.length} key{selectedKeys.length === 1 ? "" : "s"} currently assigned here
          </div>
          {selectedKeys.length === 0 ? (
            <div className="py-8 text-center text-[13px]" style={{ color: DSU.midGray }}>
              No keys are currently checked out for this building.
            </div>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto -mx-4">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ background: "#f5f6f7", borderBottom: `1px solid ${DSU.lightBorder}` }}>
                    <th className="text-left px-4 py-1.5 text-[11px] font-semibold" style={{ color: DSU.midGray }}>Person</th>
                    <th className="text-left px-3 py-1.5 text-[11px] font-semibold" style={{ color: DSU.midGray }}>Key</th>
                    <th className="text-left px-3 py-1.5 text-[11px] font-semibold" style={{ color: DSU.midGray }}>Room</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedKeys.map((r) => (
                    <tr key={r.assignmentId} style={{ borderBottom: "1px solid #eef1f3" }}>
                      <td className="px-4 py-1.5">
                        <button onClick={() => { setSelectedId(null); onSelectPerson(r.personId); }}
                          className="inline-flex items-center gap-2 hover:underline font-medium text-left" style={{ color: DSU.navy }}>
                          <Avatar initials={r.initials} size={20} />
                          {r.personName}
                        </button>
                      </td>
                      <td className="px-3 py-1.5">
                        <Stamp stamp={r.keyStamp} onClick={() => { setSelectedId(null); onSelectKey(r.keyId); }} />
                      </td>
                      <td className="px-3 py-1.5" style={{ color: DSU.darkGray }}>{r.roomDescription || r.roomNumber || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ── a clickable building marker over the map image ───────────────────────────────

function BuildingMarker({
  box, count, dimmed, highlighted, onOpen, editing, getStageRect, onMove, onEnd,
}: {
  box: BuildingBox;
  count: number;
  dimmed: boolean;
  highlighted: boolean;
  onOpen: () => void;
  editing: boolean;
  getStageRect: () => DOMRect | null;
  onMove: (rect: MapBoxRect) => void;
  onEnd: (rect: MapBoxRect) => void;
}) {
  const [hover, setHover] = useState(false);
  const hasKeys = count > 0;
  // Invisible by default — the map image already shows the buildings. The
  // outline/tint appears only on hover (or when highlighted via search / the
  // side panel). Buildings with keys still carry a persistent count badge.
  // While editing, the box always shows so it can be found and grabbed.
  const active = hover || highlighted || editing;

  const rect: MapBoxRect = { x: box.x, y: box.y, width: box.width, height: box.height };

  const drag = useDragBox({
    disabled: !editing,
    rect,
    getStageRect,
    onMove,
    onEnd,
  });

  return (
    <button
      onPointerDown={drag.onPointerDown}
      onClick={() => { if (!editing) onOpen(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${box.name} — ${count} key${count === 1 ? "" : "s"}`}
      className="absolute transition-colors"
      style={{
        left: `${box.x}%`,
        top: `${box.y}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
        minWidth: 10,
        minHeight: 10,
        borderRadius: 3,
        background: highlighted ? "rgba(224,180,0,0.32)" : hover ? "rgba(0,169,224,0.22)" : editing ? "rgba(0,169,224,0.10)" : "transparent",
        outline: active ? `2px solid ${highlighted ? "#e0b400" : DSU.trojan}` : "none",
        opacity: dimmed ? 0.4 : 1,
        cursor: editing ? "move" : "pointer",
      }}
    >
      {hasKeys && (
        <span
          className="absolute inline-flex items-center justify-center rounded-full tabular font-bold"
          style={{
            top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            fontSize: 10, minWidth: 18, height: 18, padding: "0 4px",
            background: DSU.trojan, color: "#fff",
            border: "1.5px solid #fff", boxShadow: shadow.sm,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ── resize handle ── rendered as its own top-level layer, one pass after every
// marker, so its hit target is never covered by a neighboring building's box
// (a real bug when boxes sit close together, which is most of this campus).
function ResizeHandle({
  box, getStageRect, onMove, onEnd,
}: {
  box: BuildingBox;
  getStageRect: () => DOMRect | null;
  onMove: (rect: MapBoxRect) => void;
  onEnd: (rect: MapBoxRect) => void;
}) {
  const start = useRef<{ rect: MapBoxRect; x: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const stage = getStageRect();
    if (!stage) return;
    const rect: MapBoxRect = { x: box.x, y: box.y, width: box.width, height: box.height };
    start.current = { rect, x: e.clientX, y: e.clientY };

    const move = (ev: PointerEvent) => {
      const s = start.current;
      if (!s) return;
      const dwPct = ((ev.clientX - s.x) / stage.width) * 100;
      const dhPct = ((ev.clientY - s.y) / stage.height) * 100;
      onMove({
        ...s.rect,
        width: clamp(s.rect.width + dwPct, 2, 100 - s.rect.x),
        height: clamp(s.rect.height + dhPct, 2, 100 - s.rect.y),
      });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dwPct = ((ev.clientX - s.x) / stage.width) * 100;
      const dhPct = ((ev.clientY - s.y) / stage.height) * 100;
      onEnd({
        ...s.rect,
        width: clamp(s.rect.width + dwPct, 2, 100 - s.rect.x),
        height: clamp(s.rect.height + dhPct, 2, 100 - s.rect.y),
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      onPointerDown={onPointerDown}
      title={`Resize ${box.name}`}
      className="absolute flex items-center justify-center"
      style={{
        left: `${box.x + box.width}%`,
        top: `${box.y + box.height}%`,
        width: 26,
        height: 26,
        transform: "translate(-50%, -50%)",
        cursor: "nwse-resize",
        touchAction: "none",
      }}
    >
      <span
        className="rounded-sm pointer-events-none"
        style={{ width: 12, height: 12, background: DSU.trojan, border: "2px solid #fff", boxShadow: shadow.sm }}
      />
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

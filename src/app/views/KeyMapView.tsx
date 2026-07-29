import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search, X, MapPin, Plus, Minus, Maximize, KeyRound, Building2, Users,
  Pencil, Copy, RotateCcw, Check, ArrowRight,
} from "lucide-react";
import type { KeyRecord, DataStore, MapBoxRect } from "../../lib/types";
import { DSU, font, radius, shadow } from "../theme";
import { Avatar, Button, Modal, Stamp } from "../components/primitives";
import { BUILDING_LAYOUT, MAP_ASPECT, matchBuildingId, type BuildingBox } from "../map/buildingLayout";
import { useDragBox } from "../map/useDragBox";

// Static campus map image, dropped into /public. BUILDING_LAYOUT's %-coordinates
// are calibrated directly against this image, so the marker overlay lines up
// with no further transform needed.
const MAP_IMG = "/campus-map.png?v=4hq";

// A real grass swatch, cropped from a clear corner of campus-map.png itself
// (see the crop script in git history) and tiled — so the area beyond the
// map's edge is the map's own texture continuing off-frame, an exact color
// and grain match, not an approximation.
const GRASS_BG: React.CSSProperties = {
  backgroundColor: "#768b48",
  backgroundImage: "url(/grass-tile.png)",
  backgroundRepeat: "repeat",
  backgroundSize: "260px 260px",
};

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 6;
// Default view frames the lower campus (the academic core, where the buildings
// and keys are), as a fraction of the stage: full width, from ~38% down.
const DEFAULT_VIEW = { x0: 0.02, y0: 0.3, x1: 0.68, y1: 1 };

/** Same white-card chrome as the Dashboard/PersonView/KeyView — no hairline
 *  border, just a soft shadow and generous rounding. */
const CARD: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  boxShadow: shadow.sm,
};

/** Small circular icon badge, same spec used across the redesigned pages. */
function IconBadge({ icon, bg, fg = "#fff" }: { icon: React.ReactNode; bg: string; fg?: string }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{ width: 34, height: 34, background: bg, color: fg }}
    >
      {icon}
    </span>
  );
}

/** One stat tile — icon badge + label on top, big number below — same spec
 *  as the Dashboard/PersonView/KeyView stat cards. */
function StatTile({
  icon, bg, label, value, solid = false,
}: {
  icon: React.ReactNode; bg: string; label: string; value: number; solid?: boolean;
}) {
  // Same lift/shadow language as the Dashboard's stat cards: a solid tile
  // darkens toward navyHover, a white one tints toward the accent wash.
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="p-4"
      style={{
        ...CARD,
        background: solid ? (hover ? DSU.navyHover : bg) : (hover ? DSU.tintBg : "#ffffff"),
        boxShadow: hover ? shadow.lg : shadow.sm,
        transform: hover ? "translateY(-4px)" : "translateY(0)",
        transition: "background-color 180ms ease, box-shadow 220ms ease, transform 220ms ease",
      }}
    >
      <div className="flex items-start justify-between mb-2.5">
        <span className="text-[13px] font-medium" style={{ color: solid ? "rgba(255,255,255,0.75)" : DSU.midGray }}>{label}</span>
        <IconBadge icon={icon} bg={solid ? "#ffffff" : bg} fg={solid ? bg : "#ffffff"} />
      </div>
      <div className="text-[24px] font-bold leading-none tabular" style={{ color: solid ? "#ffffff" : DSU.navy }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

/** Panel chrome matching the Dashboard's — serif title, icon, rounded
 *  shadow-card, no border. */
function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden" style={CARD}>
      <div className="px-4 pt-4 pb-2 text-[16px] font-semibold flex items-center gap-2" style={{ color: DSU.navy, fontFamily: font.sans }}>
        {icon && <span style={{ color: DSU.trojan }}>{icon}</span>}
        {title}
      </div>
      {children}
    </div>
  );
}

/** Compact horizontal bar list ranking the top buildings by keys currently
 *  out — a real chart mark (proportional bars), not just a number list. */
/**
 * Horizontal bar list ranking the top buildings by keys currently out — a
 * building icon badge, name, a rounded progress track, and the count. Simple
 * on purpose (this panel is small); the polish is in the badge color, the
 * hover lift, and the count chip, not chart machinery.
 */
function TopBuildingsChart({ rows }: { rows: { b: BuildingBox; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (rows.length === 0) {
    return <div className="px-5 pb-4 text-[12px]" style={{ color: DSU.midGray }}>No keys currently out.</div>;
  }
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div className="px-4 pb-4 pt-1 flex flex-col gap-2.5">
      {rows.map(({ b, count }, i) => {
        const pct = Math.max(8, (count / max) * 100);
        const isHover = hover === i;
        return (
          <div
            key={b.id}
            className="flex items-center gap-2.5 cursor-pointer"
            tabIndex={0}
            role="button"
            title={b.name}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          >
            <span
              className="inline-flex items-center justify-center rounded-full shrink-0 transition-transform"
              style={{ width: 24, height: 24, background: i % 2 === 0 ? DSU.navy : DSU.trojan, color: "#fff", transform: isHover ? "scale(1.1)" : "scale(1)" }}
            >
              <Building2 size={11} />
            </span>
            <span className="text-[11.5px] truncate w-[74px] shrink-0" style={{ color: DSU.darkGray }}>{b.name}</span>
            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "#eef1f3" }}>
              <div
                className="h-full rounded-full transition-[width,opacity] duration-300"
                style={{ width: `${pct}%`, background: DSU.trojan, opacity: isHover ? 1 : 0.85 }}
              />
            </div>
            <span className="text-[11.5px] font-semibold tabular w-4 text-right shrink-0" style={{ color: DSU.navy }}>{count}</span>
          </div>
        );
      })}
    </div>
  );
}

/** One row in the "Navigate" list — a cropped, zoomed-in slice of the actual
 *  campus map centered on that building's footprint (so it reads as "this
 *  building" rather than a generic icon) plus its name, stacked vertically
 *  down the right column. Native-resolution crop (no upscale), cheap to
 *  render many of since every row shares the one cached image. */
function BuildingNavRow({
  box, count, active, onClick, onMouseEnter, onMouseLeave,
}: {
  box: BuildingBox; count: number; active: boolean; onClick: () => void;
  onMouseEnter: () => void; onMouseLeave: () => void;
}) {
  const W = 56, H = 56;
  const IMG_W = 896, IMG_H = 1183; // native px of public/campus-map.png
  const THUMB_ZOOM = 0.75; // 25% less zoomed-in than native res, so more context shows
  const bgW = IMG_W * THUMB_ZOOM, bgH = IMG_H * THUMB_ZOOM;
  const cx = ((box.x + box.width / 2) / 100) * bgW;
  const cy = ((box.y + box.height / 2) / 100) * bgH;

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="flex items-center gap-2.5 w-full text-left p-2 rounded-xl transition-colors shrink-0"
      style={{ background: active ? "#eaf6fc" : "#f7f9fa" }}
      title={box.name}
    >
      <div className="relative overflow-hidden rounded-lg shrink-0" style={{ width: W, height: H }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${MAP_IMG})`,
            backgroundSize: `${bgW}px ${bgH}px`,
            backgroundPosition: `${-(cx - W / 2)}px ${-(cy - H / 2)}px`,
            backgroundRepeat: "no-repeat",
          }}
        />
        <div
          className="absolute inset-0 rounded-lg"
          style={{ outline: active ? `2.5px solid ${DSU.trojan}` : "1.5px solid rgba(255,255,255,0.7)", outlineOffset: -1.5 }}
        />
      </div>
      <span className="text-[13px] font-medium leading-tight flex-1 min-w-0 truncate" style={{ color: DSU.darkGray }}>
        {box.name}
      </span>
      {/* Always shown, even at 0 — a big, clear square badge, not a pill the
          number gets squeezed into. */}
      <span
        className="inline-flex items-center justify-center rounded-lg tabular font-bold shrink-0"
        style={{
          minWidth: 38, height: 34, fontSize: 16, padding: "0 8px",
          background: count > 0 ? DSU.trojan : "#eef1f3",
          color: count > 0 ? "#fff" : DSU.midGray,
          boxShadow: count > 0 ? shadow.sm : "none",
        }}
      >
        {count}
      </span>
    </button>
  );
}

/**
 * Campus key map: a static Google/parking map image with clickable building
 * markers overlaid at their true footprints. Key counts come from the live
 * active records; clicking a building opens its key drawer.
 */
export function KeyMapView({
  records, onSelectKey, onSelectPerson, onSelectBuilding, store, editing = false,
}: {
  records: KeyRecord[]; // active checkouts
  onSelectKey: (id: string) => void;
  onSelectPerson: (id: string) => void;
  onSelectBuilding?: (name: string) => void;
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

  const navigateList = useMemo(
    () => [...layout].sort((a, b) => a.name.localeCompare(b.name)),
    [layout],
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
    <div className="flex gap-4" style={{ height: "calc(100vh - 118px)" }}>
      {/* ── Left column: stat tiles stacked, chart underneath ── */}
      <div className="w-[360px] shrink-0 flex flex-col gap-4 overflow-y-auto">
        <StatTile icon={<KeyRound size={15} />} bg={DSU.navy} label="Keys out" value={totalMatched} />
        <StatTile icon={<Building2 size={15} />} bg={DSU.navy} label="Buildings with keys" value={ranked.length} solid />
        <StatTile icon={<Users size={15} />} bg={DSU.navy} label="Key holders" value={holders} />
        <Panel title="Most Keys Out" icon={<KeyRound size={13} />}>
          <TopBuildingsChart rows={ranked} />
        </Panel>
      </div>

      {/* ── Middle column: search bar (centered, Dashboard-style), then the map ── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="relative shrink-0" style={{ minHeight: 46 }}>
          <div
            className="relative w-full max-w-[440px] mx-auto"
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSearchFocused(false); }}
          >
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: DSU.midGray }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search a building or key…"
              aria-label="Search buildings or keys"
              autoComplete="off"
              className="w-full pl-11 pr-4 py-3 text-[14px] bg-white outline-none transition-all duration-150"
              style={{
                border: `1px solid ${searchFocused ? DSU.trojan : "#dfe3e7"}`,
                borderBottom: searchFocused && search.trim() ? "none" : `1px solid ${searchFocused ? DSU.trojan : "#dfe3e7"}`,
                borderRadius: searchFocused && search.trim() ? `${radius.xl}px ${radius.xl}px 0 0` : radius.xl,
                boxShadow: searchFocused && search.trim()
                  ? "none"
                  : searchFocused
                    ? "0 4px 16px -4px rgba(16,40,56,0.14)"
                    : shadow.sm,
                color: DSU.darkGray,
              }}
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear" className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: DSU.midGray }}>
                <X size={14} />
              </button>
            )}

            {searchFocused && search.trim() && (
              <div
                className="absolute left-0 right-0 top-full bg-white overflow-hidden z-40"
                style={{
                  border: `1px solid ${DSU.trojan}`,
                  borderTop: "none",
                  borderRadius: `0 0 ${radius.xl}px ${radius.xl}px`,
                  boxShadow: "0 10px 28px -10px rgba(16,40,56,0.22)",
                  maxHeight: 360,
                  overflowY: "auto",
                }}
              >
                {suggestions.buildings.length === 0 && suggestions.keys.length === 0 && (
                  <div className="px-4 py-2.5 text-[12px]" style={{ color: DSU.midGray }}>No matches.</div>
                )}
                {suggestions.buildings.length > 0 && (
                  <div>
                    <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: DSU.midGray, background: "#f5f6f7" }}>Buildings</div>
                    {suggestions.buildings.map((b) => (
                      <button key={b.id} type="button" onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setSelectedId(b.id); setSearchFocused(false); }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#f4f8fb] transition-colors border-b" style={{ borderColor: "#eef1f3" }}>
                        <MapPin size={13} style={{ color: DSU.trojan, flexShrink: 0 }} />
                        <span className="font-medium truncate" style={{ color: DSU.navy }}>{b.name}</span>
                        <span className="ml-auto text-[12px] tabular whitespace-nowrap" style={{ color: DSU.midGray }}>{(keysByBuilding.get(b.id) ?? []).length} keys</span>
                      </button>
                    ))}
                  </div>
                )}
                {suggestions.keys.length > 0 && (
                  <div>
                    <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: DSU.midGray, background: "#f5f6f7" }}>Keys</div>
                    {suggestions.keys.map((r) => (
                      <button key={r.assignmentId} type="button" onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { onSelectKey(r.keyId); setSearchFocused(false); }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#f4f8fb] transition-colors border-b last:border-0" style={{ borderColor: "#eef1f3" }}>
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

          {/* Zoom/fit pinned to the far right, independent of the search bar's
              own centering — no card chrome, just the plain buttons. */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Button onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out" className="!px-2"><Minus size={14} /></Button>
            <span className="text-[12px] tabular w-11 text-center" style={{ color: DSU.midGray }}>{Math.round(zoom * 100)}%</span>
            <Button onClick={() => zoomBy(1.2)} aria-label="Zoom in" className="!px-2"><Plus size={14} /></Button>
            <Button onClick={() => centerAt(1)} title="Fit the whole map"><Maximize size={13} /> Fit</Button>
          </div>
        </div>

        <div
          ref={viewportRef}
          onPointerDown={onCanvasPointerDown}
          onWheel={onWheel}
          className="relative flex-1 min-h-0 overflow-hidden select-none"
          style={{ ...GRASS_BG, borderRadius: 20, boxShadow: shadow.sm, cursor: "grab", touchAction: "none" }}
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

          {editing && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1.5 rounded-xl" style={{ background: "rgba(255,255,255,0.92)", boxShadow: shadow.md }}>
              <Pencil size={12} style={{ color: DSU.trojan }} />
              <Button onClick={copyLayout} title="Copy every building's current position as code">
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy Layout"}
              </Button>
              <Button onClick={resetLayout} title="Reset all buildings to their default position">
                <RotateCcw size={13} /> Reset
              </Button>
            </div>
          )}

          <div
            className={`absolute left-3 text-[11px] pointer-events-none ${editing ? "top-12" : "top-3"}`}
            style={{ color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
          >
            Click a building for its keys · drag to pan · scroll to zoom
          </div>
        </div>
      </div>

      {/* ── Right column: navigate — every building, thumbnail + name ── */}
      <aside className="w-[460px] shrink-0 flex flex-col overflow-hidden" style={CARD}>
        <div
          className="px-4 pt-4 pb-2 text-[16px] font-semibold flex items-center gap-2"
          style={{ color: DSU.navy, fontFamily: font.sans }}
        >
          <span style={{ color: DSU.trojan }}><Building2 size={13} /></span>
          Navigate
          <span className="ml-auto tabular font-normal text-[12px]" style={{ color: DSU.midGray, fontFamily: font.sans }}>{layout.length}</span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 pt-1 flex flex-col gap-2">
          {navigateList.map((box) => (
            <BuildingNavRow
              key={box.id}
              box={box}
              count={(keysByBuilding.get(box.id) ?? []).length}
              active={selectedId === box.id}
              onMouseEnter={() => {
                setSpotlightId(box.id);
                focusRegion(navRowRegion(box));
              }}
              onMouseLeave={() => setSpotlightId(null)}
              onClick={() => {
                focusRegion(navRowRegion(box));
                setSelectedId(box.id);
              }}
            />
          ))}
        </div>
      </aside>

      {/* ── Building key list drawer ── */}
      {selected && (
        <Modal title={selected.name} onClose={() => setSelectedId(null)} wide>
          <div className="flex items-center gap-3 mb-3 text-[13px] flex-wrap" style={{ color: DSU.midGray }}>
            <span className="inline-flex items-center gap-2">
              <MapPin size={14} style={{ color: DSU.trojan }} />
              {selectedKeys.length} key{selectedKeys.length === 1 ? "" : "s"} currently assigned here
            </span>
            {onSelectBuilding && (
              <Button
                variant="secondary"
                className="ml-auto"
                onClick={() => { setSelectedId(null); onSelectBuilding(selected.name); }}
              >
                View full building page <ArrowRight size={13} />
              </Button>
            )}
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
      className="absolute"
      style={{
        left: `${box.x}%`,
        top: `${box.y}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
        minWidth: 10,
        minHeight: 10,
        borderRadius: 10,
        background: highlighted
          ? "radial-gradient(ellipse at center, rgba(224,180,0,0.85) 0%, rgba(224,180,0,0.6) 50%, rgba(224,180,0,0.22) 80%, rgba(224,180,0,0) 100%)"
          : hover
          ? "radial-gradient(ellipse at center, rgba(0,169,224,0.8) 0%, rgba(0,169,224,0.55) 50%, rgba(0,169,224,0.18) 80%, rgba(0,169,224,0) 100%)"
          : editing
          ? "rgba(0,169,224,0.08)"
          : "transparent",
        boxShadow: active && !editing
          ? `0 0 36px 16px ${highlighted ? "rgba(224,180,0,0.55)" : "rgba(0,169,224,0.55)"}`
          : "none",
        opacity: dimmed ? 0.4 : 1,
        cursor: editing ? "move" : "pointer",
        transform: hover && !editing ? "scale(1.06)" : "scale(1)",
        transition: "background 180ms ease, box-shadow 180ms ease, opacity 150ms ease, transform 180ms ease",
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

// Region the "Navigate" list zooms/pans to on hover or click — 7x the
// building's own width/height, floored to a minimum absolute size. The pure
// proportional version zoomed in *extremely* tight on the campus's many
// small/thin buildings (a 7x9 footprint has almost nothing to pad with); the
// floor keeps every building landing in roughly the same, comfortable zoom
// range regardless of how small its footprint is.
const MIN_REGION = 0.22; // fraction of the stage, each axis
function navRowRegion(box: BuildingBox): { x0: number; y0: number; x1: number; y1: number } {
  const cx = (box.x + box.width / 2) / 100;
  const cy = (box.y + box.height / 2) / 100;
  const w = Math.max((box.width / 100) * 7, MIN_REGION);
  const h = Math.max((box.height / 100) * 7, MIN_REGION);
  return {
    x0: cx - w / 2, y0: cy - h / 2,
    x1: cx + w / 2, y1: cy + h / 2,
  };
}

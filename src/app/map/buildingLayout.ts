// Campus map layout — pure data, no component logic. Tweak positions, add
// buildings, or add name aliases here without touching KeyMapView.
//
// x / y / width / height in BUILDING_LAYOUT are the real footprint (% of stage).
// The footprint is NOT used as the card size — see computePlacement below, which
// turns each footprint into a fixed-size, collision-resolved card centered on the
// footprint's midpoint. Footprint area only nudges the card size within a capped
// range so bigger buildings read as modestly bigger.

import type { MapBoxRect } from "../../lib/types";

/** Design canvas, in px. Matches the source campus map (1275×1650). */
export const MAP_STAGE = { w: 1275, h: 1650 };

/** Stage aspect ratio (width ÷ height) — from the source campus map, 1275×1650. */
export const MAP_ASPECT = MAP_STAGE.w / MAP_STAGE.h; // ≈ 0.773

export interface BuildingBox {
  id: string;
  name: string;
  /** left edge, % of stage width */
  x: number;
  /** top edge, % of stage height */
  y: number;
  /** % of stage width */
  width: number;
  /** % of stage height */
  height: number;
  /**
   * Extra strings that should count toward this building when matching the
   * `building` field on key records (see matchBuildingId). Add entries here
   * when your key data labels a building differently than the display name.
   */
  aliases?: string[];
}

export const BUILDING_LAYOUT: BuildingBox[] = [
  { id: "fieldhouse", name: "Fieldhouse", x: 58.0, y: 10.0, width: 7.7, height: 9.2 },
  { id: "madison-cc", name: "Madison Community Center", x: 60.9, y: 13.5, width: 11.1, height: 9.8 },
  { id: "beacom-premier-complex", name: "Beacom Premier Complex", x: 76.8, y: 9.8, width: 19.6, height: 9.6, aliases: ["beacom premier", "premier complex", "premier", "trojan field"] },
  { id: "dsu-foundation", name: "DSU Foundation", x: 32, y: 9.5, width: 20, height: 4, aliases: ["foundation", "dsu foundation"] },
  { id: "prairie-playhouse", name: "Dakota Prairie Playhouse", x: 45.3, y: 21.6, width: 6.0, height: 9.0 },
  { id: "8plex-1", name: "8 Plex Apartments", x: 22.2, y: 21.3, width: 4.3, height: 4.6 },
  { id: "8plex-2", name: "8 Plex Apartments", x: 30.1, y: 21.5, width: 4.3, height: 5.5 },
  { id: "courtyard-lec", name: "Courtyard & Learning Engagement Center (LEC)", x: 41.6, y: 53.2, width: 7.8, height: 11.6 },
  { id: "residence-village", name: "Residence Village", x: 44.0, y: 64.9, width: 5.3, height: 4.5 },
  { id: "the-212", name: "The 2-1-2", x: 27.5, y: 67.6, width: 3.1, height: 2.1 },
  { id: "mundt-library", name: "Karl E. Mundt Library", x: 7.2, y: 74.3, width: 5.3, height: 4.0, aliases: ["mundt", "library"] },
  { id: "habeger-science", name: "Habeger Science Center", x: 15.8, y: 73.2, width: 8.6, height: 6.8, aliases: ["habeger", "science"] },
  { id: "tyrrell-physical-plant", name: "Tyrrell Physical Plant", x: 25.9, y: 75.0, width: 4.5, height: 4.4, aliases: ["tyrrell", "physical plant"] },
  { id: "smith-zimmermann-museum", name: "Smith Zimmermann Museum", x: 32.2, y: 74.7, width: 4.2, height: 2.8, aliases: ["smith zimmermann"] },
  { id: "higbie-hall", name: "Higbie Hall", x: 38.7, y: 75.3, width: 7.3, height: 1.3, aliases: ["higbie"] },
  { id: "zimmermann-hall", name: "Zimmermann Hall", x: 48.2, y: 73.9, width: 1.5, height: 4.8, aliases: ["zimmermann"] },
  { id: "trojan-center", name: "Trojan Center", x: 39.4, y: 78.9, width: 11.6, height: 3.8, aliases: ["trojan center", "tc"] },
  { id: "trojan-zone-bookstore", name: "Trojan Zone Bookstore", x: 45.6, y: 81.0, width: 5.4, height: 1.7, aliases: ["bookstore", "trojan zone"] },
  { id: "tunheim-tcb", name: "Tunheim Classroom Building (TCB)", x: 13.3, y: 84.7, width: 4.6, height: 2.4, aliases: ["tunheim", "tcb", "classroom building"] },
  { id: "beadle-hall", name: "Beadle Hall", x: 20.9, y: 86.0, width: 4.2, height: 2.6, aliases: ["beadle"] },
  { id: "kennedy-center", name: "Kennedy Center", x: 30.5, y: 84.0, width: 6.8, height: 5.0, aliases: ["kennedy"] },
  { id: "east-hall", name: "East Hall", x: 44.0, y: 85.2, width: 4.8, height: 3.9 },
  { id: "cyber-labs", name: "DSU Madison Cyber Labs", x: 5.4, y: 84.4, width: 6.8, height: 9.8, aliases: ["cyber labs", "madison cyber", "mcl"] },
  { id: "hetton-hall", name: "Heston Hall", x: 56.3, y: 72.8, width: 2.4, height: 4.1, aliases: ["heston", "hetton"] },
  { id: "emry-hall", name: "Emry Hall", x: 62.0, y: 73.0, width: 5.4, height: 1.8, aliases: ["emry"] },
  { id: "beacom-institute", name: "Beacom Institute of Technology", x: 55.4, y: 79.8, width: 6.4, height: 8.1, aliases: ["beacom"] },
  { id: "richardson-hall", name: "Richardson Hall", x: 64.2, y: 78.2, width: 3.0, height: 5.0, aliases: ["richardson"] },
  { id: "girton-house", name: "Girton House", x: 55.4, y: 90.1, width: 3.7, height: 1.5, aliases: ["girton"] },
];

// ── building-name matching ─────────────────────────────────────────────────────
// Key records carry a free-text `building` string that may not equal the display
// name above. Normalising both sides and matching on containment (plus aliases)
// handles the common cases; add `aliases` entries for anything that slips through.

export function normalizeBuilding(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ") // drop parenthetical bits like "(TCB)"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MATCH_TARGETS = BUILDING_LAYOUT.map((b) => ({
  id: b.id,
  terms: [normalizeBuilding(b.name), ...(b.aliases ?? []).map(normalizeBuilding)].filter(Boolean),
}));

/**
 * Best-effort map from a record's `building` value to a layout building id, or
 * null if nothing matches. Prefers the longest matching term so "beadle" wins
 * over a shorter accidental substring.
 */
export function matchBuildingId(value: string | null | undefined): string | null {
  const v = normalizeBuilding(value);
  if (!v) return null;
  let best: { id: string; score: number } | null = null;
  for (const t of MATCH_TARGETS) {
    for (const term of t.terms) {
      if (v === term || v.includes(term) || term.includes(v)) {
        const score = term.length;
        if (!best || score > best.score) best = { id: t.id, score };
      }
    }
  }
  return best?.id ?? null;
}

// ── placement transform ─────────────────────────────────────────────────────────
// Footprint → fixed-size card. Steps: (1) center on footprint midpoint; (2) size
// by area within a capped range; (3) light gap-compression between clusters so the
// campus isn't sparse but stays near-true; (4) iterative collision resolution so
// no two cards overlap. Deterministic → computed once at module load.

/** Tunables — safe to nudge. gap→1 keeps true geography; pad = min px between cards. */
const PLACE = {
  gap: 0.9,            // inter-cluster spacing factor (1 = untouched, lower = tighter)
  clusterDist: 250,    // px, single-link clustering threshold
  minW: 92, maxW: 140, // card width range, px
  minH: 56, maxH: 88,  // card height range, px
  aLo: 8, aHi: 95,     // footprint-area range mapped onto the size range
  pad: 8,              // min px gap enforced between cards
  iters: 200,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function place(): Record<string, MapBoxRect> {
  const { w: W, h: H } = MAP_STAGE;

  // 1. center (px) + size (px from footprint area)
  const b = BUILDING_LAYOUT.map((d) => {
    const t = clamp((d.width * d.height - PLACE.aLo) / (PLACE.aHi - PLACE.aLo), 0, 1);
    return {
      id: d.id,
      px: ((d.x + d.width / 2) / 100) * W,
      py: ((d.y + d.height / 2) / 100) * H,
      w: PLACE.minW + t * (PLACE.maxW - PLACE.minW),
      h: PLACE.minH + t * (PLACE.maxH - PLACE.minH),
      cluster: -1,
    };
  });

  // 2. single-link clustering by proximity
  const dist = (a: typeof b[number], c: typeof b[number]) => Math.hypot(a.px - c.px, a.py - c.py);
  let cid = 0;
  for (const p of b) {
    if (p.cluster !== -1) continue;
    const stack = [p]; p.cluster = cid;
    while (stack.length) {
      const cur = stack.pop()!;
      for (const q of b) if (q.cluster === -1 && dist(cur, q) < PLACE.clusterDist) { q.cluster = cid; stack.push(q); }
    }
    cid++;
  }

  // 3. gap compression — move each cluster centroid toward the global centroid
  const clusters = new Map<number, typeof b>();
  for (const p of b) (clusters.get(p.cluster) ?? clusters.set(p.cluster, []).get(p.cluster)!).push(p);
  const centroids = [...clusters].map(([id, ms]) => ({
    id,
    cx: ms.reduce((s, m) => s + m.px, 0) / ms.length,
    cy: ms.reduce((s, m) => s + m.py, 0) / ms.length,
  }));
  const G = {
    x: centroids.reduce((s, c) => s + c.cx, 0) / centroids.length,
    y: centroids.reduce((s, c) => s + c.cy, 0) / centroids.length,
  };
  for (const c of centroids) {
    const dx = G.x + (c.cx - G.x) * PLACE.gap - c.cx;
    const dy = G.y + (c.cy - G.y) * PLACE.gap - c.cy;
    for (const m of clusters.get(c.id)!) { m.px += dx; m.py += dy; }
  }

  // 4. collision resolution (iterative minimum-translation push)
  for (let it = 0; it < PLACE.iters; it++) {
    let moved = false;
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
      const a = b[i], c = b[j];
      const dx = c.px - a.px, dy = c.py - a.py;
      const ox = (a.w + c.w) / 2 + PLACE.pad - Math.abs(dx);
      const oy = (a.h + c.h) / 2 + PLACE.pad - Math.abs(dy);
      if (ox > 0 && oy > 0) {
        moved = true;
        if (ox < oy) { const s = (dx === 0 ? 1 : Math.sign(dx)) * ox / 2; a.px -= s; c.px += s; }
        else { const s = (dy === 0 ? 1 : Math.sign(dy)) * oy / 2; a.py -= s; c.py += s; }
      }
    }
    for (const p of b) {
      p.px = clamp(p.px, p.w / 2 + 4, W - p.w / 2 - 4);
      p.py = clamp(p.py, p.h / 2 + 4, H - p.h / 2 - 4);
    }
    if (!moved) break;
  }

  // → top-left rects in % of stage (the drag/persistence model)
  const out: Record<string, MapBoxRect> = {};
  for (const p of b) {
    out[p.id] = {
      x: ((p.px - p.w / 2) / W) * 100,
      y: ((p.py - p.h / 2) / H) * 100,
      width: (p.w / W) * 100,
      height: (p.h / H) * 100,
    };
  }
  return out;
}

/** Default card rects (id → %-rect), collision-resolved. Overrides layer on top. */
export const DEFAULT_PLACEMENT: Record<string, MapBoxRect> = place();

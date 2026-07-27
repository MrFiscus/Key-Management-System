// Campus map layout — pure data, no component logic. Tweak positions, add
// buildings, or add name aliases here without touching KeyMapView.
//
// x / y / width / height in BUILDING_LAYOUT are the real footprint (% of stage).
// The footprint is NOT used as the card size — see computePlacement below, which
// turns each footprint into a fixed-size, collision-resolved card centered on the
// footprint's midpoint. Footprint area only nudges the card size within a capped
// range so bigger buildings read as modestly bigger.

import type { MapBoxRect } from "../../lib/types";

/** Design canvas, in px. Matches the source campus map (896×1183). */
export const MAP_STAGE = { w: 896, h: 1183 };

/** Stage aspect ratio (width ÷ height) — from the source campus map, 896×1183. */
export const MAP_ASPECT = MAP_STAGE.w / MAP_STAGE.h; // ≈ 0.757

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

// Recalibrated against the 896×1183 aerial render using the official DSU
// parking map (numbered 1–32, dsu.edu) as ground truth for each building's true
// relative position — the two earlier passes were both visual guesswork
// matching shapes between stylized art with no way to confirm identity; this
// pass fixes each building's cluster and left-right/north-south order to match
// the labeled map exactly, then fits that order onto the aerial photo's
// observed building footprints per cluster (athletic complex, middle corridor,
// academic/residential core).
export const BUILDING_LAYOUT: BuildingBox[] = [
  { id: "fieldhouse", name: "Fieldhouse", x: 57, y: 19, width: 4, height: 6 },
  { id: "madison-cc", name: "Madison Community Center", x: 60, y: 24, width: 4, height: 6 },
  { id: "beacom-premier-complex", name: "Beacom Premier Complex", x: 70, y: 9, width: 9, height: 13, aliases: ["beacom premier", "premier complex", "premier", "trojan field"] },
  { id: "dsu-foundation", name: "DSU Foundation", x: 54, y: 1, width: 10, height: 6, aliases: ["foundation", "dsu foundation"] },
  { id: "stadium", name: "Stadium", x: 80, y: 13, width: 11, height: 15, aliases: ["brian kern family stadium", "brian kern stadium", "dan beacom track", "track & field", "track and field"] },
  { id: "prairie-playhouse", name: "Dakota Prairie Playhouse", x: 36, y: 28, width: 9, height: 11 },
  { id: "8plex-1", name: "8 Plex Apartments", x: 18, y: 30, width: 5, height: 6 },
  { id: "8plex-2", name: "8 Plex Apartments", x: 24, y: 31, width: 5, height: 7 },
  { id: "triplex", name: "Tri-plex", x: 31, y: 48, width: 4, height: 5, aliases: ["triplex", "tri plex"] },
  { id: "courtyard-lec", name: "Courtyard & Learning Engagement Center (LEC)", x: 38, y: 50, width: 9, height: 12 },
  { id: "residence-village", name: "Residence Village", x: 42, y: 62, width: 5, height: 5 },
  { id: "the-212", name: "The 2-1-2", x: 20, y: 65, width: 3, height: 3 },
  { id: "mundt-library", name: "Karl E. Mundt Library", x: 0, y: 71, width: 5, height: 5, aliases: ["mundt", "library"] },
  { id: "habeger-science", name: "Habeger Science Center", x: 8, y: 70, width: 9, height: 7, aliases: ["habeger", "science"] },
  { id: "tyrrell-physical-plant", name: "Tyrrell Physical Plant", x: 19, y: 72, width: 5, height: 6, aliases: ["tyrrell", "physical plant"] },
  { id: "smith-zimmermann-museum", name: "Smith Zimmermann Museum", x: 27, y: 71, width: 4, height: 4, aliases: ["smith zimmermann"] },
  { id: "higbie-hall", name: "Higbie Hall", x: 32, y: 71, width: 7, height: 2, aliases: ["higbie"] },
  { id: "zimmermann-hall", name: "Zimmermann Hall", x: 42, y: 70, width: 2, height: 7, aliases: ["zimmermann"] },
  { id: "trojan-center", name: "Trojan Center", x: 31, y: 77, width: 12, height: 6, aliases: ["trojan center", "tc"] },
  { id: "trojan-zone-bookstore", name: "Trojan Zone Bookstore", x: 43, y: 79, width: 5, height: 2, aliases: ["bookstore", "trojan zone"] },
  { id: "tunheim-tcb", name: "Tunheim Classroom Building (TCB)", x: 6, y: 87, width: 5, height: 5, aliases: ["tunheim", "tcb", "classroom building"] },
  { id: "beadle-hall", name: "Beadle Hall", x: 15, y: 93, width: 4, height: 4, aliases: ["beadle"] },
  { id: "kennedy-center", name: "Kennedy Center", x: 24, y: 86, width: 7, height: 7, aliases: ["kennedy"] },
  { id: "east-hall", name: "East Hall", x: 40, y: 92, width: 5, height: 6 },
  { id: "cyber-labs", name: "DSU Madison Cyber Labs", x: 0, y: 83, width: 7, height: 15, aliases: ["cyber labs", "madison cyber", "mcl"] },
  { id: "hetton-hall", name: "Heston Hall", x: 54, y: 67, width: 2, height: 6, aliases: ["heston", "hetton"] },
  { id: "emry-hall", name: "Emry Hall", x: 60, y: 69, width: 5, height: 3, aliases: ["emry"] },
  { id: "beacom-institute", name: "Beacom Institute of Technology", x: 50, y: 80, width: 6, height: 12, aliases: ["beacom"] },
  { id: "richardson-hall", name: "Richardson Hall", x: 62, y: 72, width: 3, height: 7, aliases: ["richardson"] },
  { id: "girton-house", name: "Girton House", x: 53, y: 96, width: 4, height: 2, aliases: ["girton"] },
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

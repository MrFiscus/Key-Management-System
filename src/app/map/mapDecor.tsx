// Campus "substrate" — the green space, roads, and parking drawn behind the
// building cards so the canvas reads as a map, not scattered boxes. Pure themed
// SVG (no image embed), authored in % coordinates over the MAP_STAGE design
// canvas. Tweak the arrays to reshape the map; nothing here is load-bearing.
import { MAP_STAGE } from "./buildingLayout";

const PALETTE = {
  grass: "#d6e5c6",     // campus green — intensified
  lawn: "#c3d9aa",      // richer lawn
  lawnSoft: "#cde0b8",
  roadCasing: "#c2cad1",
  roadFill: "#f7f8f9",
  roadLabel: "#93a0a8",
  path: "#bcc4cb",
  lot: "#eef1f3",       // visitor/white lots
  lotStripe: "#cdd3d9",
  navyLot: "#1f3d57",   // Blue Permit lot
};

type Pt = [number, number]; // % of stage

// Roads traced from the DSU Madison campus map's labeled street grid. Centre-line
// polylines rendered as a dark casing under a light fill. Coordinates are % of
// stage; `name` is drawn along the road. Nudge freely.
const ROADS: { points: Pt[]; width: number; name?: string }[] = [
  // ── N–S streets ──
  { points: [[52, 3], [52, 96]], width: 17, name: "Washington Avenue N" },
  { points: [[71.5, 3], [71.5, 96]], width: 17, name: "Lincoln Ave N" },
  { points: [[4.5, 26], [4.5, 96]], width: 14, name: "Egan Ave N" },
  { points: [[22, 22], [22, 62]], width: 12, name: "Heath Ave N" },
  { points: [[37, 22], [37, 62]], width: 12 },
  // ── E–W streets ──
  { points: [[13, 22], [71.5, 22]], width: 14, name: "11th Street NE" },
  { points: [[4.5, 47.5], [71.5, 47.5]], width: 15, name: "9th Street NE" },
  { points: [[4.5, 70], [52, 70]], width: 12 },
  { points: [[4.5, 95.5], [71.5, 95.5]], width: 15, name: "6th Street NE" },
  // ── NW boundary diagonal ──
  { points: [[0, 25], [10, 15], [20, 9], [29, 6]], width: 12 },
];

// Sidewalks / paths — thin dashed connectors within the south core.
const PATHS: Pt[][] = [
  [[38, 70], [45, 78], [46, 86]],
  [[23, 70], [23, 84]],
  [[58, 70], [58, 84]],
];

// Green lawns (soft blobs) in the large open blocks between streets.
const LAWNS: { cx: number; cy: number; rx: number; ry: number; soft?: boolean }[] = [
  { cx: 12, cy: 35, rx: 8, ry: 10, soft: true },   // NW block
  { cx: 62, cy: 35, rx: 8, ry: 11, soft: true },   // NE block
  { cx: 12, cy: 58, rx: 7, ry: 9 },                // mid-west block
  { cx: 62, cy: 58, rx: 8, ry: 9, soft: true },    // mid-east block
];

// Parking lots. `navy` = Blue Permit lot (the big central lot on the map).
const LOTS: { x: number; y: number; w: number; h: number; navy?: boolean }[] = [
  { x: 40, y: 30.5, w: 12, h: 16, navy: true },  // Blue Permit (All Students)
  { x: 55, y: 15, w: 14, h: 6 },                 // visitor lot below Madison CC
  { x: 55, y: 24, w: 14, h: 7 },                 // visitor lot
  { x: 6, y: 49, w: 14, h: 12 },                 // NW visitor lot
  { x: 55, y: 49, w: 14, h: 10 },                // E visitor lot
  { x: 1, y: 82, w: 4.5, h: 9 },                 // SW lot (Cyber Labs)
];

const X = (v: number) => (v / 100) * MAP_STAGE.w;
const Y = (v: number) => (v / 100) * MAP_STAGE.h;
const line = (pts: Pt[]) => pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ");

/** Full-stage map background. Render inside the (aspect-locked) stage, behind boxes. */
export function MapSubstrate() {
  return (
    <svg
      className="absolute inset-0"
      width="100%"
      height="100%"
      viewBox={`0 0 ${MAP_STAGE.w} ${MAP_STAGE.h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect x={0} y={0} width={MAP_STAGE.w} height={MAP_STAGE.h} fill={PALETTE.grass} />

      {/* lawns */}
      {LAWNS.map((l, i) => (
        <ellipse key={`lawn-${i}`} cx={X(l.cx)} cy={Y(l.cy)} rx={X(l.rx)} ry={Y(l.ry)}
          fill={l.soft ? PALETTE.lawnSoft : PALETTE.lawn} />
      ))}

      {/* parking lots with faint stripes */}
      {LOTS.map((lot, i) => {
        const stripes = Math.max(1, Math.round(lot.w / 1.6));
        return (
          <g key={`lot-${i}`}>
            <rect x={X(lot.x)} y={Y(lot.y)} width={X(lot.w)} height={Y(lot.h)} rx={5}
              fill={lot.navy ? PALETTE.navyLot : PALETTE.lot} />
            {Array.from({ length: stripes }).map((_, s) => {
              const sx = X(lot.x) + ((s + 1) * X(lot.w)) / (stripes + 1);
              return <line key={s} x1={sx} y1={Y(lot.y) + 4} x2={sx} y2={Y(lot.y + lot.h) - 4}
                stroke={lot.navy ? "rgba(255,255,255,0.28)" : PALETTE.lotStripe} strokeWidth={1.5} />;
            })}
          </g>
        );
      })}

      {/* roads — casing then fill, rounded joins */}
      {ROADS.map((r, i) => (
        <polyline key={`rc-${i}`} points={line(r.points)} fill="none"
          stroke={PALETTE.roadCasing} strokeWidth={r.width + 5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {ROADS.map((r, i) => (
        <polyline key={`rf-${i}`} points={line(r.points)} fill="none"
          stroke={PALETTE.roadFill} strokeWidth={r.width} strokeLinecap="round" strokeLinejoin="round" />
      ))}

      {/* road names */}
      {ROADS.map((r, i) => {
        if (!r.name) return null;
        const a = r.points[0], z = r.points[r.points.length - 1];
        const mx = X((a[0] + z[0]) / 2), my = Y((a[1] + z[1]) / 2);
        const vertical = Math.abs(z[1] - a[1]) > Math.abs(z[0] - a[0]);
        return (
          <text key={`rn-${i}`} x={mx} y={my}
            fill={PALETTE.roadLabel} fontSize={13} fontWeight={600}
            textAnchor="middle" dominantBaseline="middle"
            transform={vertical ? `rotate(-90 ${mx} ${my})` : undefined}
            style={{ letterSpacing: "0.5px" }}>
            {r.name}
          </text>
        );
      })}

      {/* sidewalks */}
      {PATHS.map((p, i) => (
        <polyline key={`p-${i}`} points={line(p)} fill="none"
          stroke={PALETTE.path} strokeWidth={4} strokeDasharray="2 7" strokeLinecap="round" />
      ))}
    </svg>
  );
}

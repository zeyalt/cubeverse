import {
  previewFor,
  type ClockPreview,
  type CubePreview,
  type Face,
  type PyraminxPreview,
  type SkewbPreview,
} from "@/lib/scrambleCube";

type Pt = { x: number; y: number };

const FACE = 20;
const GAP = 1.25;
const NET_W = FACE * 4 + GAP * 3;
const NET_H = FACE * 3 + GAP * 2;

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function inset(points: Pt[], amount = 0.12): Pt[] {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const origin = { x: cx, y: cy };
  return points.map((point) => lerp(point, origin, amount));
}

function poly(points: Pt[], color: string, key: string) {
  return (
    <polygon
      key={key}
      points={inset(points)
        .map((point) => `${point.x},${point.y}`)
        .join(" ")}
      fill={color}
      stroke="#111"
      strokeWidth="0.45"
      strokeLinejoin="round"
    />
  );
}

function square(x: number, y: number, size: number): [Pt, Pt, Pt, Pt] {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ];
}

function cellAt(origin: Pt, row: number, col: number, n: number): [Pt, Pt, Pt, Pt] {
  const size = FACE / n;
  return square(origin.x + col * size, origin.y + row * size, size);
}

const NET: Record<Face, Pt> = {
  U: { x: FACE + GAP, y: 0 },
  L: { x: 0, y: FACE + GAP },
  F: { x: FACE + GAP, y: FACE + GAP },
  R: { x: (FACE + GAP) * 2, y: FACE + GAP },
  B: { x: (FACE + GAP) * 3, y: FACE + GAP },
  D: { x: FACE + GAP, y: (FACE + GAP) * 2 },
};

/**
 * Cube net (cross):
 *       U
 *     L F R B
 *       D
 * Each face is the view looking at that face with white-adjacent stickers at
 * the top, except U (F-adjacent row at the bottom, touching F) and D
 * (F-adjacent row at the top, touching F).
 */
function CubeNet({ preview }: { preview: CubePreview }) {
  const n = preview.n;
  const faces: Face[] = ["U", "L", "F", "R", "B", "D"];
  return (
    <>
      {faces.flatMap((face) =>
        preview[face].flatMap((row, rowIndex) =>
          row.map((color, colIndex) =>
            poly(cellAt(NET[face], rowIndex, colIndex, n), color, `${face}-${rowIndex}-${colIndex}`),
          ),
        ),
      )}
    </>
  );
}

function PyraminxNet({ preview }: { preview: PyraminxPreview }) {
  const side = 22;
  const h = (side * Math.sqrt(3)) / 2;
  const faces: { id: keyof PyraminxPreview["faces"]; tri: [Pt, Pt, Pt] }[] = [
    {
      id: "F",
      tri: [
        { x: 22, y: 3 },
        { x: 22 - side / 2, y: 3 + h },
        { x: 22 + side / 2, y: 3 + h },
      ],
    },
    {
      id: "R",
      tri: [
        { x: 62, y: 3 },
        { x: 62 - side / 2, y: 3 + h },
        { x: 62 + side / 2, y: 3 + h },
      ],
    },
    {
      id: "L",
      tri: [
        { x: 22, y: 5 + h },
        { x: 22 - side / 2, y: 5 + 2 * h },
        { x: 22 + side / 2, y: 5 + 2 * h },
      ],
    },
    {
      id: "D",
      tri: [
        { x: 62, y: 5 + h },
        { x: 62 - side / 2, y: 5 + 2 * h },
        { x: 62 + side / 2, y: 5 + 2 * h },
      ],
    },
  ];
  return (
    <>
      {faces.map(({ id, tri }) => {
        const [a, b, c] = tri;
        const stickers = preview.faces[id];
        const n = 3;
        const pts: Pt[][] = [];
        for (let i = 0; i <= n; i++) {
          const row: Pt[] = [];
          for (let j = 0; j <= i; j++) {
            const wa = (n - i) / n;
            const wb = (i - j) / n;
            const wc = j / n;
            row.push({
              x: wa * a.x + wb * b.x + wc * c.x,
              y: wa * a.y + wb * b.y + wc * c.y,
            });
          }
          pts.push(row);
        }
        const tris: [Pt, Pt, Pt][] = [];
        for (let i = 0; i < n; i++) {
          for (let j = 0; j <= i; j++) {
            tris.push([pts[i][j], pts[i + 1][j], pts[i + 1][j + 1]]);
            if (j < i) tris.push([pts[i][j], pts[i][j + 1], pts[i + 1][j + 1]]);
          }
        }
        return (
          <g key={id}>
            {tris.map((triangle, index) =>
              poly(triangle, stickers[index] ?? stickers[0], `${id}-${index}`),
            )}
            <text
              x={(tri[0].x + tri[1].x + tri[2].x) / 3}
              y={(tri[0].y + tri[1].y + tri[2].y) / 3 + 1.2}
              textAnchor="middle"
              fill="#111"
              fontSize="4.2"
              fontWeight="700"
              opacity="0.35"
            >
              {id}
            </text>
          </g>
        );
      })}
    </>
  );
}

function skewbFace(
  origin: Pt,
  center: string,
  corners: [string, string, string, string],
  key: string,
) {
  const [tl, tr, br, bl] = square(origin.x, origin.y, FACE);
  const mid = { x: origin.x + FACE / 2, y: origin.y + FACE / 2 };
  return [
    poly([tl, tr, mid], corners[0], `${key}-n`),
    poly([tr, br, mid], corners[1], `${key}-e`),
    poly([br, bl, mid], corners[2], `${key}-s`),
    poly([bl, tl, mid], corners[3], `${key}-w`),
    poly(
      [lerp(tl, mid, 0.42), lerp(tr, mid, 0.42), lerp(br, mid, 0.42), lerp(bl, mid, 0.42)],
      center,
      `${key}-c`,
    ),
  ];
}

function SkewbNet({ preview }: { preview: SkewbPreview }) {
  const c = preview.corners;
  return (
    <>
      {skewbFace(NET.U, preview.centers.U, [c.UBR[0], c.UFR[0], c.UFL[0], c.UBL[0]], "U")}
      {skewbFace(NET.L, preview.centers.L, [c.UBL[2], c.UFL[2], c.DFL[2], c.DBL[2]], "L")}
      {skewbFace(NET.F, preview.centers.F, [c.UFL[1], c.UFR[1], c.DFR[1], c.DFL[1]], "F")}
      {skewbFace(NET.R, preview.centers.R, [c.UFR[2], c.UBR[2], c.DBR[2], c.DFR[2]], "R")}
      {skewbFace(NET.B, preview.centers.B, [c.UBR[1], c.UBL[1], c.DBL[1], c.DBR[1]], "B")}
      {skewbFace(NET.D, preview.centers.D, [c.DFL[0], c.DFR[0], c.DBR[0], c.DBL[0]], "D")}
    </>
  );
}

function ClockFace({
  clocks,
  pins,
  origin,
}: {
  clocks: number[];
  pins?: [boolean, boolean, boolean, boolean];
  origin: Pt;
}) {
  const step = 12.5;
  return (
    <>
      {clocks.map((hours, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const cx = origin.x + col * step;
        const cy = origin.y + row * step;
        const angle = ((hours % 12) / 12) * Math.PI * 2 - Math.PI / 2;
        return (
          <g key={`${origin.x}-${index}`}>
            <circle cx={cx} cy={cy} r="5.2" fill="#F4F1EA" stroke="#111" strokeWidth="0.6" />
            <line
              x1={cx}
              y1={cy}
              x2={cx + Math.cos(angle) * 3.2}
              y2={cy + Math.sin(angle) * 3.2}
              stroke="#B71234"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          </g>
        );
      })}
      {pins
        ? (
            [
              [0, 0, pins[0]],
              [2, 0, pins[1]],
              [0, 2, pins[2]],
              [2, 2, pins[3]],
            ] as const
          ).map(([col, row, up], index) => (
            <circle
              key={`pin-${index}`}
              cx={origin.x + col * step}
              cy={origin.y + row * step}
              r="1.4"
              fill={up ? "#FFD500" : "#333"}
            />
          ))
        : null}
    </>
  );
}

function ClockNet({ preview }: { preview: ClockPreview }) {
  return (
    <>
      <ClockFace clocks={preview.front} pins={preview.pins} origin={{ x: 16, y: 16 }} />
      <ClockFace clocks={preview.back} origin={{ x: 58, y: 16 }} />
    </>
  );
}

function PreviewBody({
  event,
  scramble,
}: {
  event: string;
  scramble: string | null;
}) {
  const preview = previewFor(event, scramble);
  if (preview.kind === "pyraminx") return <PyraminxNet preview={preview} />;
  if (preview.kind === "skewb") return <SkewbNet preview={preview} />;
  if (preview.kind === "clock") return <ClockNet preview={preview} />;
  return <CubeNet preview={preview} />;
}

export function ScramblePreview({
  event,
  scramble,
  className,
}: {
  event: string;
  scramble: string | null;
  className?: string;
}) {
  const viewBox = `0 0 ${NET_W} ${NET_H}`;
  return (
    <div
      className={`flex flex-col items-center justify-center ${className ?? ""}`}
      role="img"
      aria-label={scramble ? `${event} scramble preview` : `${event} scramble loading`}
    >
      <svg
        viewBox={viewBox}
        className={`h-full w-full ${scramble ? "" : "opacity-35"}`}
        aria-hidden
      >
        <PreviewBody event={event} scramble={scramble} />
      </svg>
    </div>
  );
}

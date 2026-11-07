import {
  FACE_COLORS,
  previewFor,
  square1ScreenDirection,
  type ClockPreview,
  type CubePreview,
  type Face,
  type PyraminxPreview,
  type SkewbPreview,
  type Square1Piece,
  type Square1Preview,
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

/**
 * One Skewb face as it really looks: a diamond centre joining the edge midpoints, and a triangle at
 * each corner. Corners are given as [top-left, top-right, bottom-right, bottom-left].
 *
 * This used to draw four wedges along the face's *edges* and paint corner colours on them — not a
 * shape a Skewb has — and the faces disagreed about which wedge meant which corner, so the picture
 * couldn't be compared with a puzzle even when the state behind it was right.
 */
function skewbFace(
  [tl, tr, br, bl]: [Pt, Pt, Pt, Pt],
  center: string,
  corners: [string, string, string, string],
  key: string,
) {
  const top = lerp(tl, tr, 0.5);
  const right = lerp(tr, br, 0.5);
  const bottom = lerp(br, bl, 0.5);
  const left = lerp(bl, tl, 0.5);
  return [
    poly([tl, top, left], corners[0], `${key}-tl`),
    poly([tr, right, top], corners[1], `${key}-tr`),
    poly([br, bottom, right], corners[2], `${key}-br`),
    poly([bl, left, bottom], corners[3], `${key}-bl`),
    poly([top, right, bottom, left], center, `${key}-c`),
  ];
}

/**
 * Flattened skewb net (same cross as the NxN cubes) so all six faces show at once, each face seen
 * from outside the puzzle with U above F and D below it — the layout the WCA's images use:
 *       U
 *     L F R B
 *       D
 *
 * Which corner sits at each position of each face comes from one table, `SKEWB_NET_CORNERS`, so
 * the faces can't disagree. Each corner's stickers are [U/D, F/B, R/L] in the model, so a face
 * reads index 0, 1 or 2 by which axis it lies on.
 */
const SKEWB_NET_CORNERS: Record<Face, { corners: [string, string, string, string]; sticker: 0 | 1 | 2 }> = {
  U: { corners: ["UBL", "UBR", "UFR", "UFL"], sticker: 0 },
  L: { corners: ["UBL", "UFL", "DFL", "DBL"], sticker: 2 },
  F: { corners: ["UFL", "UFR", "DFR", "DFL"], sticker: 1 },
  R: { corners: ["UFR", "UBR", "DBR", "DFR"], sticker: 2 },
  B: { corners: ["UBR", "UBL", "DBL", "DBR"], sticker: 1 },
  D: { corners: ["DFL", "DFR", "DBR", "DBL"], sticker: 0 },
};

function SkewbNet({ preview }: { preview: SkewbPreview }) {
  return (
    <>
      {(Object.keys(SKEWB_NET_CORNERS) as Face[]).flatMap((face) => {
        const { corners, sticker } = SKEWB_NET_CORNERS[face];
        const colors = corners.map(
          (id) => preview.corners[id as keyof SkewbPreview["corners"]][sticker]
        ) as [string, string, string, string];
        const [tl, tr, br, bl] = square(NET[face].x, NET[face].y, FACE);
        return skewbFace([tl, tr, br, bl], preview.centers[face], colors, face);
      })}
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
  const step = 10;
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
      <text x="22" y="8" textAnchor="middle" fill="#888" fontSize="4.2" fontWeight="700">
        Front
      </text>
      <ClockFace clocks={preview.front} pins={preview.pins} origin={{ x: 12, y: 18 }} />
      <text x="56" y="8" textAnchor="middle" fill="#888" fontSize="4.2" fontWeight="700">
        Back
      </text>
      <ClockFace clocks={preview.back} origin={{ x: 46, y: 18 }} />
    </>
  );
}

const SQ1_R = 12;
const SQ1_EDGE_R = SQ1_R / Math.cos(Math.PI / 12);
const SQ1_CORNER_R = SQ1_R * Math.SQRT2;
const SQ1_BAND = 1.2;
const SQ1_SLICE_DEG = 15;

/**
 * One Square-1 layer seen face-on. Pieces sit at their 30° slots; the outer band shows each slot's
 * side sticker. The top is seen from above with the back at the top of the picture; the bottom as
 * you'd look at it by tipping the puzzle towards you, front edge at the top — see
 * `square1ScreenDirection`, where that choice is made and tested.
 */
function Square1Layer({
  pieces,
  center,
  view,
  keyPrefix,
}: {
  pieces: Square1Piece[];
  center: Pt;
  view: "top" | "bottom";
  keyPrefix: string;
}) {
  const at = (deg: number, r: number): Pt => {
    const d = square1ScreenDirection(view, deg);
    return { x: center.x + r * d.x, y: center.y + r * d.y };
  };
  const band = (a: Pt, b: Pt): Pt[] => [a, b, lerp(center, b, SQ1_BAND), lerp(center, a, SQ1_BAND)];
  const sliceEnd = SQ1_EDGE_R * SQ1_BAND + 1;
  const slice = [at(SQ1_SLICE_DEG, sliceEnd), at(SQ1_SLICE_DEG + 180, sliceEnd)];
  return (
    <>
      {pieces.flatMap((piece) => {
        const deg = SQ1_SLICE_DEG + piece.start * 30;
        const key = `${keyPrefix}-${piece.start}`;
        if (piece.kind === "edge") {
          const [a, b] = [at(deg, SQ1_EDGE_R), at(deg + 30, SQ1_EDGE_R)];
          return [poly([center, a, b], piece.face, key), poly(band(a, b), piece.sides[0], `${key}-s`)];
        }
        const [a, tip, b] = [at(deg, SQ1_EDGE_R), at(deg + 30, SQ1_CORNER_R), at(deg + 60, SQ1_EDGE_R)];
        return [
          poly([center, a, tip, b], piece.face, key),
          poly(band(a, tip), piece.sides[0], `${key}-s0`),
          poly(band(tip, b), piece.sides[1], `${key}-s1`),
        ];
      })}
      <line
        x1={slice[0].x}
        y1={slice[0].y}
        x2={slice[1].x}
        y2={slice[1].y}
        stroke="#E11D48"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
    </>
  );
}

/**
 * Middle layer seen from the front. The slice sits left of centre, so the
 * right piece is wider; after an odd number of "/" turns its narrower back
 * face shows instead.
 */
function Square1Middle({ flipped, origin }: { flipped: boolean; origin: Pt }) {
  const half = 20;
  const offset = half * Math.tan(Math.PI / 12);
  const left = half - offset;
  const right = flipped ? half - offset : half + offset;
  const rect = (x: number, w: number): Pt[] => [
    { x, y: origin.y },
    { x: x + w, y: origin.y },
    { x: x + w, y: origin.y + 4 },
    { x, y: origin.y + 4 },
  ];
  return (
    <>
      {poly(rect(origin.x, left), FACE_COLORS.F, "sq1-mid-l")}
      {poly(rect(origin.x + left, right), flipped ? FACE_COLORS.B : FACE_COLORS.F, "sq1-mid-r")}
    </>
  );
}

function Square1Net({ preview }: { preview: Square1Preview }) {
  return (
    <>
      <text x="24" y="5" textAnchor="middle" fill="#888" fontSize="4.2" fontWeight="700">
        Top
      </text>
      <Square1Layer pieces={preview.top} center={{ x: 24, y: 29 }} view="top" keyPrefix="sq1-u" />
      <text x="72" y="5" textAnchor="middle" fill="#888" fontSize="4.2" fontWeight="700">
        Bottom
      </text>
      <Square1Layer pieces={preview.bottom} center={{ x: 72, y: 29 }} view="bottom" keyPrefix="sq1-d" />
      <Square1Middle flipped={preview.middleFlipped} origin={{ x: 28, y: 55 }} />
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
  if (preview.kind === "sq1") return <Square1Net preview={preview} />;
  return <CubeNet preview={preview} />;
}

function viewBoxFor(event: string): string {
  if (event === "clock") return "0 0 90 52";
  if (event === "sq1") return "0 0 96 60";
  return `0 0 ${NET_W} ${NET_H}`;
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
  return (
    <div
      className={`flex flex-col items-center justify-center overflow-visible ${className ?? ""}`}
      role="img"
      aria-label={scramble ? `${event} scramble preview` : `${event} scramble loading`}
    >
      <svg
        viewBox={viewBoxFor(event)}
        className={`h-full w-full overflow-visible ${scramble ? "" : "opacity-35"}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <PreviewBody event={event} scramble={scramble} />
      </svg>
    </div>
  );
}

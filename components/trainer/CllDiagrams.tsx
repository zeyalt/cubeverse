import type { CllCase, CllCorner, CllSubcaseInfo } from "@/lib/trainer/cll";
import { DIAGRAM, checkLabelFor } from "@/lib/trainer/cll";
import { cn } from "@/lib/utils";

type DiagramLayout = {
  cell: number;
  tab: number;
  offset: number;
  size: number;
  corners: Record<CllCorner, { x: number; y: number }>;
};

function diagramLayout(withTabs: boolean): DiagramLayout {
  if (!withTabs) {
    return {
      cell: DIAGRAM.cell,
      tab: DIAGRAM.tab,
      offset: DIAGRAM.pad,
      size: DIAGRAM.size,
      corners: DIAGRAM.cornerPos,
    };
  }

  const cell = 34;
  const gap = 3;
  const tab = 16;
  const offset = 3 + tab;
  return {
    cell,
    tab,
    offset,
    size: offset * 2 + cell * 2 + gap,
    corners: {
      tl: { x: 0, y: 0 },
      tr: { x: cell + gap, y: 0 },
      bl: { x: 0, y: cell + gap },
      br: { x: cell + gap, y: cell + gap },
    },
  };
}

function tabPosition(
  corner: CllCorner,
  edge: CllSubcaseInfo["checkStickers"][number]["edge"],
  layout: DiagramLayout,
) {
  const pos = layout.corners[corner];
  if (edge === "top") {
    return { left: layout.offset + pos.x + layout.cell / 2 - layout.tab / 2, top: layout.offset + pos.y - layout.tab };
  }
  if (edge === "bottom") {
    return { left: layout.offset + pos.x + layout.cell / 2 - layout.tab / 2, top: layout.offset + pos.y + layout.cell };
  }
  if (edge === "left") {
    return { left: layout.offset + pos.x - layout.tab, top: layout.offset + pos.y + layout.cell / 2 - layout.tab / 2 };
  }
  return { left: layout.offset + pos.x + layout.cell, top: layout.offset + pos.y + layout.cell / 2 - layout.tab / 2 };
}

function pct(value: number, size: number): string {
  return `${(value / size) * 100}%`;
}

export function CllSubcaseDiagram({
  info,
  label,
  withTabs = false,
  className,
}: {
  info: CllSubcaseInfo;
  label?: string;
  withTabs?: boolean;
  className?: string;
}) {
  const layout = diagramLayout(withTabs);
  const fluid = Boolean(className);
  return (
    <div
      className={cn(
        "relative",
        fluid ? "aspect-square [container-type:inline-size]" : "shrink-0",
        className,
      )}
      style={fluid ? undefined : { width: layout.size, height: layout.size }}
      aria-hidden
    >
      {(["tl", "tr", "bl", "br"] as const).map((corner) => {
        const pos = layout.corners[corner];
        const lit = info.oppositeCorners.includes(corner);
        return (
          <span
            key={corner}
            className={`absolute flex items-center justify-center rounded-[4px] border font-extrabold ${
              fluid ? "text-[18cqw]" : "text-[11px]"
            } ${
              lit
                ? "border-[#FFD500] bg-[#FFD500] text-[#4A3308]"
                : "border-token bg-surface text-token-muted"
            }`}
            style={{
              left: pct(layout.offset + pos.x, layout.size),
              top: pct(layout.offset + pos.y, layout.size),
              width: pct(layout.cell, layout.size),
              height: pct(layout.cell, layout.size),
            }}
          >
            {lit ? "O" : ""}
          </span>
        );
      })}
      {withTabs &&
        label &&
        info.checkStickers.map((sticker, index) => {
          const pos = tabPosition(sticker.corner, sticker.edge, layout);
          return (
            <span
              key={`${sticker.corner}-${sticker.edge}-${index}`}
              className={`absolute flex items-center justify-center font-extrabold text-token ${
                fluid ? "text-[16cqw]" : "text-[13px]"
              }`}
              style={{
                left: pct(pos.left, layout.size),
                top: pct(pos.top, layout.size),
                width: pct(layout.tab, layout.size),
                height: pct(layout.tab, layout.size),
              }}
            >
              {label}
            </span>
          );
        })}
    </div>
  );
}

export function CllCaseDiagram({ cubeCase }: { cubeCase: CllCase }) {
  return (
    <div
      className="relative aspect-square w-full overflow-hidden rounded-lg border border-token bg-surface"
      aria-label={`${cubeCase.id} colour diagram showing top, front, right, back, and left stickers`}
    >
      {/* Static local PNGs; next/image is a no-op under `output: "export"`. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cubeCase.image}
        alt=""
        className="absolute inset-[10%] h-[80%] w-[80%] object-contain"
        style={cubeCase.imageRotate ? { transform: `rotate(${cubeCase.imageRotate}deg)` } : undefined}
      />
      {[
        { side: "B", className: "left-1/2 top-0.5 -translate-x-1/2" },
        { side: "F", className: "bottom-0.5 left-1/2 -translate-x-1/2" },
        { side: "L", className: "left-0.5 top-1/2 -translate-y-1/2" },
        { side: "R", className: "right-0.5 top-1/2 -translate-y-1/2" },
      ].map((label) => (
        <span
          key={label.side}
          className={`absolute flex size-4 items-center justify-center rounded-full border border-token bg-surface text-[9px] font-black text-token ${label.className}`}
        >
          {label.side}
        </span>
      ))}
    </div>
  );
}

export function CllCaseCheckDiagram({ cubeCase, info }: { cubeCase: CllCase; info: CllSubcaseInfo }) {
  return (
    <CllSubcaseDiagram
      info={info}
      label={checkLabelFor(cubeCase)}
      withTabs
      className="w-full"
    />
  );
}

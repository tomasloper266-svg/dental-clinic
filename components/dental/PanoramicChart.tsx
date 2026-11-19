"use client";

import { useMemo } from "react";
import { toothAnatomy, type ToothAnatomy } from "@/lib/odontogram/anatomy";
import {
  archPositions,
  type ArchToothPosition,
} from "@/lib/odontogram/arch-positions";
import {
  lowerRowLeftToRight,
  upperRowLeftToRight,
} from "@/lib/odontogram/fdi";
import {
  TOOTH_CHART_FILL,
  isChartFaded,
  toothStatusMeta,
  type ToothStatusKey,
} from "@/lib/odontogram/statuses";
import type { FindingDto } from "@/lib/services/findings";
import { cn } from "@/components/ui/cn";

// العرض البانورامي الشعاعي — قوسا الفكّين على نصفين بيضويين من دالة archPositions
// النقية، وكل سن برسم التشريح نفسه (تاج وجذور من toothAnatomy) مُدار نحو مركز
// القوس. الحالة تلوّن التاج من TOOTH_CHART_FILL كما في العرض الشبكي، والسن
// المختار يتوهج سماوياً. النقر يستدعي onSelect نفسه فيفتح لوحة التسجيل في
// الـDrawer المشترك — لا مسار تسجيل جديد هنا.

type Props = {
  /** آخر مشاهدة لكل سن — مصدر الحالة الحالية كما يحسبها DentalChart */
  latest: Map<number, FindingDto>;
  selectedTooth: number | null;
  onSelect: (fdi: number) => void;
};

// ترتيب القوسين من يسار الشاشة إلى يمينها بعين الطبيب — نفس ترتيب الصفوف الشبكية.
const UPPER_FDIS = upperRowLeftToRight().map((tooth) => tooth.fdi);
const LOWER_FDIS = lowerRowLeftToRight().map((tooth) => tooth.fdi);

// هندسة اللوحة — viewBox 580×560: القبّة العلوية والحوض السفلي بينهما خط الإطباق.
const UPPER_GEOMETRY = { cx: 290, cy: 268, rx: 242, ry: 216 } as const;
const LOWER_GEOMETRY = { cx: 290, cy: 300, rx: 242, ry: 216 } as const;

function anatomyByFdi(): Map<number, ToothAnatomy> {
  const map = new Map<number, ToothAnatomy>();
  for (const fdi of [...UPPER_FDIS, ...LOWER_FDIS]) {
    const anatomy = toothAnatomy(fdi);
    if (anatomy) map.set(fdi, anatomy);
  }
  return map;
}

/** سنة واحدة على القوس — التاج نحو خارج القوس والجذور نحو مركزه. */
function PanoramicTooth({
  position,
  anatomy,
  status,
  selected,
  onSelect,
}: {
  position: ArchToothPosition;
  anatomy: ToothAnatomy;
  status: ToothStatusKey | null;
  selected: boolean;
  onSelect: (fdi: number) => void;
}) {
  const fill =
    status && status !== "HEALTHY" && status !== "WATCH"
      ? TOOTH_CHART_FILL[status]
      : undefined;
  const faded = status ? isChartFaded(status) : undefined;
  const dashed = faded || status === "WATCH";

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(position.fdi);
    }
  }

  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`سن ${position.fdi} — ${anatomy.nameAr}${
        status && status !== "HEALTHY" ? " — له حالة مسجلة" : ""
      }`}
      onClick={() => onSelect(position.fdi)}
      onKeyDown={onKeyDown}
      transform={`translate(${position.x.toFixed(1)} ${position.y.toFixed(1)}) rotate(${position.rotation.toFixed(1)})`}
      style={selected ? { filter: "drop-shadow(0 0 6px rgba(34,211,238,0.9))" } : undefined}
      className="cursor-pointer"
    >
      <g transform="translate(-20 -30)" className={cn(faded && "opacity-50")}>
        <path
          d={anatomy.rootPath}
          fill="var(--color-tooth-enamel)"
          stroke="var(--color-tooth-line-soft)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d={anatomy.crownPath}
          fill={fill ?? "var(--color-tooth-enamel)"}
          stroke={faded ? "var(--color-warning-500)" : "var(--color-tooth-line)"}
          strokeWidth={fill ? "1.6" : "1.2"}
          strokeLinejoin="round"
          strokeDasharray={dashed ? "3 2.5" : undefined}
        />
      </g>
      <text
        y={-36}
        textAnchor="middle"
        fontSize={11}
        className="numeric fill-warm-500"
      >
        {position.fdi}
      </text>
    </g>
  );
}

export default function PanoramicChart({
  latest,
  selectedTooth,
  onSelect,
}: Props) {
  // مواضع القوسين ثابتة (تُحسب مرة واحدة) — التشريح والحالة يأتيان من المذكرات نفسها.
  const positions = useMemo(
    () => ({
      upper: archPositions(
        UPPER_FDIS,
        UPPER_GEOMETRY.cx,
        UPPER_GEOMETRY.cy,
        UPPER_GEOMETRY.rx,
        UPPER_GEOMETRY.ry,
        "upper",
      ),
      lower: archPositions(
        LOWER_FDIS,
        LOWER_GEOMETRY.cx,
        LOWER_GEOMETRY.cy,
        LOWER_GEOMETRY.rx,
        LOWER_GEOMETRY.ry,
        "lower",
      ),
    }),
    [],
  );

  const anatomies = useMemo(anatomyByFdi, []);

  function renderArch(list: ArchToothPosition[]) {
    return list.map((position) => {
      const anatomy = anatomies.get(position.fdi);
      if (!anatomy) return null;
      const current = latest.get(position.fdi);
      return (
        <PanoramicTooth
          key={position.fdi}
          position={position}
          anatomy={anatomy}
          status={current ? toothStatusMeta(current.status)?.value ?? null : null}
          selected={selectedTooth === position.fdi}
          onSelect={onSelect}
        />
      );
    });
  }

  return (
    <svg
      viewBox="0 0 580 560"
      role="img"
      aria-label="المخطط البانورامي — قوسا الفكين العلوي والسفلي"
      className="mx-auto h-auto w-full max-w-2xl"
    >
      <defs>
        <radialGradient id="panoramic-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-primary-400)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--color-primary-400)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* توهج خافت خلف القوسين كما في المرجع */}
      <ellipse
        cx={290}
        cy={284}
        rx={276}
        ry={248}
        fill="url(#panoramic-glow)"
        aria-hidden
      />

      {/* خط المسح المتحرك — يُلغى مع prefers-reduced-motion (قاعدة panoramic-sweep) */}
      <g className="panoramic-sweep" aria-hidden>
        <line
          x1={30}
          x2={30}
          y1={24}
          y2={536}
          stroke="var(--color-primary-400)"
          strokeOpacity={0.18}
          strokeWidth={2}
        />
      </g>

      {/* خط سطح الإطباق بين القوسين */}
      <line
        x1={70}
        x2={510}
        y1={284}
        y2={284}
        stroke="var(--color-warm-300)"
        strokeDasharray="4 4"
        strokeWidth={1}
        aria-hidden
      />

      <g>{renderArch(positions.upper)}</g>
      <g>{renderArch(positions.lower)}</g>
    </svg>
  );
}

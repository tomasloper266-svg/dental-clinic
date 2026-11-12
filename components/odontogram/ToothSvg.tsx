"use client";

import type { ReactElement } from "react";
import type { ToothAnatomy } from "@/lib/odontogram/anatomy";
import {
  type ToothStatusKey,
  type ToothStatusMeta,
} from "@/lib/odontogram/statuses";
import { cn } from "@/components/ui/cn";

// رسم سن تشريحي واحد كزر SVG. التمييز مزدوج: لون + نقش على التاج
// (خطوط مائلة للحشوة، تعبئة للتسوس، خيوط للغرسة…) — لا اللون وحده.
// الجذور تبقى عاجية دائماً، والصف العلوي يُدار 180° ليواجه التيجان خط الإطباق.

type Props = {
  tooth: ToothAnatomy;
  // الحالة الحالية للسن من latestFindingByTooth — null يعني سليماً غير ملوّن.
  meta: ToothStatusMeta | null;
  selected: boolean;
  onSelect: (fdi: number) => void;
};

type CrownPaint = {
  fill: string;
  /** نقش مزدوج فوق اللون — لتمييز الحالة دون الاعتماد على اللون وحده. */
  pattern?: "hatch" | "dots" | "threads";
  /** حد متقطع (المراقبة، المقلوع). */
  dashed?: boolean;
  /** رسم باهت مع علامة X (المقلوع). */
  faded?: boolean;
  /** حلقة داخلية ثانية (التاج التعويضي). */
  innerRing?: boolean;
};

const CROWN_PAINT: Record<ToothStatusKey, CrownPaint> = {
  HEALTHY: { fill: "var(--color-warm-100)" },
  DECAYED: { fill: "var(--color-danger-500)" },
  FILLED: { fill: "var(--color-ink-200)", pattern: "hatch" },
  ROOT_CANAL: { fill: "var(--color-plum-200)", pattern: "dots" },
  EXTRACTED: { fill: "var(--color-warm-100)", dashed: true, faded: true },
  CROWN: { fill: "var(--color-warning-300)", innerRing: true },
  IMPLANT: { fill: "var(--color-primary-300)", pattern: "threads" },
  WATCH: { fill: "transparent", dashed: true },
};

function PatternDefs({
  id,
  kind,
}: {
  id: string;
  kind: NonNullable<CrownPaint["pattern"]>;
}) {
  if (kind === "hatch") {
    return (
      <pattern
        id={id}
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="6"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="2"
        />
      </pattern>
    );
  }
  if (kind === "dots") {
    return (
      <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="1.1" fill="rgba(255,255,255,0.9)" />
        <circle cx="4.5" cy="4.5" r="1.1" fill="rgba(255,255,255,0.9)" />
      </pattern>
    );
  }
  // threads — خيوط لولبية أفقية توحي بغرسة التيتانيوم
  return (
    <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse">
      <line
        x1="0"
        y1="2"
        x2="4"
        y2="2"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="1.1"
      />
    </pattern>
  );
}

export default function ToothSvg({
  tooth,
  meta,
  selected,
  onSelect,
}: Props): ReactElement {
  const status = meta?.value ?? null;
  const paint = status ? CROWN_PAINT[status] : null;
  const patternId = paint?.pattern
    ? `tooth-${paint.pattern}-${tooth.fdi}`
    : null;
  const flipped = tooth.row === "upper";

  return (
    <button
      type="button"
      onClick={() => onSelect(tooth.fdi)}
      aria-pressed={selected}
      aria-label={`سن ${tooth.fdi} — ${tooth.nameAr}${meta ? ` — ${meta.labelAr}` : ""}`}
      className={cn(
        "rounded-field flex shrink-0 flex-col items-center p-0.5 transition-colors",
        "hover:bg-surface-hover focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
        selected && "bg-primary-50 ring-primary-600 ring-2 ring-offset-1",
      )}
    >
      <svg viewBox="0 0 40 60" className="h-12 w-8" aria-hidden>
        {patternId && paint?.pattern && (
          <defs>
            <PatternDefs kind={paint.pattern} id={patternId} />
          </defs>
        )}
        <g
          transform={flipped ? "rotate(180 20 30)" : undefined}
          className={cn(paint?.faded && "opacity-50")}
        >
          {/* الجذور — عاجية دائماً */}
          <path
            d={tooth.rootPath}
            fill="var(--color-warm-100)"
            stroke="var(--color-warm-400)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {/* التاج — يُلوّن بالحالة */}
          <path
            d={tooth.crownPath}
            fill={paint ? paint.fill : "var(--color-warm-100)"}
            stroke={
              paint?.dashed
                ? "var(--color-warning-500)"
                : "var(--color-warm-500)"
            }
            strokeWidth={status && status !== "HEALTHY" ? "1.6" : "1.2"}
            strokeLinejoin="round"
            strokeDasharray={paint?.dashed ? "3 2.5" : undefined}
          />
          {paint?.pattern && patternId && (
            <path
              d={tooth.crownPath}
              fill={`url(#${patternId})`}
              stroke="none"
            />
          )}
          {paint?.innerRing && (
            <path
              d={tooth.crownPath}
              fill="none"
              stroke="var(--color-warning-700)"
              strokeWidth="1"
              transform="translate(20 18) scale(0.8) translate(-20 -18)"
            />
          )}
          {paint?.faded && (
            <path
              d="M8 10 L32 50 M32 10 L8 50"
              stroke="var(--color-warm-500)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </g>
      </svg>
      {/* الحرف الدلالي ورقم FDI خارج الرسم — يبقى مقروءاً مع دوران الصف العلوي */}
      <span
        className={cn(
          "text-warm-600 text-[10px] leading-none font-bold",
          !meta || meta.value === "HEALTHY" ? "opacity-0" : "",
        )}
        aria-hidden
      >
        {meta?.icon}
      </span>
      <span className="numeric text-warm-400 text-[9px] leading-none">
        {tooth.fdi}
      </span>
    </button>
  );
}

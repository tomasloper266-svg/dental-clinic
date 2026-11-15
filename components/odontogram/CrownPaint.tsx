"use client";

import type { ReactElement } from "react";
import type { ToothAnatomy } from "@/lib/odontogram/anatomy";
import type { ToothStatusKey } from "@/lib/odontogram/statuses";
import { surfaceBandsFor } from "@/lib/odontogram/surface-regions";

// نظام تلوين التاج المشترك بين المخططين — لون + نقش للتمييز دون الاعتماد على
// اللون وحده (خطوط مائلة للحشوة، تعبئة للتسوس، خيوط للغرسة…). يُستهلك من
// ToothSvg ومن ChartTooth معاً، ويتيح تلوين أسطح جزئية بأشرطة مقصوصة بمسار
// التاج بدل تلوين التاج كاملاً.

export type CrownPaint = {
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

export const CROWN_PAINT: Record<ToothStatusKey, CrownPaint> = {
  HEALTHY: { fill: "var(--color-warm-100)" },
  DECAYED: { fill: "var(--color-danger-500)" },
  FILLED: { fill: "var(--color-ink-200)", pattern: "hatch" },
  ROOT_CANAL: { fill: "var(--color-plum-200)", pattern: "dots" },
  EXTRACTED: { fill: "var(--color-warm-100)", dashed: true, faded: true },
  CROWN: { fill: "var(--color-warning-300)", innerRing: true },
  IMPLANT: { fill: "var(--color-primary-300)", pattern: "threads" },
  WATCH: { fill: "transparent", dashed: true },
  // حالتان إضافيتان — برتقالي المكسور وزيتي الحساسية كما في المخطط المرجعي
  BROKEN: { fill: "var(--color-warning-500)" },
  SENSITIVITY: { fill: "var(--color-warning-300)" },
};

export function CrownPatternDefs({
  id,
  kind,
}: {
  id: string;
  kind: NonNullable<CrownPaint["pattern"]>;
}): ReactElement {
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
        <circle cx="4.5" cy="1.5" r="1.1" fill="rgba(255,255,255,0.9)" />
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

type OverlayProps = {
  anatomy: ToothAnatomy;
  /** أكواد الأسطح المصابة من آخر مشاهدة — مثال: [«O», «M»] */
  codes: readonly string[];
  paint: CrownPaint;
  /** بادئة فريدة لمعرّفات القصّ والنقش داخل SVG — تضمن عدم تصادم المعرفات بين المخططين */
  idPrefix: string;
};

/**
 * أشرطة الأسطح المصابة مقصوصة بمسار التاج — لون الحالة + نقشها على المناطق
 * حصراً، والتاج خارجها يبقى عاجياً. الأكواد بلا منطقة (OTHER) تعيد القيمة
 * null من دالة الأشرطة فيتولى المتصل التلوين الكامل.
 */
export function CrownSurfaceOverlay({
  anatomy,
  codes,
  paint,
  idPrefix,
}: OverlayProps): ReactElement | null {
  const bands = surfaceBandsFor(codes, anatomy.quadrant);
  if (bands.length === 0) return null;
  const patternId = paint.pattern ? `${idPrefix}-pattern` : null;
  return (
    <>
      {patternId && paint.pattern && (
        <defs>
          <CrownPatternDefs id={patternId} kind={paint.pattern} />
        </defs>
      )}
      <defs>
        <clipPath id={`${idPrefix}-clip`}>
          <path d={anatomy.crownPath} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${idPrefix}-clip)`}>
        {bands.map((band) => (
          <rect
            key={`fill-${band.code}`}
            x={band.rect.x}
            y={band.rect.y}
            width={band.rect.w}
            height={band.rect.h}
            fill={paint.fill}
          />
        ))}
        {patternId &&
          bands.map((band) => (
            <rect
              key={`pattern-${band.code}`}
              x={band.rect.x}
              y={band.rect.y}
              width={band.rect.w}
              height={band.rect.h}
              fill={`url(#${patternId})`}
            />
          ))}
      </g>
    </>
  );
}

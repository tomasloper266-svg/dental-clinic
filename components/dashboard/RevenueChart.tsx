import type { DailySeriesPoint } from "@/lib/services/reports";
import { formatSyp } from "@/lib/utils";
import { cn } from "@/components/ui/cn";

// رسم المدخول لآخر 7 أيام — أعمدة بسيطة من عناصر div حصراً بلا مكتبات جديدة.
// الحساب النقي هنا والعرض خالص من بيانات التقارير القائمة.

const DAY_FMT = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  weekday: "short",
});

/** تسمية اليوم القصيرة العربية من مفتاح اليوم YYYY-MM-DD — دالة نقية */
export function shortDayLabel(dateKey: string): string {
  return DAY_FMT.format(new Date(dateKey + "T00:00:00Z"));
}

/**
 * نقي — ارتفاع كل عمود بالنسبة المئوية من أعلى قيمة، بأرضية صغيرة
 * لتبقى الأعمدة الصفرية مرئية كخط أساس.
 */
export function barHeights(
  points: ReadonlyArray<{ collectedSyp: number }>,
): number[] {
  const max = Math.max(...points.map((p) => p.collectedSyp), 0);
  return points.map((p) =>
    max > 0 ? Math.max((p.collectedSyp / max) * 100, 4) : 4,
  );
}

/** رسم أعمدة المدخول لآخر 7 أيام — أعمدة بلون الهوية وقيمها فوقها */
export function RevenueChart({ points }: { points: DailySeriesPoint[] }) {
  const heights = barHeights(points);
  return (
    <div
      role="img"
      aria-label="المدخول المجمّع لآخر 7 أيام"
      className="flex h-44 items-end justify-between gap-2"
    >
      {points.map((point, index) => (
        <div
          key={point.date}
          className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
        >
          <span className="numeric text-[10px] text-warm-500">
            {point.collectedSyp > 0 ? formatSyp(point.collectedSyp) : ""}
          </span>
          <div
            className={cn(
              "w-full max-w-9 rounded-t-md bg-primary-500/85",
              point.collectedSyp === 0 && "bg-primary-200",
            )}
            style={{ height: `${heights[index]}%` }}
          />
          <span className="text-[10px] text-warm-400">
            {shortDayLabel(point.date)}
          </span>
        </div>
      ))}
    </div>
  );
}

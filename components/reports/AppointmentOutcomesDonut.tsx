"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

// دونات نتائج المواعيد — SVG خالص: شرائح بألوان الحالات الدلالية من
// توكنات الهوية، المجموع في المركز، والأسطورة بجانبه. بلا مواعيد في
// الفترة تظهر حالة الفراغ بأيقونة سنّ ذهبية كما في المرجع.

import type { OutcomeStatus } from "@/lib/reports-period-view";
import { STATUS_META } from "@/lib/appointment-ui";

/** لون كل حالة — من توكنات الهوية حصراً، مطابقة لألوان الحالات في النظام */
const OUTCOME_COLORS: Record<OutcomeStatus, string> = {
  NO_SHOW: "var(--color-danger-500)",
  CONFIRMED: "var(--color-warning-500)",
  SCHEDULED: "var(--color-ink-600)",
  COMPLETED: "var(--color-primary-400)",
  IN_TREATMENT: "var(--color-warning-300)",
  CANCELLED: "var(--color-warm-300)",
};

/** تسمية الحالة — من مصدر التسميات الموحّد في النظام */
const outcomeLabel = (status: OutcomeStatus): string =>
  STATUS_META[status].label;

/** أيقونة السنّ — مسار SVG خاص لعدم توفّر سنّ في مكتبة الأيقونات */
function ToothIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3.5c-1.6 0-2 .8-3.2.8C6 4.3 4.5 6.4 4.5 9.2c0 3.4 1.7 4.6 2.2 8 .3 2 .9 3.3 1.8 3.3 1 0 1.2-2.4 1.9-5 .2-.8 1-.8 1.2 0 .7 2.6.9 5 1.9 5 .9 0 1.5-1.3 1.8-3.3.5-3.4 2.2-4.6 2.2-8 0-2.8-1.5-4.9-4.3-4.9-1.2 0-1.6-.8-3.2-.8Z" />
    </svg>
  );
}

const SIZE = 190;
const RADIUS = 68;
const STROKE = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function AppointmentOutcomesDonut({
  outcomes,
}: {
  outcomes: { status: OutcomeStatus; count: number }[];
}) {
  const { t } = useI18n();
  if (outcomes.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-14"
        role="status"
      >
        <ToothIcon className="size-12 text-warning-600/70" />
        <p className="text-sm font-semibold text-warm-500">
          {t("dashboard.noneInPeriod")}
        </p>
      </div>
    );
  }

  const total = outcomes.reduce((sum, o) => sum + o.count, 0);
  // تجميع الشرائح انطلاقاً من أعلى الدونات باتجاه عقارب الساعة
  let offset = CIRCUMFERENCE * 0.25;

  return (
    <div className="flex flex-wrap items-center justify-center gap-8 py-4">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-48 shrink-0"
        role="img"
        aria-label={t("reports.outcomesAria", { total: total })}
      >
        {outcomes.map((outcome) => {
          const fraction = outcome.count / total;
          const length = fraction * CIRCUMFERENCE;
          const dash = `${length} ${CIRCUMFERENCE - length}`;
          const circle = (
            <circle
              key={outcome.status}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={OUTCOME_COLORS[outcome.status]}
              strokeWidth={STROKE}
              strokeDasharray={dash}
              strokeDashoffset={offset}
            >
              <title>{`${outcomeLabel(outcome.status)}: ${outcome.count}`}</title>
            </circle>
          );
          offset -= length;
          return circle;
        })}
        <text
          x={SIZE / 2}
          y={SIZE / 2 - 4}
          textAnchor="middle"
          fontSize={30}
          fontWeight={700}
          fill="var(--color-ink-900)"
        >
          {total}
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 18}
          textAnchor="middle"
          fontSize={12}
          fill="var(--color-warm-500)"
        >
          {t("appointments.appointment")}
        </text>
      </svg>

      <ul className="flex min-w-36 flex-col gap-2.5">
        {outcomes.map((outcome) => (
          <li key={outcome.status} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: OUTCOME_COLORS[outcome.status] }}
            />
            <span className="text-warm-700">
              {outcomeLabel(outcome.status)}
            </span>
            <span className="numeric ms-auto font-bold text-ink-900">
              {outcome.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

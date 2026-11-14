"use client";

// أعمدة أفقية ذهبية — للإيراد حسب الطبيب وحسب نوع العلاج: الاسم يميناً،
// الشريط بتدرج كهرماني بنسبة الإيراد من الأعلى، والمبلغ منسّقاً يساراً.
// الصفوف تنازلية بالقيمة كما يرتبها المتصل.

export default function HorizontalRevenueBars({
  rows,
  amountText,
}: {
  rows: { label: string; value: number }[];
  /** تنسيق المبلغ المعروض — منسّق مسبقاً من المتصل */
  amountText: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <ul className="flex flex-col gap-3.5 py-1">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-sm text-warm-800">
            {row.label}
          </span>
          <span
            role="img"
            aria-label={`${row.label}: ${amountText(row.value)}`}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken"
          >
            <span
              className="block h-full rounded-full bg-gradient-to-l from-warning-300 to-warning-500"
              style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
            />
          </span>
          <span className="numeric w-20 shrink-0 text-end text-sm font-semibold text-warning-600">
            {amountText(row.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

import Link from "next/link";
import type { PeriodontalSummary } from "@/lib/odontogram/periodontal-view";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

// بطاقة ملخص الدواعم في صفحة المريض — تقرير متابعة سريري لا مالي: أسنان
// بجيوب عميقة، مواضع النزيف، وأسنان بحركية مرتفعة. بلا قراءات لا بطاقة.
// الأرقام من آخر قياس لكل سن — السجل الإلحاقي يبقى كاملاً في الأودوغرام.

type Props = {
  summary: PeriodontalSummary;
  patientId: string;
};

function formatDateAr(iso: string): string {
  return new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    dateStyle: "medium",
  }).format(new Date(iso));
}

export default function PeriodontalSummaryCard({ summary, patientId }: Props) {
  const stats: Array<{
    label: string;
    value: number;
    flagged: boolean;
    hint: string;
  }> = [
    {
      label: "أسنان بجيب ≥5مم",
      value: summary.teethWithPocket5Plus,
      flagged: summary.teethWithPocket5Plus > 0,
      hint: "من آخر قياس لكل سن",
    },
    {
      label: "مواضع النزيف عند الجس",
      value: summary.bleedingSites,
      flagged: summary.bleedingSites > 0,
      hint: "نزيف في آخر قياس",
    },
    {
      label: "أسنان بحركية ≥2",
      value: summary.teethWithMobility2Plus,
      flagged: summary.teethWithMobility2Plus > 0,
      hint: "حركية ملموسة",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>ملخص الدواعم</CardTitle>
        {summary.lastMeasuredAt && (
          <span className="text-warm-400 numeric text-xs">
            آخر قياس: {formatDateAr(summary.lastMeasuredAt)}
          </span>
        )}
      </CardHeader>
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border-warm-200 bg-surface rounded-field border p-3"
          >
            <p
              className={`numeric text-xl font-bold ${stat.flagged ? "text-danger-600" : "text-ink-900"}`}
            >
              {stat.value}
            </p>
            <p className="text-warm-600 mt-0.5 text-xs font-medium">
              {stat.label}
            </p>
            <p className="text-warm-400 mt-0.5 text-[11px]">{stat.hint}</p>
          </div>
        ))}
      </div>
      <p className="text-warm-400 mt-3 text-[11px]">
        التفاصيل والقياسات الكاملة في{" "}
        <Link
          href={`/patients/${patientId}/odontogram`}
          className="text-primary-600 font-medium hover:underline"
        >
          الأودوغرام
        </Link>{" "}
        — تسجيل القياسات إلحاقي ولا يستبدل سابقاً.
      </p>
    </Card>
  );
}

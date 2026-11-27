import Link from "next/link";
import type { PeriodontalSummary } from "@/lib/odontogram/periodontal-view";
import { useI18n } from "@/components/i18n/I18nProvider";
import { formatDate } from "@/lib/i18n/format";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

// بطاقة ملخص الدواعم في صفحة المريض — تقرير متابعة سريري لا مالي: أسنان
// بجيوب عميقة، مواضع النزيف، وأسنان بحركية مرتفعة. بلا قراءات لا بطاقة.
// الأرقام من آخر قياس لكل سن — السجل الإلحاقي يبقى كاملاً في الأودوغرام.

type Props = {
  summary: PeriodontalSummary;
  patientId: string;
};

export default function PeriodontalSummaryCard({ summary, patientId }: Props) {
  const { t, locale } = useI18n();
  const stats: Array<{
    label: string;
    value: number;
    flagged: boolean;
    hint: string;
  }> = [
    {
      label: t("perio.pocket"),
      value: summary.teethWithPocket5Plus,
      flagged: summary.teethWithPocket5Plus > 0,
      hint: t("perio.pocketHint"),
    },
    {
      label: t("perio.bleeding"),
      value: summary.bleedingSites,
      flagged: summary.bleedingSites > 0,
      hint: t("perio.bleedingHint"),
    },
    {
      label: t("perio.mobility"),
      value: summary.teethWithMobility2Plus,
      flagged: summary.teethWithMobility2Plus > 0,
      hint: t("perio.mobilityHint"),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("perio.title")}</CardTitle>
        {summary.lastMeasuredAt && (
          <span className="text-warm-400 numeric text-xs">
            {t("perio.lastMeasured", {
              date: formatDate(summary.lastMeasuredAt, locale, {
                dateStyle: "medium",
              }),
            })}
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
        {t("perio.detailsPre")}{" "}
        <Link
          href={`/patients/${patientId}/odontogram`}
          className="text-primary-600 font-medium hover:underline"
        >
          {t("nav.odontogram")}
        </Link>{" "}
        {t("perio.detailsPost")}
      </p>
    </Card>
  );
}

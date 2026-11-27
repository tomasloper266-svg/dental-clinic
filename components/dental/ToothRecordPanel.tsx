"use client";
import { createT, type Locale } from "@/lib/i18n/core";
import { useI18n } from "@/components/i18n/I18nProvider";

import { toothName } from "@/lib/odontogram/fdi";
import type { FindingDto } from "@/lib/services/findings";
import type { PeriodontalReadingDto } from "@/lib/services/periodontal";
import ToothRecordForm from "@/components/odontogram/ToothRecordForm";

// لوحة تسجيل حالة السن في المخطط الوطني — نموذج التسجيل مشترك (ToothRecordForm)
// مع لوحة الأودوغرام في ملف المريض: قيد إلحاقي عبر مسار findings، والسجل
// السابق يبقى محفوظاً. ما تبقى هنا حجج هذه اللوحة: زر الحفظ الذهبي وتسمياتها.

type Props = {
  patientId: string;
  fdi: number;
  /** سجل هذا السن — للعرض أسفل اللوحة */
  history: FindingDto[];
  onSaved: (finding: FindingDto) => void;
  /** قراءات الدواعم للمريض — تفتح تبويب الدواعم في النموذج المشترك */
  readings?: PeriodontalReadingDto[];
  onReadingSaved?: (reading: PeriodontalReadingDto) => void;
};

export default function ToothRecordPanel({
  patientId,
  fdi,
  history,
  onSaved,
  readings,
  onReadingSaved,
}: Props) {
  const { t } = useI18n();
  return (
    <ToothRecordForm
      patientId={patientId}
      fdi={fdi}
      history={history}
      onSaved={onSaved}
      saveVariant="gold"
      kindHeading={t("finance.entryType")}
      noteInputId={`chart-note-${fdi}`}
      readings={readings}
      onReadingSaved={onReadingSaved}
    />
  );
}

// اسم كامل للسن في ترويسة اللوحة — نفس دالة الملف المرجعي
export function toothPanelTitle(locale: Locale, fdi: number): string {
  const t = createT(locale);
  return `${t("dental.toothAria", { fdi })} — ${toothName(locale, fdi) ?? ""}`;
}

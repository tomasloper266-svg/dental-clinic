"use client";

import { toothNameAr } from "@/lib/odontogram/fdi";
import type { FindingDto } from "@/lib/services/findings";
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
};

export default function ToothRecordPanel({
  patientId,
  fdi,
  history,
  onSaved,
}: Props) {
  return (
    <ToothRecordForm
      patientId={patientId}
      fdi={fdi}
      history={history}
      onSaved={onSaved}
      saveVariant="gold"
      kindHeading="نوع القيد"
      noteInputId={`chart-note-${fdi}`}
    />
  );
}

// اسم كامل للسن في ترويسة اللوحة — نفس دالة الملف المرجعي
export function toothPanelTitle(fdi: number): string {
  return `السن ${fdi} — ${toothNameAr(fdi) ?? ""}`;
}

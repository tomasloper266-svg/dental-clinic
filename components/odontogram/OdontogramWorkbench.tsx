"use client";

import { useState, type ReactNode } from "react";
import OdontogramBoard from "./OdontogramBoard";
import TreatmentPlanSection from "./TreatmentPlanSection";
import type { FindingDto } from "@/lib/services/findings";
import type { PlanItemDto } from "@/lib/services/treatment-plan";

// سطح العمل الكامل لمريض واحد — اختيار السن على الأودوغرام يعبّئ بند الخطة الجديد.
type Props = {
  patientId: string;
  initialFindings: FindingDto[];
  initialPlan: PlanItemDto[];
  // سن مبدئي من رابط ?tooth= — يفتح لوحة السن عند الوصول من لوحة الخطط.
  initialTooth?: number | null;
  // بطاقة ملخص مالي للمريض (server-rendered) — تظهر بجانب خطة العلاج
  // في صفحة المخطط الموحّدة فقط؛ صفحة ملف المريض لا تمررها فتبقى الخطة بعرض كامل.
  financial?: ReactNode;
};

export default function OdontogramWorkbench({
  patientId,
  initialFindings,
  initialPlan,
  initialTooth = null,
  financial = null,
}: Props) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(
    initialTooth,
  );

  return (
    <div className="min-w-0 space-y-4">
      <OdontogramBoard
        patientId={patientId}
        initialFindings={initialFindings}
        selectedTooth={selectedTooth}
        onSelectTooth={setSelectedTooth}
      />
      <div
        className={
          financial
            ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
            : undefined
        }
      >
        <TreatmentPlanSection
          patientId={patientId}
          initialItems={initialPlan}
          preselectedTooth={selectedTooth}
        />
        {financial}
      </div>
    </div>
  );
}

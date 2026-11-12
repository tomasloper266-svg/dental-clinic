"use client";

import { useState } from "react";
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
};

export default function OdontogramWorkbench({
  patientId,
  initialFindings,
  initialPlan,
  initialTooth = null,
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
      <TreatmentPlanSection
        patientId={patientId}
        initialItems={initialPlan}
        preselectedTooth={selectedTooth}
      />
    </div>
  );
}

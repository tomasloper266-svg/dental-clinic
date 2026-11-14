-- خطط العلاج ككيان مستقل + حالتا سن جديدتان — إضافة إلحاقية آمنة لا تمس بيانات قائمة:
-- البنود القائمة تبقى بلا خطة (planId = NULL) وتُعرض «بدون خطة محفوظة».

-- حالتان جديدتان لسجل الأسنان (المكسور، الحساسية) — مكمّلتان لمجموع الحالات
ALTER TYPE "ToothStatus" ADD VALUE IF NOT EXISTS 'BROKEN';
ALTER TYPE "ToothStatus" ADD VALUE IF NOT EXISTS 'SENSITIVITY';

-- جدول الخطط — الاسم والتاريخ والملاحظات ونهاية الخطة (NULL = نشطة)
CREATE TABLE IF NOT EXISTS "TreatmentPlan" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doctorName" TEXT,
    "notes" TEXT,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreatmentPlan_pkey" PRIMARY KEY ("id")
);

-- ربط البنود بالخطة — اختياري حفاظاً على البنود القائمة
ALTER TABLE "TreatmentPlanItem" ADD COLUMN IF NOT EXISTS "planId" TEXT;

CREATE INDEX IF NOT EXISTS "TreatmentPlan_clinicId_patientId_idx" ON "TreatmentPlan"("clinicId", "patientId");
CREATE INDEX IF NOT EXISTS "TreatmentPlanItem_planId_idx" ON "TreatmentPlanItem"("planId");

DO $$ BEGIN
  ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TreatmentPlanItem" ADD CONSTRAINT "TreatmentPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

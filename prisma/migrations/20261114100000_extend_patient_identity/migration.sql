-- توسعة بطاقة المريض — إضافة آمنة لا تمس أي بيانات قائمة:
-- أعمدة اختيارية كلها (NULL)، ونوع Gender جديد، ورقم الملف (الأيوبي)
-- فريداً داخل العيادة (الفريد المركّب يقبل تكرار NULL في PostgreSQL).
-- ترقيم المرضى القائمين لا يُنشأ هنا — يُحسم عند أول تحديث خدمي إن لزم.

DO $$ BEGIN
  CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "gender" "Gender";
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "secondaryPhone" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "homePhone" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "nationalId" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "bloodType" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "allergies" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "chronicDiseases" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "emergencyContacts" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "fileNo" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "Patient_clinicId_fileNo_key" ON "Patient"("clinicId", "fileNo");

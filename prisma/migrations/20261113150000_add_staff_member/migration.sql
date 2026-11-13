-- الطاقم وربط الموعد بالطبيب — إضافة آمنة لا تمس أي بيانات قائمة.
-- جدول StaffMember جديد بالكامل، وعمود staffId اختياري (NULL) على المواعيد.

DO $$ BEGIN
  CREATE TYPE "StaffRole" AS ENUM ('DENTIST', 'RECEPTION', 'ASSISTANT', 'ACCOUNTANT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "StaffMember" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'DENTIST',
    "specialty" TEXT,
    "phone" TEXT,
    "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "colorHex" TEXT NOT NULL DEFAULT '#d4af37',
    "scheduleNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StaffMember_clinicId_name_idx" ON "StaffMember"("clinicId", "name");

DO $$ BEGIN
  ALTER TABLE "StaffMember"
    ADD CONSTRAINT "StaffMember_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "staffId" TEXT;

CREATE INDEX IF NOT EXISTS "Appointment_clinicId_staffId_startsAt_idx" ON "Appointment"("clinicId", "staffId", "startsAt");

DO $$ BEGIN
  ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

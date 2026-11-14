-- AlterTable: إعدادات العيادة العامة — العملة المعروضة وحرف الشعار والرصيد
-- الافتتاحي وساعات العمل (تُعدَّل من صفحة الإعدادات حصراً).
ALTER TABLE "Clinic" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Clinic" ADD COLUMN "logoLetter" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Clinic" ADD COLUMN "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Clinic" ADD COLUMN "workStart" TEXT NOT NULL DEFAULT '09:00 AM';
ALTER TABLE "Clinic" ADD COLUMN "workEnd" TEXT NOT NULL DEFAULT '09:00 PM';

-- AlterTable: قفل التطبيق لكل حساب مستقل (كقفل الهاتف) — الحالة وهاش
-- الرمز الرقمي؛ الرمز نفسه لا يُخزَّن أبداً.
ALTER TABLE "User" ADD COLUMN "lockEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "lockPinHash" TEXT;

-- CreateEnum: نوع النسخة الاحتياطية — تلقائية عند كل تحديث أو يدوية.
CREATE TYPE "BackupKind" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable: النسخ الاحتياطية (JSON) — آخر نسخة تلقائية فقط تُحفظ للعيادة.
CREATE TABLE "ClinicBackup" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "kind" "BackupKind" NOT NULL DEFAULT 'AUTO',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicBackup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicBackup_clinicId_kind_createdAt_idx" ON "ClinicBackup"("clinicId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "ClinicBackup" ADD CONSTRAINT "ClinicBackup_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

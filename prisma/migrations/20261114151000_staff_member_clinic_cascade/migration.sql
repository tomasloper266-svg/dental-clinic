-- حذف العيادة يسقط أعضاء طاقمها تلقائياً — نفس سلوك ClinicBackup
-- (P2003 في تنظيف اختبارات التكامل بعد ظهور بيانات طاقم حقيقية).
ALTER TABLE "StaffMember" DROP CONSTRAINT "StaffMember_clinicId_fkey";
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

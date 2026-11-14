-- فجوة 1 (إسناد الطبيب) وفجوة 2 (بنود الفاتورة) وفجوة 3 (ترشيح تخصيص الدفعة):
-- أعمدة إلحاقية اختيارية بالكامل — القيود القائمة تبقى كما هي بلا قيم،
-- والترحيل للخلف آمن (كل الأعمدة nullable والجدول الجديد فارغ).

-- فجوة 1: الطبيب المُسند لقيد الرسوم — حذف عضو الطاقم يفصل القيود فلا يُحذف قيد.
ALTER TABLE "LedgerEntry" ADD COLUMN "doctorId" TEXT;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "LedgerEntry_doctorId_idx" ON "LedgerEntry"("doctorId");

-- فجوة 3: ترشيح تخصيص الدفعة لفاتورة — RESTRICT كي لا يُحذف قيد رسوم
-- يشير إليه سطر دفعات (الدولة: الدفتر إلحاقي ولا تُعدَّل القيود).
ALTER TABLE "LedgerEntry" ADD COLUMN "appliedChargeId" TEXT;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_appliedChargeId_fkey" FOREIGN KEY ("appliedChargeId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- فجوة 2: بنود الفاتورة — تفصيل قيد الرسوم، تُحذف مع قيدها.
CREATE TABLE "LedgerEntryItem" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "amountSyp" INTEGER NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LedgerEntryItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LedgerEntryItem" ADD CONSTRAINT "LedgerEntryItem_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "LedgerEntryItem_entryId_idx" ON "LedgerEntryItem"("entryId");

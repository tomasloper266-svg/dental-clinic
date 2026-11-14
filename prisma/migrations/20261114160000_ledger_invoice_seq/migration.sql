-- تسلسل الرسوم على مستوى العيادة — رقم فاتورة فريد لكل عيادة.
-- NULL يتجاوز قيد الفريد (قاعدة PostgreSQL) فتبقى القيود القديمة بلا تسلسل.
ALTER TABLE "LedgerEntry" ADD COLUMN "invoiceSeq" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_clinicId_invoiceSeq_key" ON "LedgerEntry"("clinicId", "invoiceSeq");

-- قيد الرسوم المرتبط ببند علاج فريد — البند الواحد له قيد رسوم واحد حصراً.
-- القيم الفارغة (قيود غير مرتبطة ببند) لا تتأثر بقيود الفريدة في PostgreSQL.
CREATE UNIQUE INDEX "LedgerEntry_treatmentItemId_key" ON "LedgerEntry"("treatmentItemId");

-- سعر صرف الدولار بالليرة السورية — إضافة آمنة لا تمس أي بيانات قائمة.
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "usdRate" DOUBLE PRECISION NOT NULL DEFAULT 15000;

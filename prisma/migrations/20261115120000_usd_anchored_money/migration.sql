-- قلب الأساس: الدولار وحدة التخزين، والليرة عرض مشتق (syp = round(usd × rate)).
-- هجرة بيانات لمرة واحدة لكل عيادة: usd = round(syp / usdRate, 2) بسعر العيادة
-- الحالي وقت الهجرة — الأرقام الدولارية المعروضة لحظة الترقية تظل كما هي بلا
-- قفزة محاسبية. السعر موجب دائماً (تحقق الإعدادات)، فلا قسمة على صفر.
--
-- كل كتلة مشروطة بوجود العمود القديم/نوعه حتى تكون الهجرة قابلة لإعادة
-- التشغيل بعد انقطاع جزئي (فشل منتصف الطريق لا يضاعف التحويل ولا يُكرره).

-- LedgerEntry: من Int ليرة إلى DECIMAL(12,2) دولار.
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "amountUsd" DECIMAL(12, 2);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'LedgerEntry' AND column_name = 'amountSyp'
  ) THEN
    UPDATE "LedgerEntry" le
    SET "amountUsd" = ROUND(le."amountSyp"::numeric / c."usdRate"::numeric, 2)
    FROM "Clinic" c
    WHERE c.id = le."clinicId" AND le."amountUsd" IS NULL;
  END IF;
END $$;
ALTER TABLE "LedgerEntry" ALTER COLUMN "amountUsd" SET NOT NULL;
ALTER TABLE "LedgerEntry" DROP COLUMN IF EXISTS "amountSyp";

-- LedgerEntryItem: نفس وحدة قيد الرسوم الأب — السعر بسعر عيادة القيد.
ALTER TABLE "LedgerEntryItem" ADD COLUMN IF NOT EXISTS "amountUsd" DECIMAL(12, 2);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'LedgerEntryItem' AND column_name = 'amountSyp'
  ) THEN
    UPDATE "LedgerEntryItem" li
    SET "amountUsd" = ROUND(li."amountSyp"::numeric / c."usdRate"::numeric, 2)
    FROM "LedgerEntry" le
    JOIN "Clinic" c ON c.id = le."clinicId"
    WHERE le.id = li."entryId" AND li."amountUsd" IS NULL;
  END IF;
END $$;
ALTER TABLE "LedgerEntryItem" ALTER COLUMN "amountUsd" SET NOT NULL;
ALTER TABLE "LedgerEntryItem" DROP COLUMN IF EXISTS "amountSyp";

-- Expense: من Int ليرة إلى DECIMAL(12,2) دولار.
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "amountUsd" DECIMAL(12, 2);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Expense' AND column_name = 'amountSyp'
  ) THEN
    UPDATE "Expense" ex
    SET "amountUsd" = ROUND(ex."amountSyp"::numeric / c."usdRate"::numeric, 2)
    FROM "Clinic" c
    WHERE c.id = ex."clinicId" AND ex."amountUsd" IS NULL;
  END IF;
END $$;
ALTER TABLE "Expense" ALTER COLUMN "amountUsd" SET NOT NULL;
ALTER TABLE "Expense" DROP COLUMN IF EXISTS "amountSyp";

-- Material: تكلفة المادة (كانت ليرة بعشرية) إلى دولار — nullable كما هي.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Material' AND column_name = 'costSyp'
  ) THEN
    ALTER TABLE "Material" RENAME COLUMN "costSyp" TO "costUsd";
    ALTER TABLE "Material" ALTER COLUMN "costUsd" SET DATA TYPE DECIMAL(12, 2);
    UPDATE "Material" m
    SET "costUsd" = ROUND(m."costUsd"::numeric / c."usdRate"::numeric, 2)
    FROM "Clinic" c
    WHERE c.id = m."clinicId" AND m."costUsd" IS NOT NULL;
  END IF;
END $$;

-- TreatmentPlanItem: سعر العلاج من Int ليرة إلى DECIMAL(12,2) دولار — نفس
-- وحدة قيد الرسوم المشتق منه (سلسلة التسعير لا تقبل خلط وحدتين).
ALTER TABLE "TreatmentPlanItem" ADD COLUMN IF NOT EXISTS "priceUsd" DECIMAL(12, 2);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'TreatmentPlanItem' AND column_name = 'priceSyp'
  ) THEN
    UPDATE "TreatmentPlanItem" pi
    SET "priceUsd" = ROUND(pi."priceSyp"::numeric / c."usdRate"::numeric, 2)
    FROM "Clinic" c
    WHERE c.id = pi."clinicId" AND pi."priceUsd" IS NULL;
  END IF;
END $$;
ALTER TABLE "TreatmentPlanItem" ALTER COLUMN "priceUsd" SET NOT NULL;
ALTER TABLE "TreatmentPlanItem" DROP COLUMN IF EXISTS "priceSyp";

-- Clinic: الرصيد الافتتاحي من Float ليرة إلى DECIMAL(12,2) دولار — الشرط على
-- النوع يمنع تحويل قيمة محوّلة سابقاً مرة ثانية.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Clinic' AND column_name = 'openingBalance'
      AND data_type = 'double precision'
  ) THEN
    ALTER TABLE "Clinic" ALTER COLUMN "openingBalance" SET DATA TYPE DECIMAL(12, 2)
    USING ROUND("openingBalance"::numeric / "usdRate"::numeric, 2);
  END IF;
END $$;

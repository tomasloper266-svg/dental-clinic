-- اشتراكات العيادات: تجربة مجانية 15 يوماً ثم اشتراك إلزامي (شهري 15$ / سنوي 120$)
-- عبر شام كاش بحوالة يدوية. الحالة مشتقة من التواريخ حصراً — لا عمود حالة.

-- نهاية التجربة: عمود غير فارغ بافتراض قاعدي (+15 يوماً) كي لا تُنشأ عيادة
-- بلا بوابة حتى لو تجاوزت طبقة التطبيق. createClinicWithOwner يضبطه صراحةً.
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP + interval '15 days';

ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "subscriptionEndsAt" TIMESTAMP(3);

-- هدية الإطلاق: العيادات القائمة (سُجّلت قبل هذه الميزة) تأخذ سنة كاملة
-- كي لا تُقفل خارج النظام عند النشر — العيادات الجديدة وحدها تحصل على 15 يوماً.
UPDATE "Clinic" SET "trialEndsAt" = CURRENT_TIMESTAMP + interval '365 days';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionPlan') THEN
    CREATE TYPE "SubscriptionPlan" AS ENUM ('MONTHLY', 'YEARLY');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionPaymentStatus') THEN
    CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "amountUsd" DECIMAL(12,2) NOT NULL,
    "transferRef" TEXT NOT NULL,
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SubscriptionPayment_clinicId_fkey'
  ) THEN
    ALTER TABLE "SubscriptionPayment"
      ADD CONSTRAINT "SubscriptionPayment_clinicId_fkey"
      FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- تفرد رقم الحوالة بين المدفوعات المعتمدة فقط — حوالة معتمدة لا تُقبل مرة
-- ثانية (فهرس جزئي؛ القيد الجزئي غير معبَّر في مخطط Prisma).
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPayment_transferRef_approved_key"
  ON "SubscriptionPayment"("transferRef") WHERE "status" = 'APPROVED';

CREATE INDEX IF NOT EXISTS "SubscriptionPayment_clinicId_createdAt_idx" ON "SubscriptionPayment"("clinicId", "createdAt");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_status_createdAt_idx" ON "SubscriptionPayment"("status", "createdAt");

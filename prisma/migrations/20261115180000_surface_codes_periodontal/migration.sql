-- الترميز المرجعي للأسطح ومخطط الدواعم: تحويل ToothFinding.surface من نص حر
-- (عربي مجمّع بعلامة «+») إلى أكواد مرجعية (O/I/M/D/B/L مجمّعة بعلامة «+»)،
-- وإضافة إشارة السن/السطح إلى بنود الخطة والفواتير، وجدول قراءات الدواعم الإلحاقي.
-- الهجرة لا تفقد بيانات: أي نص لا يطابق الكتالوج يصبح OTHER ويُحفظ أصله في الملاحظة.

-- ─── أعمدة السطح على بنود الخطة والفواتير ────────────────────────────────────

ALTER TABLE "TreatmentPlanItem" ADD COLUMN IF NOT EXISTS "surface" TEXT;

ALTER TABLE "LedgerEntryItem" ADD COLUMN IF NOT EXISTS "toothFdi" INTEGER;

ALTER TABLE "LedgerEntryItem" ADD COLUMN IF NOT EXISTS "surface" TEXT;

-- ─── هجرة ترميز الأسطح على المشاهدات القائمة ─────────────────────────────────
-- كل رمز يُقارن بعد تقليم الفراغ: المطابق للكتالوج يصبح كوده، وما عدا ذلك
-- OTHER. النص الأصلي يُلحق بالملاحظة مرة واحدة إن وُجد رمز غير مطابق.

UPDATE "ToothFinding" AS tf
SET "surface" = map.codes,
    "note" = CASE
      WHEN map.legacy
        THEN concat_ws(' | ', tf."note", 'السطح القديم: ' || tf."surface")
      ELSE tf."note"
    END
FROM (
  SELECT
    t.id,
    (
      SELECT string_agg(d.code, '+' ORDER BY d.ord)
      FROM (
        SELECT DISTINCT ON (code) code, ord
        FROM (
          SELECT
            CASE btrim(u.part)
              WHEN 'المضغية' THEN 'O'
              WHEN 'الحدّية' THEN 'I'
              WHEN 'القريبة' THEN 'M'
              WHEN 'البعيدة' THEN 'D'
              WHEN 'الشدقية' THEN 'B'
              WHEN 'اللسانية' THEN 'L'
              ELSE 'OTHER'
            END AS code,
            u.ord
          FROM unnest(string_to_array(t."surface", '+')) WITH ORDINALITY AS u(part, ord)
          WHERE btrim(u.part) <> ''
        ) s
        ORDER BY code, ord
      ) d
    ) AS codes,
    EXISTS (
      SELECT 1
      FROM unnest(string_to_array(t."surface", '+')) AS v(part)
      WHERE btrim(v.part) <> ''
        AND btrim(v.part) NOT IN ('المضغية', 'الحدّية', 'القريبة', 'البعيدة', 'الشدقية', 'اللسانية')
    ) AS legacy
  FROM "ToothFinding" t
  WHERE t."surface" IS NOT NULL
) AS map
WHERE tf.id = map.id;

-- ─── قراءات الدواعم — سجل إلحاقي بالكامل ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PeriodontalReading" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "toothFdi" INTEGER NOT NULL,
    "pocketDepthMm" INTEGER,
    "recessionMm" INTEGER,
    "bleedingOnProbing" BOOLEAN NOT NULL DEFAULT false,
    "mobilityGrade" INTEGER,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodontalReading_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "PeriodontalReading" ADD CONSTRAINT "PeriodontalReading_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PeriodontalReading" ADD CONSTRAINT "PeriodontalReading_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PeriodontalReading" ADD CONSTRAINT "PeriodontalReading_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "PeriodontalReading_clinicId_patientId_toothFdi_idx" ON "PeriodontalReading"("clinicId", "patientId", "toothFdi");

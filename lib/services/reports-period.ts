import type { TenantContext } from "@/lib/tenant/context";
import { clinicScope } from "@/lib/tenant/clinic-client";
import { outstandingDuesUsd } from "@/lib/finance-view";
import { localDayOf, localDayStartUtc } from "@/lib/local-day";
import {
  appointmentOutcomeCounts,
  monthlyRevenue,
  patientGrowthMonthly,
  revenueByDoctor,
  revenueByProcedure,
  summarizePeriodLedger,
  topPatientsByCharges,
  type DayRange,
  type ReportsPeriodSummaryJson,
} from "@/lib/reports-period-view";

// خدمة تقرير الفترة — كل الأرقام من قيود الدفتر والمواعيد والمرضى كما هي،
// مجمّعة بالدوال النقية في lib/reports-period-view.ts بلا إعادة تفسير.
// المستحقات الحالية استثناء وحيد: رصيد الدفتر كاملاً (لا تُقيَّد بالفترة).

const DAY_MS = 24 * 60 * 60 * 1000;

// بداية اليوم بتوقيت العيادة (دمشق) — حركة منتصف الليل المحلي تبقى في يومها.

export async function getReportsPeriodSummary(
  ctx: TenantContext,
  range: DayRange,
): Promise<ReportsPeriodSummaryJson> {
  const db = clinicScope(ctx.clinicId);

  // أقدم يوم حركة أولاً — يُقصّ به بداية الفترة الفعلية حتى يبقى «الكل»
  // نطاقاً حقيقياً لا أشهراً فارغة من سبعينيات القرن.
  const [ledgerMin, appointmentMin, patientMin] = await Promise.all([
    db.ledgerEntry.aggregate({ _min: { createdAt: true } }),
    db.appointment.aggregate({ _min: { startsAt: true } }),
    db.patient.aggregate({ _min: { createdAt: true } }),
  ]);
  const rangeStartCandidates = [
    ledgerMin._min.createdAt,
    appointmentMin._min.startsAt,
    patientMin._min.createdAt,
  ]
    .filter((value): value is Date => value !== null)
    .map((value) => localDayOf(value))
    .sort();
  const rangeStart = rangeStartCandidates[0] ?? range.to;

  // نطاق زمني [من بداية from بتوقيت العيادة، بداية اليوم التالي لـ to) —
  // شامل الطرفين يومياً حسب أيام دمشق لا أيام UTC
  const effectiveFrom =
    range.from > rangeStart ? range.from : rangeStart;
  const effectiveRange: DayRange = { from: effectiveFrom, to: range.to };
  const from = localDayStartUtc(effectiveFrom);
  const to = new Date(localDayStartUtc(range.to).getTime() + DAY_MS);

  // نافذة نمو سجل المرضى: 12 شهراً منتهية بشهر نهاية الفترة
  const growthFrom = new Date(
    localDayStartUtc(range.to).getTime() - 365 * DAY_MS,
  );

  const [
    ledgerRowsRaw,
    appointmentRows,
    staffRows,
    growthPatients,
    allLedgerRaw,
  ] = await Promise.all([
    db.ledgerEntry.findMany({
      where: { createdAt: { gte: from, lt: to } },
      select: {
        id: true,
        type: true,
        amountUsd: true,
        patientId: true,
        doctorId: true,
        treatmentItemId: true,
        createdAt: true,
        patient: { select: { name: true } },
      },
    }),
    db.appointment.findMany({
      where: { startsAt: { gte: from, lt: to } },
      select: { patientId: true, staffId: true, startsAt: true, status: true },
    }),
    db.staffMember.findMany({ select: { id: true, name: true } }),
    db.patient.findMany({
      where: { createdAt: { gte: growthFrom, lt: to } },
      select: { createdAt: true },
    }),
    // المستحقات الحالية — رصيد الدفتر كاملاً بلا حدود فترة
    db.ledgerEntry.findMany({
      select: { patientId: true, amountUsd: true },
    }),
  ]);

  // Decimal → number عند حدود القراءة — وحدة الملخصات والتجميعات رقمية خالصة.
  const ledgerRows = ledgerRowsRaw.map((row) => ({
    ...row,
    amountUsd: Number(row.amountUsd),
  }));
  const allLedger = allLedgerRaw.map((row) => ({
    ...row,
    amountUsd: Number(row.amountUsd),
  }));

  // إجراءات بنود العلاج المشار إليها من قيود الفترة — تحتاج معرفات القيود
  // أولاً لذا تُجلب على دفعة منفصلة بعدها.
  const referencedItemIds = ledgerRows
    .map((row) => row.treatmentItemId)
    .filter((id): id is string => id !== null);
  const itemRows = await db.treatmentPlanItem.findMany({
    where: { id: { in: referencedItemIds } },
    select: { id: true, procedure: true },
  });

  // بنود الفواتير (LedgerEntryItem) لقيود رسوم الفترة — أساس تجميع الإيراد
  // حسب نوع العلاج، والقيود بلا بنود ترجع لربط بند الخطة أو «بدون تصنيف».
  const charges = ledgerRows.filter((row) => row.type === "CHARGE");
  const chargeIds = charges.map((row) => row.id);
  const invoiceItemRows =
    chargeIds.length > 0
      ? await db.ledgerEntryItem.findMany({
          where: { entryId: { in: chargeIds } },
          select: { entryId: true, category: true, amountUsd: true },
        })
      : [];
  const itemsByEntryId = new Map<string, { category: string | null; amountUsd: number }[]>();
  for (const row of invoiceItemRows) {
    const list = itemsByEntryId.get(row.entryId) ?? [];
    list.push({ category: row.category, amountUsd: Number(row.amountUsd) });
    itemsByEntryId.set(row.entryId, list);
  }

  const staffNames = new Map(staffRows.map((s) => [s.id, s.name] as const));
  const procedureByItemId = new Map(
    itemRows.map((item) => [item.id, item.procedure] as const),
  );

  const today = range.to;

  return {
    from: effectiveRange.from,
    to: range.to,
    ...summarizePeriodLedger(ledgerRows),
    outstandingUsd: outstandingDuesUsd(allLedger),
    monthlyRevenue: monthlyRevenue(charges, effectiveRange),
    appointmentOutcomes: appointmentOutcomeCounts(appointmentRows),
    revenueByDoctor: revenueByDoctor(
      charges.map((row) => ({
        patientId: row.patientId,
        amountUsd: row.amountUsd,
        createdAt: row.createdAt,
        doctorId: row.doctorId,
      })),
      appointmentRows.map((row) => ({
        patientId: row.patientId,
        staffId: row.staffId,
        startsAt: row.startsAt,
      })),
      (staffId) => staffNames.get(staffId),
    ),
    revenueByProcedure: revenueByProcedure(
      charges.map((row) => ({
        treatmentItemId: row.treatmentItemId,
        amountUsd: row.amountUsd,
        items: itemsByEntryId.get(row.id),
      })),
      procedureByItemId,
    ),
    topPatients: topPatientsByCharges(
      charges.map((row) => ({
        patientId: row.patientId,
        patientName: row.patient.name,
        amountUsd: row.amountUsd,
      })),
    ),
    patientGrowth: patientGrowthMonthly(
      growthPatients.map((row) => row.createdAt),
      today,
    ),
    rangeStart,
  };
}

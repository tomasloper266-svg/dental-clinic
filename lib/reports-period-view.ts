import { toCsv } from "@/lib/csv";
import { localMonthKeyOf } from "@/lib/local-day";

// بيانات عرض تقرير الفترة — نقية بلا I/O وتُختبر وحدوياً. كل الدوال تأخذ
// الصفوف الخام (قيود الدفتر، المواعيد، المرضى) وتعيد أرقام العرض، فلا
// يُعاد تفسير أي حساب في الواجهة. أنواع البيانات مُعرَّفة هنا فقط لتجنّب
// سحب كود الخادم إلى حزمة المتصفح.

/** خيارات الفترة الجاهزة — الكل ثم التمددات الزمنية */
export type ReportsPeriodPreset = "all" | "30d" | "3m" | "6m" | "year";

/** «مخصص» ليس خياراً معروضاً — يُفعَّل بتحرير أحد حقلَي من/إلى يدوياً */
export type ReportsPeriodSelection = ReportsPeriodPreset | "custom";

export const PERIOD_PRESET_OPTIONS: ReadonlyArray<{
  value: ReportsPeriodPreset;
  label: string;
}> = [
  { value: "all", label: "الكل" },
  { value: "30d", label: "آخر 30 يوم" },
  { value: "3m", label: "آخر 3 أشهر" },
  { value: "6m", label: "آخر 6 أشهر" },
  { value: "year", label: "السنة كاملة" },
];

/** نطاق الفترة — يومان بصيغة YYYY-MM-DD (شاملان) بتوقيت UTC */
export type DayRange = { from: string; to: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** نقي — إزاحة يوم بصيغة YYYY-MM-DD بعدد أشهر مع تقليم اليوم لآخر الشهر */
export function shiftMonthDay(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const clamped = Math.min(d, lastDay);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}

/**
 * نقي — حدود الفترة لكل خيار جاهز. «الكل» يبدأ من أقدم يوم حركة بالعيادة
 * (rangeStart من الخدمة) حتى اليوم، والبقية نافذة منتهية باليوم.
 */
export function presetRange(
  preset: ReportsPeriodPreset,
  today: string,
  rangeStart: string,
): DayRange {
  switch (preset) {
    case "all":
      return { from: rangeStart, to: today };
    case "30d":
      return {
        from: new Date(new Date(`${today}T00:00:00Z`).getTime() - 29 * DAY_MS)
          .toISOString()
          .slice(0, 10),
        to: today,
      };
    case "3m":
      return { from: shiftMonthDay(today, -3), to: today };
    case "6m":
      return { from: shiftMonthDay(today, -6), to: today };
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/** مفتاح الشهر YYYY-MM من تاريخ كامل أو يوم */
export function monthKeyOf(day: string): string {
  return day.slice(0, 7);
}

/** نقي — أشهر النطاق من شهر from إلى شهر to (شاملان) بترتيب زمني */
export function monthsCovered(range: DayRange): string[] {
  const months: string[] = [];
  const [y, m] = range.from.split("-").map(Number) as [number, number];
  const lastKey = monthKeyOf(range.to);
  let cursor = new Date(Date.UTC(y, m - 1, 1));
  while (cursor.toISOString().slice(0, 7) <= lastKey) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return months;
}

/** تسمية الشهر بالعربية — «آب» و«تشرين الأول» بأرقام لاتينية للأشهر فقط */
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("ar-SY-u-nu-latn", { month: "long" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
}

/** ملخص قيود الفترة — فواتير ومدفوعات، بلا أي تفسير جديد للرصيد.
 * التعريفان منفصلان عمداً: «فواتير صادرة» = مجموع الرسوم، و«محصّل الفترة» =
 * مجموع قيمة الدفعات — الدمج بينهما هو مصدر سوء الفهم الوحيد مع المرجع. */
export function summarizePeriodLedger(entries: ReadonlyArray<{
  type: string;
  amountUsd: number;
}>): {
  totalChargesUsd: number;
  totalPaymentsUsd: number;
  invoiceCount: number;
  paymentCount: number;
} {
  let totalChargesUsd = 0;
  let totalPaymentsUsd = 0;
  let invoiceCount = 0;
  let paymentCount = 0;
  for (const entry of entries) {
    if (entry.type === "CHARGE") {
      totalChargesUsd += entry.amountUsd;
      invoiceCount += 1;
    } else if (entry.type === "PAYMENT") {
      totalPaymentsUsd += Math.abs(entry.amountUsd);
      paymentCount += 1;
    }
  }
  return { totalChargesUsd, totalPaymentsUsd, invoiceCount, paymentCount };
}

/** حالات المواعيد الست — الترتيب الثابت للعرض في الدونات والأسطورة */
export type OutcomeStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "IN_TREATMENT"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export const OUTCOME_ORDER: ReadonlyArray<OutcomeStatus> = [
  "NO_SHOW",
  "CONFIRMED",
  "SCHEDULED",
  "COMPLETED",
  "IN_TREATMENT",
  "CANCELLED",
];

/**
 * نقي — نتائج المواعيد بعدّاد لكل حالة بترتيب ثابت، والحالات صفرية
 * تُحذف حتى لا تظهر بنداً فارغاً في الأسطورة (كالمرجع).
 */
export function appointmentOutcomeCounts(
  appointments: ReadonlyArray<{ status: string }>,
): { status: OutcomeStatus; count: number }[] {
  const counts = new Map<OutcomeStatus, number>();
  for (const appointment of appointments) {
    const status = appointment.status as OutcomeStatus;
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return OUTCOME_ORDER.filter((s) => (counts.get(s) ?? 0) > 0).map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
}

const NO_DOCTOR_LABEL = "بدون طبيب محدد";

/**
 * نقي — نسبة قيود الرسوم إلى الأطباء. الطبيب المخزّن على القيد (doctorId)
 * هو الأولوية دائماً — قيمته محفوظة لحظة الإنشاء فتتقدم على أي استنتاج.
 * لقيود الدفتر القديمة بلا طبيب مخزّن يُستنتج الطبيب من أحدث موعد للمريض
 * الذي له طبيب مسند وقبل القيد. القيود بلا طبيب مخزّن ولا موعد مسند تجتمع
 * تحت «بدون طبيب محدد». النتيجة تنازلية بالمبلغ.
 */
export function revenueByDoctor(
  charges: ReadonlyArray<{
    patientId: string;
    amountUsd: number;
    createdAt: string | Date;
    doctorId?: string | null;
  }>,
  appointments: ReadonlyArray<{
    patientId: string;
    staffId: string | null;
    startsAt: string | Date;
  }>,
  staffName: (staffId: string) => string | undefined,
): { doctor: string; chargesUsd: number }[] {
  const byPatient = new Map<string, { staffId: string; startsAt: number }[]>();
  for (const appointment of appointments) {
    if (!appointment.staffId) continue;
    const list = byPatient.get(appointment.patientId) ?? [];
    list.push({
      staffId: appointment.staffId,
      startsAt: new Date(appointment.startsAt).getTime(),
    });
    byPatient.set(appointment.patientId, list);
  }

  const totals = new Map<string, number>();
  for (const charge of charges) {
    let key: string | undefined;
    // الطبيب المخزّن على القيد يُقدَّم على الاستنتاج الاحتياطي من المواعيد.
    if (charge.doctorId) {
      key = staffName(charge.doctorId) ?? NO_DOCTOR_LABEL;
    }
    if (key === undefined) {
      const chargeTime = new Date(charge.createdAt).getTime();
      let best = -Infinity;
      for (const appointment of byPatient.get(charge.patientId) ?? []) {
        if (appointment.startsAt <= chargeTime && appointment.startsAt > best) {
          best = appointment.startsAt;
          key = staffName(appointment.staffId) ?? NO_DOCTOR_LABEL;
        }
      }
    }
    totals.set(key ?? NO_DOCTOR_LABEL, (totals.get(key ?? NO_DOCTOR_LABEL) ?? 0) + charge.amountUsd);
  }

  return [...totals.entries()]
    .map(([doctor, chargesUsd]) => ({ doctor, chargesUsd }))
    .sort((a, b) => b.chargesUsd - a.chargesUsd);
}

const NO_PROCEDURE_LABEL = "بدون تصنيف";

/** بند فاتورة كما يجمعه التقرير — تصنيف نصي حر ومبلغه */
type ChargeItemInput = { category: string | null; amountUsd: number };

/**
 * نقي — إيراد الرسوم حسب نوع العلاج، تنازلياً. مصدر التجميع بنود الفاتورة
 * (LedgerEntryItem): كل بند يقع تحت تصنيفه النصي الحر، والبند بلا تصنيف
 * تحت «بدون تصنيف». قيد بلا بنود (قيود يدوية مفردة) يرجع لربط بند خطة
 * العلاج، وقيد بلا بنود ولا ربط يظهر كاملاً تحت «بدون تصنيف».
 */
export function revenueByProcedure(
  charges: ReadonlyArray<{
    treatmentItemId: string | null;
    amountUsd: number;
    items?: ReadonlyArray<ChargeItemInput>;
  }>,
  procedureByItemId: ReadonlyMap<string, string>,
): { procedure: string; chargesUsd: number }[] {
  const totals = new Map<string, number>();
  const add = (procedure: string, amountUsd: number) => {
    totals.set(procedure, (totals.get(procedure) ?? 0) + amountUsd);
  };
  for (const charge of charges) {
    if (charge.items && charge.items.length > 0) {
      for (const item of charge.items) {
        add(item.category?.trim() || NO_PROCEDURE_LABEL, item.amountUsd);
      }
      continue;
    }
    const procedure =
      (charge.treatmentItemId && procedureByItemId.get(charge.treatmentItemId)) ??
      NO_PROCEDURE_LABEL;
    add(procedure, charge.amountUsd);
  }
  return [...totals.entries()]
    .map(([procedure, chargesUsd]) => ({ procedure, chargesUsd }))
    .sort((a, b) => b.chargesUsd - a.chargesUsd);
}

/** نقي — أعلى المرضى بمجموع قيود رسومهم في الفترة، تنازلياً */
export function topPatientsByCharges(
  charges: ReadonlyArray<{
    patientId: string;
    patientName: string;
    amountUsd: number;
  }>,
  // سقف عرض كبير بلا اقتصاص عملي — حدّ 7 كان يقصّ مرضي فترة حقيقية
  limit = 25,
): { patientId: string; patientName: string; chargesUsd: number }[] {
  const totals = new Map<string, { name: string; total: number }>();
  for (const charge of charges) {
    const current = totals.get(charge.patientId) ?? {
      name: charge.patientName,
      total: 0,
    };
    current.total += charge.amountUsd;
    totals.set(charge.patientId, current);
  }
  return [...totals.entries()]
    .map(([patientId, p]) => ({
      patientId,
      patientName: p.name,
      chargesUsd: p.total,
    }))
    .sort((a, b) => b.chargesUsd - a.chargesUsd)
    .slice(0, limit);
}

/**
 * نقي — نمو سجل المرضى: آخر count شهراً منتهية بشهر نهاية الفترة، بعدد
 * المرضى المسجلين في كل شهر. النافذة ثابتة الطول حتى يبقى الرسم قراءته
 * ممكنة مهما ضاقت الفترة (كالمرجع).
 */
export function patientGrowthMonthly(
  createdAts: ReadonlyArray<string | Date>,
  endDay: string,
  count = 12,
): { month: string; count: number }[] {
  const months = monthsCovered({
    from: shiftMonthDay(endDay, -(count - 1)),
    to: endDay,
  }).slice(-count);
  const index = new Map(months.map((m, i) => [m, i] as const));
  const counts = months.map((month) => ({ month, count: 0 }));
  for (const createdAt of createdAts) {
    // شهر التسجيل بتوقيت العيادة لا UTC — تسجيل منتصف الليل المحلي يبقى في شهره
    const position = index.get(localMonthKeyOf(createdAt));
    if (position !== undefined) counts[position].count += 1;
  }
  return counts;
}

/** نقي — توزيع رسوم الفترة على أشهرها؛ كل شهر يظهر حتى بلا حركة */
export function monthlyRevenue(
  charges: ReadonlyArray<{ amountUsd: number; createdAt: string | Date }>,
  range: DayRange,
): { month: string; chargesUsd: number }[] {
  const buckets = monthsCovered(range).map((month) => ({ month, chargesUsd: 0 }));
  const index = new Map(buckets.map((b, i) => [b.month, i] as const));
  for (const charge of charges) {
    // شهر القيد بتوقيت العيادة لا UTC — حركة منتصف الليل المحلي تبقى في شهرها
    const position = index.get(localMonthKeyOf(charge.createdAt));
    if (position !== undefined) buckets[position].chargesUsd += charge.amountUsd;
  }
  return buckets;
}

// ─── تصدير CSV ───────────────────────────────────────────────────────────────

// عمود الدولار — المبلغ المخزن كما هو (بمنزلتين). عمود الليرة مشتق بالضرب
// في السعر الحالي لحظة التصدير.
function usdCell(usd: number): number {
  return Math.round(usd * 100) / 100;
}

function sypCell(usd: number, rate: number): number {
  return Math.round(usd * rate);
}

/**
 * نقي — ملف CSV لكامل بيانات الفترة: البطاقات ثم كل قسم من أقسام التقرير
 * كجدول مستقل بفاصل أسطر فارغ. المبالغ بالدولار والليرة معاً.
 */
export function buildPeriodCsv(
  summary: ReportsPeriodSummaryJson,
  usdRate: number,
): string {
  const blocks: string[] = [];

  blocks.push(
    toCsv(
      ["البند", "القيمة ($)", "القيمة (ل.س)"],
      [
        [
          "إجمالي الفواتير",
          usdCell(summary.totalChargesUsd),
          sypCell(summary.totalChargesUsd, usdRate),
        ],
        ["عدد الفواتير الصادرة", summary.invoiceCount, ""],
        [
          "متوسط الفاتورة",
          usdCell(
            summary.invoiceCount > 0
              ? summary.totalChargesUsd / summary.invoiceCount
              : 0,
          ),
          "",
        ],
        ["عدد الدفعات المستلمة", summary.paymentCount, ""],
        [
          "محصّل الفترة",
          usdCell(summary.totalPaymentsUsd),
          sypCell(summary.totalPaymentsUsd, usdRate),
        ],
        [
          "متوسط الدفعة",
          usdCell(
            summary.paymentCount > 0
              ? summary.totalPaymentsUsd / summary.paymentCount
              : 0,
          ),
          "",
        ],
        [
          "مستحقات حالية",
          usdCell(summary.outstandingUsd),
          sypCell(summary.outstandingUsd, usdRate),
        ],
      ],
    ),
  );

  blocks.push(
    toCsv(
      ["الإيرادات الشهرية — الشهر", "الإيراد ($)", "الإيراد (ل.س)"],
      summary.monthlyRevenue.map((m) => [
        m.month,
        usdCell(m.chargesUsd),
        sypCell(m.chargesUsd, usdRate),
      ]),
    ),
  );

  blocks.push(
    toCsv(
      ["نتائج المواعيد — الحالة", "العدد"],
      summary.appointmentOutcomes.map((o) => [o.status, o.count]),
    ),
  );

  blocks.push(
    toCsv(
      ["الإيراد حسب الطبيب", "الإيراد ($)", "الإيراد (ل.س)"],
      summary.revenueByDoctor.map((d) => [
        d.doctor,
        usdCell(d.chargesUsd),
        sypCell(d.chargesUsd, usdRate),
      ]),
    ),
  );

  blocks.push(
    toCsv(
      ["الإيراد حسب نوع العلاج", "الإيراد ($)", "الإيراد (ل.س)"],
      summary.revenueByProcedure.map((p) => [
        p.procedure,
        usdCell(p.chargesUsd),
        sypCell(p.chargesUsd, usdRate),
      ]),
    ),
  );

  blocks.push(
    toCsv(
      ["أعلى المرضى (فواتير الفترة)", "الإجمالي ($)", "الإجمالي (ل.س)"],
      summary.topPatients.map((p) => [
        p.patientName,
        usdCell(p.chargesUsd),
        sypCell(p.chargesUsd, usdRate),
      ]),
    ),
  );

  blocks.push(
    toCsv(
      ["نمو سجل المرضى (شهرياً) — الشهر", "المرضى الجدد"],
      summary.patientGrowth.map((g) => [g.month, g.count]),
    ),
  );

  return blocks.join("\r\n");
}

// ─── شكل حمولة الواجهة البرمجية ─────────────────────────────────────────────

/** حمولة ملخص الفترة كما تعود من /api/reports/summary (تواريخ نصية) */
export type ReportsPeriodSummaryJson = {
  from: string;
  to: string;
  totalChargesUsd: number;
  /** مجموع قيمة دفعات الفترة — تعريف «محصّل الفترة» المستقل عن الرسوم */
  totalPaymentsUsd: number;
  invoiceCount: number;
  paymentCount: number;
  outstandingUsd: number;
  monthlyRevenue: { month: string; chargesUsd: number }[];
  appointmentOutcomes: { status: OutcomeStatus; count: number }[];
  revenueByDoctor: { doctor: string; chargesUsd: number }[];
  revenueByProcedure: { procedure: string; chargesUsd: number }[];
  topPatients: { patientId: string; patientName: string; chargesUsd: number }[];
  patientGrowth: { month: string; count: number }[];
  /** أقدم يوم حركة بالعيادة — أساس خيار «الكل» */
  rangeStart: string;
};

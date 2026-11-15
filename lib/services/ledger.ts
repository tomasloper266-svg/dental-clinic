import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";
import { deriveInvoicesDetailed } from "@/lib/patient-finance";
import { isUsdAmount } from "@/lib/currency";

// خدمة الدفتر المالي — دفتر غير قابل للتعديل أو الحذف: التصحيح بقيد عكسي فقط.
// الرصيد لا يُخزَّن أبداً — يُحسب من مجموع القيود الموقّعة (معادلة الرصيد).
// إشارة المبلغ حسب النوع: CHARGE وREFUND موجبة، PAYMENT سالبة،
// وADJUSTMENT بالاتجاهين (تصحيح يضاف أو يخصم). القاعدة: balance = Σ amountUsd.

export type LedgerEntryType = "CHARGE" | "PAYMENT" | "ADJUSTMENT" | "REFUND";

export type LedgerEntryDto = {
  id: string;
  patientId: string;
  type: LedgerEntryType;
  amountUsd: number;
  note: string | null;
  treatmentItemId: string | null;
  /** تسلسل الرسوم على مستوى العيادة — أساس رقم الفاتورة، فارغ للقيود القديمة */
  invoiceSeq: number | null;
  /** الطبيب المُسند المحفوظ لحظة القيد — فارغ للقيود القديمة */
  doctorId: string | null;
  /** ترشيح تخصيص الدفعة لفاتورة — للعرض حصراً ولا يدخل في معادلة الرصيد */
  appliedChargeId: string | null;
  createdAt: Date;
};

export type LedgerEntryItemInput = {
  description: string;
  category?: string;
  amountUsd: number;
  sort?: number;
};

export type LedgerEntryInput = {
  patientId: string;
  type: LedgerEntryType;
  amountUsd: number;
  note?: string;
  treatmentItemId?: string;
  /** إسناد صريح للطبيب — غيابه في قيد رسوم يعني الاستنتاج من أحدث موعد مُسند */
  doctorId?: string;
  /** ترشيح تخصيص دفعة لفاتورة — ترشيح عرض فقط، لا يغيّر الرصيد */
  appliedChargeId?: string;
  /** بنود الفاتورة — لقيد الرسوم حصراً، ومجموعها يجب أن يساوي المبلغ */
  items?: LedgerEntryItemInput[];
  /** تاريخ القيد الفعلي — يُدعم الاختياري لتسديدات وفواتير بتاريخ سابق؛
   *  غيابه يعني الآن (سلوك @default في المخطط) */
  createdAt?: Date;
};

const ENTRY_TYPES: readonly LedgerEntryType[] = [
  "CHARGE",
  "PAYMENT",
  "ADJUSTMENT",
  "REFUND",
];

// معادلة الرصيد — نقية وتُختبر وحدوياً: الرصيد مجموع القيود كما هي.
export function computeBalance(
  entries: ReadonlyArray<{ amountUsd: number }>,
): number {
  return entries.reduce((sum, entry) => sum + entry.amountUsd, 0);
}

// تحقق نقي من إشارة المبلغ حسب النوع — يمنع دفعة موجبة أو رسوم سالبة.
export function validateEntrySign(
  type: LedgerEntryType,
  amountUsd: number,
): string | null {
  if (!isUsdAmount(amountUsd) || amountUsd === 0) {
    return "المبلغ يجب أن يكون رقماً موجباً بمنزلتين عشريتين كحد أقصى";
  }
  if (type === "CHARGE" && amountUsd <= 0) {
    return "قيد الرسوم يجب أن يكون بمبلغ موجب";
  }
  if (type === "PAYMENT" && amountUsd >= 0) {
    return "قيد الدفعة يجب أن يكون بمبلغ سالب";
  }
  if (type === "REFUND" && amountUsd <= 0) {
    return "قيد الاسترداد يجب أن يكون بمبلغ موجب";
  }
  return null;
}

// تحقق نقي من بنود الفاتورة — قاعدة الفجوة 2: مجموع البنود يجب أن يساوي مبلغ
// قيد الرسوم بالضبط. القيد اليدوي المفرد بلا بنود مقبول (قائمة فارغة)، أما
// البنود فأوصافها إلزامية ومبالغها موجبة صحيحة.
export function validateLedgerEntryItems(
  items: ReadonlyArray<LedgerEntryItemInput>,
  amountUsd: number,
): string | null {
  if (items.length === 0) return null;

  const itemsSum = items.reduce((sum, item) => sum + item.amountUsd, 0);
  if (itemsSum !== amountUsd) {
    return "مجموع البنود يجب أن يساوي مبلغ القيد";
  }
  for (const item of items) {
    if (!item.description.trim()) {
      return "وصف البند إلزامي";
    }
    if (!isUsdAmount(item.amountUsd) || item.amountUsd <= 0) {
      return "مبلغ البند يجب أن يكون رقماً موجباً بمنزلتين عشريتين كحد أقصى";
    }
  }
  return null;
}

// تحقق نقي من جسم الطلب — يُختبر وحدوياً قبل أي لمس لقاعدة البيانات.
// معرّف المريض ليس هنا — يأتي من المسار (source of truth) لا من جسم الطلب.
export function parseCreateLedgerEntry(
  body: unknown,
): { ok: true; value: Omit<LedgerEntryInput, "patientId"> } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;

  const type = b.type as LedgerEntryType;
  if (!ENTRY_TYPES.includes(type)) {
    return { ok: false, error: "نوع القيد غير صالح" };
  }

  const amountUsd = typeof b.amountUsd === "number" ? b.amountUsd : NaN;
  const signError = validateEntrySign(type, amountUsd);
  if (signError) {
    return { ok: false, error: signError };
  }

  const note = typeof b.note === "string" ? b.note.trim() : undefined;
  const treatmentItemId =
    typeof b.treatmentItemId === "string" ? b.treatmentItemId : undefined;
  const doctorId = typeof b.doctorId === "string" ? b.doctorId : undefined;
  const appliedChargeId =
    typeof b.appliedChargeId === "string" ? b.appliedChargeId : undefined;

  // بنود الفاتورة — لقيد الرسوم حصراً، ومجموعها يجب أن يساوي مبلغ القيد.
  let items: LedgerEntryItemInput[] | undefined;
  if (b.items !== undefined && b.items !== null) {
    if (!Array.isArray(b.items)) {
      return { ok: false, error: "بنود الفاتورة غير صالحة" };
    }
    if (type !== "CHARGE") {
      return { ok: false, error: "بنود الفاتورة لقيد الرسوم حصراً" };
    }
    items = [];
    for (const raw of b.items) {
      if (typeof raw !== "object" || raw === null) {
        return { ok: false, error: "بنود الفاتورة غير صالحة" };
      }
      const item = raw as Record<string, unknown>;
      if (
        typeof item.description !== "string" ||
        typeof item.amountUsd !== "number"
      ) {
        return { ok: false, error: "بنود الفاتورة غير صالحة" };
      }
      items.push({
        description: item.description,
        category:
          typeof item.category === "string" && item.category.trim()
            ? item.category.trim()
            : undefined,
        amountUsd: item.amountUsd,
        sort: typeof item.sort === "number" ? item.sort : undefined,
      });
    }
    const itemsError = validateLedgerEntryItems(items, amountUsd);
    if (itemsError) {
      return { ok: false, error: itemsError };
    }
  }

  // تاريخ القيد اختياري — نص ISO صالح ولا يقبل المستقبل (بتسامح دقيقة واحدة)
  let createdAt: Date | undefined;
  if (b.createdAt !== undefined && b.createdAt !== null) {
    const parsedDate = new Date(String(b.createdAt));
    if (Number.isNaN(parsedDate.getTime())) {
      return { ok: false, error: "تاريخ القيد غير صالح" };
    }
    if (parsedDate.getTime() > Date.now() + 60_000) {
      return { ok: false, error: "لا يمكن تسجيل القيد بتاريخ مستقبلي" };
    }
    createdAt = parsedDate;
  }

  return {
    ok: true,
    value: { type, amountUsd, note, treatmentItemId, doctorId, appliedChargeId, items, createdAt },
  };
}

// Decimal → number عند حدود القراءة — وحدة الـ DTO رقمية خالصة (الدولار أساس).
function toEntryDto<Row extends { amountUsd: unknown }>(row: Row): Omit<Row, "amountUsd"> & { amountUsd: number } {
  return { ...row, amountUsd: Number(row.amountUsd) };
}

export async function listLedgerEntries(
  ctx: TenantContext,
  patientId: string,
): Promise<{ entries: LedgerEntryDto[]; balance: number }> {
  const db = clinicScope(ctx.clinicId);
  const rows = await db.ledgerEntry.findMany({
    where: { patientId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      patientId: true,
      type: true,
      amountUsd: true,
      note: true,
      treatmentItemId: true,
      invoiceSeq: true,
      doctorId: true,
      appliedChargeId: true,
      createdAt: true,
    },
  });
  const entries = rows.map(toEntryDto);
  return { entries, balance: computeBalance(entries) };
}

// قيود العيادة كلها بأحدثها أولاً — لشاشة الدفتر المالي الموحّد.
// قراءة فقط: نفس النموذج والنطاق، مع اسم المريض وهاتفه للعمود الأول.
export type ClinicLedgerEntryDto = LedgerEntryDto & {
  patientName: string;
  patientPhone: string | null;
};

const CLINIC_ENTRY_SELECT = {
  id: true,
  patientId: true,
  type: true,
  amountUsd: true,
  note: true,
  treatmentItemId: true,
  invoiceSeq: true,
  doctorId: true,
  appliedChargeId: true,
  createdAt: true,
  patient: { select: { name: true, phone: true } },
} as const;

export async function listClinicLedgerEntries(
  ctx: TenantContext,
  options?: { patientId?: string; limit?: number },
): Promise<ClinicLedgerEntryDto[]> {
  const db = clinicScope(ctx.clinicId);
  const rows = await db.ledgerEntry.findMany({
    where: options?.patientId
      ? { patientId: options.patientId }
      : {},
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 300,
    select: CLINIC_ENTRY_SELECT,
  });
  return rows.map((row) => ({
    id: row.id,
    patientId: row.patientId,
    type: row.type,
    amountUsd: Number(row.amountUsd),
    note: row.note,
    treatmentItemId: row.treatmentItemId,
    invoiceSeq: row.invoiceSeq,
    doctorId: row.doctorId,
    appliedChargeId: row.appliedChargeId,
    createdAt: row.createdAt,
    patientName: row.patient.name,
    patientPhone: row.patient.phone,
  }));
}

// نوع العميل المحصور — يقبل العميل الكامل أو عميل معاملة $transaction
// (الذي يغيب عنه اتصال وأدوات الامتداد) حتى تُنجز الكتابات المرتبطة ذرّياً.
type ScopedDb = Omit<
  ReturnType<typeof clinicScope>,
  "$connect" | "$disconnect" | "$extends" | "$on" | "$use" | "$transaction"
>;

export type ScopedClient = ScopedDb;

export async function createLedgerEntry(
  ctx: TenantContext,
  input: LedgerEntryInput,
  db: ScopedDb = clinicScope(ctx.clinicId),
): Promise<LedgerEntryDto | null> {
  // المريض يجب أن يكون ضمن العيادة نفسها — مريض عيادة أخرى يُرفض بغض النظر عن المعرّف.
  const patient = await db.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true },
  });
  if (!patient) return null;

  // بند العلاج إن وُجد يجب أن يعود لمريض القيد نفسه ضمن العيادة — معرّف
  // من عيادة أخرى أو مريض آخر يُرفض بغض النظر عن صحة شكله.
  if (input.treatmentItemId) {
    const item = await db.treatmentPlanItem.findFirst({
      where: { id: input.treatmentItemId, patientId: input.patientId },
      select: { id: true },
    });
    if (!item) return null;
  }

  // إسناد الطبيب (فجوة 1): القيمة الصريحة تُتحقق من نطاق العيادة، وغيابها في
  // قيد رسوم يعني الاستنتاج من أحدث موعد مُسند للطبيب قبل لحظة القيد — نفس
  // أساس الاستنتاج الاحتياطي في التقارير، لكنه يُخزَّن هنا فلا يُستنتج ثانية.
  const chargeAt = input.createdAt ?? new Date();
  let doctorId: string | undefined = input.doctorId;
  if (doctorId) {
    const staff = await db.staffMember.findFirst({
      where: { id: doctorId, clinicId: ctx.clinicId },
      select: { id: true },
    });
    if (!staff) return null;
  } else if (input.type === "CHARGE") {
    const appointment = await db.appointment.findFirst({
      where: { patientId: input.patientId, staffId: { not: null }, startsAt: { lte: chargeAt } },
      orderBy: { startsAt: "desc" },
      select: { staffId: true },
    });
    doctorId = appointment?.staffId ?? undefined;
  }

  // ترشيح تخصيص الدفعة (فجوة 3): الهدف يجب أن يكون قيد رسوم لنفس المريض في
  // العيادة نفسها — ترشيح عرض فحسب، ولا يدخل في معادلة الرصيد إطلاقاً
  // (التخصيص الزمني FIFO يبقى هو المعتمد محاسبياً).
  if (input.appliedChargeId) {
    if (input.type !== "PAYMENT") {
      return null;
    }
    const charge = await db.ledgerEntry.findFirst({
      where: {
        id: input.appliedChargeId,
        type: "CHARGE",
        patientId: input.patientId,
      },
      select: { id: true },
    });
    if (!charge) return null;
  }

  // بنود الفاتورة (فجوة 2): مجموع البنود يجب أن يساوي مبلغ القيد — حاجز
  // أخير قبل الكتابة (التحقق النقي ممرّ أيضاً في parseCreateLedgerEntry).
  if (input.items?.length && input.type === "CHARGE") {
    const itemsError = validateLedgerEntryItems(input.items, input.amountUsd);
    if (itemsError) throw new Error(itemsError);
  }

  // تسلسل الرسوم على مستوى العيادة — للرسوم حصراً: عدّ رسوم العيادة داخل
  // نفس المعاملة (حيث يمرّ المتصل بمعاملة) ثم إنشاء القيد بالتسلسل التالي؛
  // القيد الفريد (clinicId, invoiceSeq) حاجز أخير ضد سباق الإنشاء المتوازي.
  let invoiceSeq: number | undefined;
  if (input.type === "CHARGE") {
    const charged = await db.ledgerEntry.count({
      where: { type: "CHARGE" },
    });
    invoiceSeq = charged + 1;
  }

  const entry = await db.ledgerEntry.create({
    data: {
      clinicId: ctx.clinicId,
      patientId: input.patientId,
      type: input.type,
      amountUsd: input.amountUsd,
      note: input.note,
      treatmentItemId: input.treatmentItemId,
      invoiceSeq,
      createdAt: input.createdAt,
      createdById: ctx.userId,
      doctorId,
      appliedChargeId: input.appliedChargeId,
      // بنود الفاتورة تُنشأ ذرّياً مع القيد — مجموعة البنود مساوية للمبلغ
      // (تحقُّق سابق)، والترتيب كما أُدخل.
      ...(input.items?.length
        ? {
            items: {
              create: input.items.map((item, index) => ({
                description: item.description,
                category: item.category,
                amountUsd: item.amountUsd,
                sort: item.sort ?? index,
              })),
            },
          }
        : {}),
    },
    select: {
      id: true,
      patientId: true,
      type: true,
      amountUsd: true,
      note: true,
      treatmentItemId: true,
      invoiceSeq: true,
      doctorId: true,
      appliedChargeId: true,
      createdAt: true,
    },
  });
  return toEntryDto(entry);
}

export type TreatmentChargeInput = {
  patientId: string;
  treatmentItemId: string;
  procedure: string;
  priceUsd: number;
};

// القيد التلقائي عند اكتمال علاج مخطط — يستدعيها محرّك الأودوغرام عند تحويل
// البند إلى DONE. رقمية (idempotent): البند المُرحّل مسبقاً يعيد قيوده القائم
// بدل إنشاء قيد رسوم مزدوج.
export async function recordTreatmentCharge(
  ctx: TenantContext,
  input: TreatmentChargeInput,
  db: ScopedDb = clinicScope(ctx.clinicId),
): Promise<{ entry: LedgerEntryDto | null; alreadyCharged: boolean }> {
  const existing = await db.ledgerEntry.findFirst({
    where: { treatmentItemId: input.treatmentItemId, type: "CHARGE" },
    select: {
      id: true,
      patientId: true,
      type: true,
      amountUsd: true,
      note: true,
      treatmentItemId: true,
      invoiceSeq: true,
      doctorId: true,
      appliedChargeId: true,
      createdAt: true,
    },
  });
  if (existing) {
    return { entry: toEntryDto(existing), alreadyCharged: true };
  }

  if (!isUsdAmount(input.priceUsd) || input.priceUsd <= 0) {
    throw new Error("سعر العلاج غير صالح");
  }

  const entry = await createLedgerEntry(
    ctx,
    {
      patientId: input.patientId,
      type: "CHARGE",
      amountUsd: input.priceUsd,
      note: `علاج مكتمل: ${input.procedure}`,
      treatmentItemId: input.treatmentItemId,
      // بند الفاتورة من بند الخطة (فجوة 2) — الوصف هو الإجراء نفسه،
      // والتصنيف نص حر فارغ للبند المشتق من خطة.
      items: [
        { description: input.procedure, amountUsd: input.priceUsd, sort: 0 },
      ],
    },
    db,
  );
  return { entry, alreadyCharged: false };
}

export type DeleteChargeResult =
  | { ok: true }
  | { ok: false; error: string; status: 404 | 409 };

/**
 * حذف قيد رسوم لم يُخصَّص له دفعات أو خصومات بعد — الباب الوحيد للحذف في دفتر
 * غير قابل للتعديل. فاتورة عليها تخصيص تُرفض لأن حذفها يعيد توزيع الدفعات
 * (FIFO) على فواتير أخرى ويغيّر التاريخ المالي بأثر رجعي.
 */
export async function deleteUnallocatedCharge(
  ctx: TenantContext,
  patientId: string,
  entryId: string,
): Promise<DeleteChargeResult> {
  const db = clinicScope(ctx.clinicId);
  // الاشتقاق والفحص والحذف داخل معاملة واحدة — قيد دفعة متوازٍ بين الفحص
  // والحذف لا يجري توزيع الدفعات بأثر رجعي على فواتير أخرى.
  return db.$transaction(async (tx) => {
    const entry = await tx.ledgerEntry.findFirst({
      where: { id: entryId, patientId, clinicId: ctx.clinicId, type: "CHARGE" },
      select: { id: true },
    });
    if (!entry) {
      return {
        ok: false as const,
        error: "الفاتورة غير موجودة",
        status: 404 as const,
      };
    }

    const entries = (await tx.ledgerEntry.findMany({
      where: { patientId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        patientId: true,
        type: true,
        amountUsd: true,
        note: true,
        treatmentItemId: true,
        invoiceSeq: true,
        doctorId: true,
        appliedChargeId: true,
        createdAt: true,
      },
    })).map(toEntryDto);
    const invoices = deriveInvoicesDetailed(entries);
    const index = entries
      .filter((e) => e.type === "CHARGE")
      .findIndex((charge) => charge.id === entry.id);
    const invoice = invoices[index];
    if (invoice && invoice.paidUsd + invoice.discountUsd > 0) {
      return {
        ok: false as const,
        error: "لا يمكن حذف فاتورة عليها دفعات أو خصم — صححها بقيد عكسي",
        status: 409 as const,
      };
    }

    // ترشيح التخصيص (appliedChargeId) ترشيح عرض فحسب — لكن قيد رسوم يشير
    // إليه سطر دفعات لا يُحذف: قيد الـ RESTRICT في المخطط، والرسالة هنا أوضح
    // من خطأ قيد قاعدة بيانات خام.
    const applied = await tx.ledgerEntry.count({
      where: { appliedChargeId: entry.id },
    });
    if (applied > 0) {
      return {
        ok: false as const,
        error: "لا يمكن حذف فاتورة مخصَّصة من دفعة — صححها بقيد عكسي",
        status: 409 as const,
      };
    }

    await tx.ledgerEntry.delete({ where: { id: entry.id } });
    return { ok: true as const };
  });
}

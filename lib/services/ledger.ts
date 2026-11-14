import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";
import { deriveInvoicesDetailed } from "@/lib/patient-finance";

// خدمة الدفتر المالي — دفتر غير قابل للتعديل أو الحذف: التصحيح بقيد عكسي فقط.
// الرصيد لا يُخزَّن أبداً — يُحسب من مجموع القيود الموقّعة (معادلة الرصيد).
// إشارة المبلغ حسب النوع: CHARGE وREFUND موجبة، PAYMENT سالبة،
// وADJUSTMENT بالاتجاهين (تصحيح يضاف أو يخصم). القاعدة: balance = Σ amountSyp.

export type LedgerEntryType = "CHARGE" | "PAYMENT" | "ADJUSTMENT" | "REFUND";

export type LedgerEntryDto = {
  id: string;
  patientId: string;
  type: LedgerEntryType;
  amountSyp: number;
  note: string | null;
  treatmentItemId: string | null;
  createdAt: Date;
};

export type LedgerEntryInput = {
  patientId: string;
  type: LedgerEntryType;
  amountSyp: number;
  note?: string;
  treatmentItemId?: string;
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
  entries: ReadonlyArray<{ amountSyp: number }>,
): number {
  return entries.reduce((sum, entry) => sum + entry.amountSyp, 0);
}

// تحقق نقي من إشارة المبلغ حسب النوع — يمنع دفعة موجبة أو رسوم سالبة.
export function validateEntrySign(
  type: LedgerEntryType,
  amountSyp: number,
): string | null {
  if (!Number.isInteger(amountSyp) || amountSyp === 0) {
    return "المبلغ يجب أن يكون رقماً صحيحاً غير صفري";
  }
  if (type === "CHARGE" && amountSyp <= 0) {
    return "قيد الرسوم يجب أن يكون بمبلغ موجب";
  }
  if (type === "PAYMENT" && amountSyp >= 0) {
    return "قيد الدفعة يجب أن يكون بمبلغ سالب";
  }
  if (type === "REFUND" && amountSyp <= 0) {
    return "قيد الاسترداد يجب أن يكون بمبلغ موجب";
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

  const amountSyp = typeof b.amountSyp === "number" ? b.amountSyp : NaN;
  const signError = validateEntrySign(type, amountSyp);
  if (signError) {
    return { ok: false, error: signError };
  }

  const note = typeof b.note === "string" ? b.note.trim() : undefined;
  const treatmentItemId =
    typeof b.treatmentItemId === "string" ? b.treatmentItemId : undefined;

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
    value: { type, amountSyp, note, treatmentItemId, createdAt },
  };
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
      amountSyp: true,
      note: true,
      treatmentItemId: true,
      createdAt: true,
    },
  });
  return { entries: rows, balance: computeBalance(rows) };
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
  amountSyp: true,
  note: true,
  treatmentItemId: true,
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
    amountSyp: row.amountSyp,
    note: row.note,
    treatmentItemId: row.treatmentItemId,
    createdAt: row.createdAt,
    patientName: row.patient.name,
    patientPhone: row.patient.phone,
  }));
}

export async function createLedgerEntry(
  ctx: TenantContext,
  input: LedgerEntryInput,
): Promise<LedgerEntryDto | null> {
  const db = clinicScope(ctx.clinicId);
  // المريض يجب أن يكون ضمن العيادة نفسها — مريض عيادة أخرى يُرفض بغض النظر عن المعرّف.
  const patient = await db.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true },
  });
  if (!patient) return null;

  const entry = await db.ledgerEntry.create({
    data: {
      clinicId: ctx.clinicId,
      patientId: input.patientId,
      type: input.type,
      amountSyp: input.amountSyp,
      note: input.note,
      treatmentItemId: input.treatmentItemId,
      createdAt: input.createdAt,
      createdById: ctx.userId,
    },
    select: {
      id: true,
      patientId: true,
      type: true,
      amountSyp: true,
      note: true,
      treatmentItemId: true,
      createdAt: true,
    },
  });
  return entry;
}

export type TreatmentChargeInput = {
  patientId: string;
  treatmentItemId: string;
  procedure: string;
  priceSyp: number;
};

// القيد التلقائي عند اكتمال علاج مخطط — يستدعيها محرّك الأودوغرام عند تحويل
// البند إلى DONE. رقمية (idempotent): البند المُرحّل مسبقاً يعيد قيوده القائم
// بدل إنشاء قيد رسوم مزدوج.
export async function recordTreatmentCharge(
  ctx: TenantContext,
  input: TreatmentChargeInput,
): Promise<{ entry: LedgerEntryDto | null; alreadyCharged: boolean }> {
  const db = clinicScope(ctx.clinicId);

  const existing = await db.ledgerEntry.findFirst({
    where: { treatmentItemId: input.treatmentItemId, type: "CHARGE" },
    select: {
      id: true,
      patientId: true,
      type: true,
      amountSyp: true,
      note: true,
      treatmentItemId: true,
      createdAt: true,
    },
  });
  if (existing) {
    return { entry: existing, alreadyCharged: true };
  }

  if (!Number.isInteger(input.priceSyp) || input.priceSyp <= 0) {
    throw new Error("سعر العلاج غير صالح");
  }

  const entry = await createLedgerEntry(ctx, {
    patientId: input.patientId,
    type: "CHARGE",
    amountSyp: input.priceSyp,
    note: `علاج مكتمل: ${input.procedure}`,
    treatmentItemId: input.treatmentItemId,
  });
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
  const entry = await db.ledgerEntry.findFirst({
    where: { id: entryId, patientId, clinicId: ctx.clinicId, type: "CHARGE" },
    select: { id: true },
  });
  if (!entry) {
    return { ok: false, error: "الفاتورة غير موجودة", status: 404 };
  }

  const entries = await db.ledgerEntry.findMany({
    where: { patientId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      patientId: true,
      type: true,
      amountSyp: true,
      note: true,
      treatmentItemId: true,
      createdAt: true,
    },
  });
  const invoices = deriveInvoicesDetailed(entries);
  const index = entries
    .filter((e) => e.type === "CHARGE")
    .findIndex((charge) => charge.id === entry.id);
  const invoice = invoices[index];
  if (invoice && invoice.paidSyp + invoice.discountSyp > 0) {
    return {
      ok: false,
      error: "لا يمكن حذف فاتورة عليها دفعات أو خصم — صححها بقيد عكسي",
      status: 409,
    };
  }

  await db.ledgerEntry.delete({ where: { id: entry.id } });
  return { ok: true };
}

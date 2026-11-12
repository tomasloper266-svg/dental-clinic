import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";

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
export function parseCreateLedgerEntry(
  body: unknown,
): { ok: true; value: LedgerEntryInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;

  const patientId = typeof b.patientId === "string" ? b.patientId : "";
  if (!patientId) {
    return { ok: false, error: "معرّف المريض مطلوب" };
  }

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

  return {
    ok: true,
    value: { patientId, type, amountSyp, note, treatmentItemId },
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

export async function createLedgerEntry(
  ctx: TenantContext,
  input: LedgerEntryInput,
): Promise<LedgerEntryDto> {
  const db = clinicScope(ctx.clinicId);
  const entry = await db.ledgerEntry.create({
    data: {
      clinicId: ctx.clinicId,
      patientId: input.patientId,
      type: input.type,
      amountSyp: input.amountSyp,
      note: input.note,
      treatmentItemId: input.treatmentItemId,
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
): Promise<{ entry: LedgerEntryDto; alreadyCharged: boolean }> {
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

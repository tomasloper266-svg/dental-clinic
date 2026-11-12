import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";
import { isValidToothFdi } from "@/lib/odontogram/fdi";
import { TOOTH_STATUS_KEYS, type ToothStatusKey } from "@/lib/odontogram/statuses";

// خدمة خطة العلاج المسعّرة — عبر clinicScope حصراً.
// البنود المخططة/المقبولة قابلة للتعديل؛ المنفَّذ نهائي ولا يُعدَّل.

export type PlanItemStatus = "PROPOSED" | "ACCEPTED" | "DONE";

export type PlanItemDto = {
  id: string;
  toothFdi: number;
  procedure: string;
  priceSyp: number;
  status: PlanItemStatus;
  priority: number;
};

export type CreatePlanItemInput = {
  toothFdi: number;
  procedure: string;
  priceSyp: number;
  priority?: number;
};

export type UpdatePlanItemInput = {
  procedure?: string;
  priceSyp?: number;
  priority?: number;
  status?: "PROPOSED" | "ACCEPTED";
};

export async function listPlan(
  ctx: TenantContext,
  patientId: string,
): Promise<PlanItemDto[]> {
  const db = clinicScope(ctx.clinicId);
  const items = await db.treatmentPlanItem.findMany({
    where: { patientId },
    orderBy: [{ priority: "desc" }, { id: "asc" }],
    select: {
      id: true,
      toothFdi: true,
      procedure: true,
      priceSyp: true,
      status: true,
      priority: true,
    },
  });
  return items.map(serialize);
}

export async function createPlanItem(
  ctx: TenantContext,
  patientId: string,
  input: CreatePlanItemInput,
): Promise<PlanItemDto> {
  const db = clinicScope(ctx.clinicId);
  const item = await db.treatmentPlanItem.create({
    data: {
      clinicId: ctx.clinicId,
      patientId,
      toothFdi: input.toothFdi,
      procedure: input.procedure,
      priceSyp: input.priceSyp,
      priority: input.priority ?? 0,
      status: "PROPOSED",
    },
    select: {
      id: true,
      toothFdi: true,
      procedure: true,
      priceSyp: true,
      status: true,
      priority: true,
    },
  });
  return serialize(item);
}

// التعديل مسموح للبنود غير المنفذة فقط — updateMany يضمن النطاق والحالة معاً.
export async function updatePlanItem(
  ctx: TenantContext,
  patientId: string,
  itemId: string,
  input: UpdatePlanItemInput,
): Promise<{ ok: true; value: PlanItemDto } | { ok: false; error: string }> {
  const db = clinicScope(ctx.clinicId);
  const result = await db.treatmentPlanItem.updateMany({
    where: { id: itemId, patientId, status: { not: "DONE" } },
    data: input,
  });
  if (result.count === 0) {
    return {
      ok: false,
      error: "البند غير موجود أو منفَّذ بالفعل (لا يُعدَّل بعد التنفيذ)",
    };
  }
  const item = await db.treatmentPlanItem.findUniqueOrThrow({
    where: { id: itemId },
    select: {
      id: true,
      toothFdi: true,
      procedure: true,
      priceSyp: true,
      status: true,
      priority: true,
    },
  });
  return { ok: true, value: serialize(item) };
}

export type StartPlanResult =
  | { ok: true; value: { item: PlanItemDto; findingId: string } }
  | { ok: false; error: string };

// بدء التنفيذ: البند يتحول إلى DONE ويُسجَّل مشاهدة علاج منفذ على السن.
// السجل الإلحاقي محفوظ — هذه إضافة قيد جديد وليست استبدالاً لمشاهدة قائمة.
// عمليتان متتاليتان عبر العميل المحصور (nested writes غير مدعومة في clinicScope).
export async function startPlanItem(
  ctx: TenantContext,
  patientId: string,
  itemId: string,
  resultStatus: ToothStatusKey,
): Promise<StartPlanResult> {
  const db = clinicScope(ctx.clinicId);

  const update = await updatePlanItemStatus(db, patientId, itemId);
  if (!update.ok) return { ok: false, error: update.error };

  const finding = await db.toothFinding.create({
    data: {
      clinicId: ctx.clinicId,
      patientId,
      toothFdi: update.toothFdi,
      kind: "TREATMENT_DONE",
      status: resultStatus,
      note: `تنفيذ بند الخطة: ${update.procedure}`,
      recordedById: ctx.userId,
    },
    select: { id: true },
  });

  return {
    ok: true,
    value: { item: update.item, findingId: finding.id },
  };
}

// قفل الحالة قبل التحديث: تُقبل PROPOSED وACCEPTED فقط — يمنع سباق التنفيذ المزدوج.
async function updatePlanItemStatus(
  db: ReturnType<typeof clinicScope>,
  patientId: string,
  itemId: string,
): Promise<
  | { ok: true; toothFdi: number; procedure: string; item: PlanItemDto }
  | { ok: false; error: string }
> {
  const result = await db.treatmentPlanItem.updateMany({
    where: {
      id: itemId,
      patientId,
      status: { in: ["PROPOSED", "ACCEPTED"] },
    },
    data: { status: "DONE" },
  });
  if (result.count === 0) {
    return {
      ok: false,
      error: "البند غير موجود أو لا يمكن تنفيذه من حالته الحالية",
    };
  }
  const row = await db.treatmentPlanItem.findUniqueOrThrow({
    where: { id: itemId },
    select: {
      id: true,
      toothFdi: true,
      procedure: true,
      priceSyp: true,
      status: true,
      priority: true,
    },
  });
  return { ok: true, toothFdi: row.toothFdi, procedure: row.procedure, item: serialize(row) };
}

// ─── التحقق النقي — يُختبر في وحدة منفصلة عن قاعدة البيانات ─────────────────

export function parseCreatePlanItem(
  body: unknown,
): { ok: true; value: CreatePlanItemInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;

  const toothFdi = b.toothFdi;
  if (typeof toothFdi !== "number" || !isValidToothFdi(toothFdi)) {
    return { ok: false, error: "رقم السن يجب أن يكون بترقيم FDI الدائم (11–48)" };
  }

  const procedure = typeof b.procedure === "string" ? b.procedure.trim() : "";
  if (procedure.length < 2 || procedure.length > 200) {
    return { ok: false, error: "وصف الإجراء يجب أن يكون بين 2 و200 حرف" };
  }

  const priceSyp = b.priceSyp;
  if (
    typeof priceSyp !== "number" ||
    !Number.isInteger(priceSyp) ||
    priceSyp < 0
  ) {
    return { ok: false, error: "السعر يجب أن يكون رقماً صحيحاً غير سالب" };
  }

  const priority =
    typeof b.priority === "number" && Number.isInteger(b.priority)
      ? b.priority
      : undefined;

  return {
    ok: true,
    value: { toothFdi, procedure, priceSyp, priority },
  };
}

export function parseUpdatePlanItem(
  body: unknown,
): { ok: true; value: UpdatePlanItemInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;
  const value: UpdatePlanItemInput = {};

  if (b.procedure !== undefined) {
    const procedure = typeof b.procedure === "string" ? b.procedure.trim() : "";
    if (procedure.length < 2 || procedure.length > 200) {
      return { ok: false, error: "وصف الإجراء يجب أن يكون بين 2 و200 حرف" };
    }
    value.procedure = procedure;
  }
  if (b.priceSyp !== undefined) {
    if (
      typeof b.priceSyp !== "number" ||
      !Number.isInteger(b.priceSyp) ||
      b.priceSyp < 0
    ) {
      return { ok: false, error: "السعر يجب أن يكون رقماً صحيحاً غير سالب" };
    }
    value.priceSyp = b.priceSyp;
  }
  if (b.priority !== undefined) {
    if (typeof b.priority !== "number" || !Number.isInteger(b.priority)) {
      return { ok: false, error: "الأولوية يجب أن تكون رقماً صحيحاً" };
    }
    value.priority = b.priority;
  }
  if (b.status !== undefined) {
    if (b.status !== "PROPOSED" && b.status !== "ACCEPTED") {
      return {
        ok: false,
        error: "الحالة تُحدَّث إلى مخطط أو مقبول فقط — التنفيذ عبر بدء البند",
      };
    }
    value.status = b.status;
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, error: "لا يوجد ما يُعدَّل" };
  }
  return { ok: true, value };
}

export function parseResultStatus(
  body: unknown,
): { ok: true; value: ToothStatusKey } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const status = (body as Record<string, unknown>).resultStatus;
  if (
    typeof status !== "string" ||
    !TOOTH_STATUS_KEYS.includes(status as never) ||
    status === "HEALTHY"
  ) {
    return { ok: false, error: "حالة السن الناتجة غير صالحة" };
  }
  return { ok: true, value: status as ToothStatusKey };
}

function serialize(row: {
  id: string;
  toothFdi: number;
  procedure: string;
  priceSyp: number;
  status: string;
  priority: number;
}): PlanItemDto {
  return {
    id: row.id,
    toothFdi: row.toothFdi,
    procedure: row.procedure,
    priceSyp: row.priceSyp,
    status: row.status as PlanItemStatus,
    priority: row.priority,
  };
}

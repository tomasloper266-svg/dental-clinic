import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";
import { isValidToothFdi } from "@/lib/odontogram/fdi";
import { TOOTH_STATUS_KEYS, type ToothStatusKey } from "@/lib/odontogram/statuses";

// خدمة خطة العلاج المسعّرة — عبر clinicScope حصراً.
// البنود المخططة/المقبولة قابلة للتعديل؛ المنفَّذ نهائي ولا يُعدَّل.

export type PlanItemStatus = "PROPOSED" | "ACCEPTED" | "DONE";

export type PlanItemDto = {
  id: string;
  /** بلا خطة = بند غير مُخطط ضمن خطة — undefined يحتفظ بنفس المعنى */
  planId?: string | null;
  toothFdi: number;
  procedure: string;
  priceSyp: number;
  status: PlanItemStatus;
  priority: number;
};

/** كيان خطة — الاسم والتاريخ والملاحظات وحالة النهاية، مع بنودها */
export type PlanDto = {
  id: string;
  name: string;
  planDate: Date;
  doctorName: string | null;
  notes: string | null;
  endedAt: Date | null;
  items: PlanItemDto[];
};

export type CreatePlanItemInput = {
  toothFdi: number;
  procedure: string;
  priceSyp: number;
  priority?: number;
  // ربط مباشر بخطة قائمة — البنود بلا خطة تظهر «بدون خطة محفوظة»
  planId?: string | null;
};

export type UpdatePlanItemInput = {
  procedure?: string;
  priceSyp?: number;
  priority?: number;
  status?: "PROPOSED" | "ACCEPTED" | "DONE";
  toothFdi?: number;
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
      planId: true,
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
      planId: input.planId ?? null,
      status: "PROPOSED",
    },
    select: {
      id: true,
      planId: true,
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

/** حذف بند غير منفذ — البند المنفذ نهائي ولا يُحذف عبر هذه الواجهة */
export async function deletePlanItem(
  ctx: TenantContext,
  patientId: string,
  itemId: string,
): Promise<"DELETED" | "NOT_FOUND" | "LOCKED"> {
  const db = clinicScope(ctx.clinicId);
  const removed = await db.treatmentPlanItem.deleteMany({
    where: {
      id: itemId,
      patientId,
      status: { not: "DONE" },
    },
  });
  if (removed.count > 0) return "DELETED";
  const locked = await db.treatmentPlanItem.findFirst({
    where: { id: itemId, patientId },
    select: { id: true },
  });
  return locked ? "LOCKED" : "NOT_FOUND";
}

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
      planId: true,
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
      planId: true,
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

  // 0 = بلا سن محدد («—» في الجدول) — الترقيم FDI يبدأ من 11
  const toothFdi = b.toothFdi;
  if (
    typeof toothFdi !== "number" ||
    !Number.isInteger(toothFdi) ||
    (toothFdi !== 0 && !isValidToothFdi(toothFdi))
  ) {
    return { ok: false, error: "رقم السن يجب أن يكون بترقيم FDI الدائم (11–48) أو 0 لبلا سن" };
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

  const planId =
    typeof b.planId === "string" && b.planId.length > 0 ? b.planId : null;

  return {
    ok: true,
    value: { toothFdi, procedure, priceSyp, priority, planId },
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
    // «مكتمل» لا يُحدَّث مباشرة — التنفيذ عبر مسار بدء التنفيذ فقط
    if (b.status !== "PROPOSED" && b.status !== "ACCEPTED") {
      return {
        ok: false,
        error: "الحالة يجب أن تكون مخطط أو جاري — التنفيذ عبر مسار البدء فقط",
      };
    }
    value.status = b.status;
  }
  if (b.toothFdi !== undefined) {
    const toothFdi = b.toothFdi;
    if (
      typeof toothFdi !== "number" ||
      !Number.isInteger(toothFdi) ||
      (toothFdi !== 0 && !isValidToothFdi(toothFdi))
    ) {
      return { ok: false, error: "رقم السن يجب أن يكون بترقيم FDI الدائم (11–48) أو 0 لبلا سن" };
    }
    value.toothFdi = toothFdi;
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
  planId: string | null;
  toothFdi: number;
  procedure: string;
  priceSyp: number;
  status: string;
  priority: number;
}): PlanItemDto {
  return {
    id: row.id,
    planId: row.planId,
    toothFdi: row.toothFdi,
    procedure: row.procedure,
    priceSyp: row.priceSyp,
    status: row.status as PlanItemStatus,
    priority: row.priority,
  };
}

// ─── كيان الخطة — إنشاء وقراءة وإنهاء وحذف ────────────────────────────────────

export type CreatePlanInput = {
  name?: string | null;
  doctorName?: string | null;
  planDate?: Date | null;
  notes?: string | null;
  /** بنود قائمة بلا خطة تُربط بالخطة الجديدة عند الإنشاء */
  itemIds?: string[];
};

export type CreatePlanParsed = {
  name: string | null;
  doctorName: string | null;
  planDate: Date | null;
  notes: string | null;
  itemIds: string[];
};

/** تحقق نقي من جسم طلب إنشاء خطة — قبل أي لمس لقاعدة البيانات */
export function parseCreatePlan(body: unknown): { ok: true; value: CreatePlanParsed } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;

  const name =
    typeof b.name === "string" && b.name.trim().length > 0
      ? b.name.trim().slice(0, 200)
      : null;
  const doctorName =
    typeof b.doctorName === "string" && b.doctorName.trim().length > 0
      ? b.doctorName.trim().slice(0, 200)
      : null;
  const notes =
    typeof b.notes === "string" && b.notes.trim().length > 0
      ? b.notes.trim().slice(0, 1000)
      : null;
  const planDate =
    typeof b.planDate === "string" && !Number.isNaN(new Date(b.planDate).getTime())
      ? new Date(b.planDate)
      : null;
  const itemIds = Array.isArray(b.itemIds)
    ? b.itemIds.filter((id): id is string => typeof id === "string")
    : [];

  return { ok: true, value: { name, doctorName, planDate, notes, itemIds } };
}

const PLAN_ITEM_SELECT = {
  id: true,
  planId: true,
  toothFdi: true,
  procedure: true,
  priceSyp: true,
  status: true,
  priority: true,
} as const;

/** قراءة خطط المريض مع بنودها — الأحدث أولاً */
export async function listPlans(
  ctx: TenantContext,
  patientId: string,
): Promise<PlanDto[]> {
  const db = clinicScope(ctx.clinicId);
  const plans = await db.treatmentPlan.findMany({
    where: { patientId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      planDate: true,
      doctorName: true,
      notes: true,
      endedAt: true,
      items: { select: PLAN_ITEM_SELECT, orderBy: [{ priority: "desc" }, { id: "asc" }] },
    },
  });
  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    planDate: plan.planDate,
    doctorName: plan.doctorName,
    notes: plan.notes,
    endedAt: plan.endedAt,
    items: plan.items.map(serialize),
  }));
}

/** إنشاء خطة جديدة — الاسم الافتراضي «خطة العلاج»، وربط البنود بلا خطة المختارة */
export async function createPlan(
  ctx: TenantContext,
  patientId: string,
  input: CreatePlanInput,
): Promise<PlanDto | { error: string }> {
  const db = clinicScope(ctx.clinicId);
  const plan = await db.treatmentPlan.create({
    data: {
      clinicId: ctx.clinicId,
      patientId,
      name: input.name ?? "خطة العلاج",
      planDate: input.planDate ?? new Date(),
      doctorName: input.doctorName ?? null,
      notes: input.notes ?? null,
    },
    select: { id: true, name: true, planDate: true, doctorName: true, notes: true, endedAt: true },
  });

  if (input.itemIds && input.itemIds.length > 0) {
    // ربط البنود محصوراً بمريض المناولة وببنود بلا خطة — لا سرقة بنود من مريض آخر
    await db.treatmentPlanItem.updateMany({
      where: { id: { in: input.itemIds }, patientId, planId: null },
      data: { planId: plan.id },
    });
  }

  const items = await db.treatmentPlanItem.findMany({
    where: { planId: plan.id, patientId },
    select: PLAN_ITEM_SELECT,
    orderBy: [{ priority: "desc" }, { id: "asc" }],
  });
  return {
    id: plan.id,
    name: plan.name,
    planDate: plan.planDate,
    doctorName: plan.doctorName,
    notes: plan.notes,
    endedAt: plan.endedAt,
    items: items.map(serialize),
  };
}

/** إنهاء الخطة — طابع زمني على endedAt، والبنود تبقى كما هي */
export async function endPlan(
  ctx: TenantContext,
  patientId: string,
  planId: string,
): Promise<boolean> {
  const db = clinicScope(ctx.clinicId);
  const result = await db.treatmentPlan.updateMany({
    where: { id: planId, patientId, endedAt: null },
    data: { endedAt: new Date() },
  });
  return result.count > 0;
}

/** حذف خطة مع بنودها — قيود الدفتر غير مرتبطة بعلاقات خارجية فتبقى سليمة */
export async function deletePlan(
  ctx: TenantContext,
  patientId: string,
  planId: string,
): Promise<boolean> {
  const db = clinicScope(ctx.clinicId);
  const plan = await db.treatmentPlan.findFirst({
    where: { id: planId, patientId },
    select: { id: true },
  });
  if (!plan) return false;
  await db.treatmentPlanItem.deleteMany({ where: { planId: plan.id, patientId } });
  await db.treatmentPlan.delete({ where: { id: plan.id } });
  return true;
}

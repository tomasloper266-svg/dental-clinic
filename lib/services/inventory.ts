import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";

// خدمة المخزون — مواد العيادة، التوريد، وخصم الاستعمال مع منع الرصيد السالب.
// كل استعلام عبر clinicScope بمعرّف العيادة من سياق الجلسة، ولا يلمس الـ
// route handler العميل مباشرة.

export type MaterialDto = {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  supplier: string | null;
  quantityOnHand: number;
  minQuantity: number;
  costSyp: number | null;
  isLow: boolean;
};

export type MaterialMovementDto = {
  id: string;
  materialId: string;
  /** التغيّر في الرصيد: توريد موجب، استعمال وتعديل يدوي سالب */
  quantityChange: number;
  note: string | null;
  movedAt: Date;
};

export type MaterialUsageDto = {
  id: string;
  materialId: string;
  quantityUsed: number;
  patientId: string | null;
  appointmentId: string | null;
  createdAt: Date;
};

const MATERIAL_SELECT = {
  id: true,
  name: true,
  unit: true,
  category: true,
  supplier: true,
  quantityOnHand: true,
  minQuantity: true,
  costSyp: true,
} as const;

// حد التنبيه: الكمية وصلت الحد الأدنى أو نزلت تحته — نقية للاختبار المباشر.
export function isLowStock(
  quantityOnHand: number,
  minQuantity: number,
): boolean {
  return quantityOnHand <= minQuantity;
}

function toMaterialDto(row: {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  supplier: string | null;
  quantityOnHand: unknown;
  minQuantity: unknown;
  // Decimal(12,2) من القاعدة — تُحوَّل إلى number عند حدود الخدمة
  costSyp: unknown;
}): MaterialDto {
  const quantityOnHand = Number(row.quantityOnHand);
  const minQuantity = Number(row.minQuantity);
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    category: row.category,
    supplier: row.supplier,
    quantityOnHand,
    minQuantity,
    costSyp: row.costSyp === null ? null : Number(row.costSyp),
    isLow: isLowStock(quantityOnHand, minQuantity),
  };
}

// كميات المخزون أعداد عشرية بحد منزلتين (Decimal(12,2)) — لا سالب ولا كمية بلا معنى.
function parseQuantity(value: unknown, error: string): number | string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return error;
  }
  const rounded = Math.round(value * 100) / 100;
  if (rounded <= 0) {
    return error;
  }
  return rounded;
}

// سعر المادة بعشرية بحد منزلتين (Decimal(12,2)) — لا سالب، والصفر مقبول.
// نقية للاختبار المباشر؛ نفس قاعدة التقريب بمنزلتين كالكميات.
function parseCostSyp(value: unknown): number | string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "سعر المادة يجب أن يكون رقماً غير سالب بحد منزلتين";
  }
  return Math.round(value * 100) / 100;
}

// نص وصفي اختياري (الفئة والمورد) — نتيجة متمايزة: النص القصير الصالح نجاح
// لا رسالة، ورسالة الخطأ تُعاد في فرعها فقط. الشكل القديم (نص = خطأ) جعل
// أي فئة أو مورد غير فارغ يُرفض رسالة خطأ هي نص المستخدم نفسه.
function parseOptionalText(
  value: unknown,
  error: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > 120) return { ok: false, error };
  return { ok: true, value: trimmed };
}

export type CreateMaterialInput = {
  name: string;
  unit: string;
  category?: string | null;
  supplier?: string | null;
  minQuantity: number;
  costSyp?: number;
  /** الرصيد الافتتاحي — يُسجَّل معه سطر حركة توريد أولى داخل المعاملة نفسها */
  quantity?: number;
};

export function parseCreateMaterial(
  body: unknown,
): { ok: true; value: CreateMaterialInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (name.length < 2 || name.length > 100) {
    return { ok: false, error: "اسم المادة يجب أن يكون بين 2 و100 حرف" };
  }

  const unit = typeof b.unit === "string" ? b.unit.trim() : "";
  if (unit.length < 1 || unit.length > 30) {
    return { ok: false, error: "وحدة القياس مطلوبة (حتى 30 حرفاً)" };
  }

  const minQuantity =
    typeof b.minQuantity === "number" && b.minQuantity >= 0
      ? Math.round(b.minQuantity * 100) / 100
      : NaN;
  if (!Number.isFinite(minQuantity)) {
    return { ok: false, error: "حد التنبيه يجب أن يكون رقماً غير سالب" };
  }

  let costSyp: number | undefined;
  if (b.costSyp !== undefined && b.costSyp !== null) {
    const parsedCost = parseCostSyp(b.costSyp);
    if (typeof parsedCost === "string") {
      return { ok: false, error: parsedCost };
    }
    costSyp = parsedCost;
  }

  // الرصيد الافتتاحي اختياري — رقم غير سالب بحد منزلتين، وصفر هو الافتراض
  let quantity = 0;
  if (b.quantity !== undefined && b.quantity !== null) {
    if (
      typeof b.quantity !== "number" ||
      !Number.isFinite(b.quantity) ||
      b.quantity < 0
    ) {
      return { ok: false, error: "الكمية يجب أن تكون رقماً غير سالب" };
    }
    quantity = Math.round(b.quantity * 100) / 100;
  }

  const category = parseOptionalText(b.category, "الفئة نص حتى 120 حرفاً");
  if (!category.ok) {
    return { ok: false, error: category.error };
  }

  const supplier = parseOptionalText(b.supplier, "المورد نص حتى 120 حرفاً");
  if (!supplier.ok) {
    return { ok: false, error: supplier.error };
  }

  return {
    ok: true,
    value: {
      name,
      unit,
      category: category.value,
      supplier: supplier.value,
      minQuantity,
      costSyp,
      quantity,
    },
  };
}

export type UpdateMaterialInput = {
  name?: string;
  unit?: string;
  category?: string | null;
  supplier?: string | null;
  // تعديل الرصيد مباشرة — يُسجَّل معه سطر حركة تسوية في الدفتر
  quantity?: number;
  minQuantity?: number;
  costSyp?: number | null;
};

export function parseUpdateMaterial(
  body: unknown,
): { ok: true; value: UpdateMaterialInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;

  const value: UpdateMaterialInput = {};

  if (b.name !== undefined) {
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (name.length < 2 || name.length > 100) {
      return { ok: false, error: "اسم المادة يجب أن يكون بين 2 و100 حرف" };
    }
    value.name = name;
  }

  if (b.unit !== undefined) {
    const unit = typeof b.unit === "string" ? b.unit.trim() : "";
    if (unit.length < 1 || unit.length > 30) {
      return { ok: false, error: "وحدة القياس مطلوبة (حتى 30 حرفاً)" };
    }
    value.unit = unit;
  }

  if (b.category !== undefined) {
    const category = parseOptionalText(b.category, "الفئة نص حتى 120 حرفاً");
    if (!category.ok) {
      return { ok: false, error: category.error };
    }
    value.category = category.value;
  }

  if (b.supplier !== undefined) {
    const supplier = parseOptionalText(b.supplier, "المورد نص حتى 120 حرفاً");
    if (!supplier.ok) {
      return { ok: false, error: supplier.error };
    }
    value.supplier = supplier.value;
  }

  if (b.quantity !== undefined) {
    const quantity =
      typeof b.quantity === "number" &&
      Number.isFinite(b.quantity) &&
      b.quantity >= 0
        ? Math.round(b.quantity * 100) / 100
        : NaN;
    if (!Number.isFinite(quantity)) {
      return { ok: false, error: "الكمية يجب أن تكون رقماً غير سالب" };
    }
    value.quantity = quantity;
  }

  if (b.minQuantity !== undefined) {
    const minQuantity =
      typeof b.minQuantity === "number" && b.minQuantity >= 0
        ? Math.round(b.minQuantity * 100) / 100
        : NaN;
    if (!Number.isFinite(minQuantity)) {
      return { ok: false, error: "حد التنبيه يجب أن يكون رقماً غير سالب" };
    }
    value.minQuantity = minQuantity;
  }

  if (b.costSyp !== undefined) {
    if (b.costSyp === null) {
      value.costSyp = null;
    } else {
      const parsedCost = parseCostSyp(b.costSyp);
      if (typeof parsedCost === "string") {
        return { ok: false, error: parsedCost };
      }
      value.costSyp = parsedCost;
    }
  }

  return { ok: true, value };
}

export type UsageInput = {
  materialId: string;
  quantityUsed: number;
  patientId?: string;
  appointmentId?: string;
};

export function parseUsageInput(
  body: unknown,
):
  | { ok: true; value: Omit<UsageInput, "materialId"> }
  | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;

  const quantityUsed = parseQuantity(
    b.quantityUsed,
    "الكمية المستعملة يجب أن تكون رقماً موجباً",
  );
  if (typeof quantityUsed === "string") {
    return { ok: false, error: quantityUsed };
  }

  const patientId =
    typeof b.patientId === "string" && b.patientId.length > 0
      ? b.patientId
      : undefined;
  const appointmentId =
    typeof b.appointmentId === "string" && b.appointmentId.length > 0
      ? b.appointmentId
      : undefined;

  return { ok: true, value: { quantityUsed, patientId, appointmentId } };
}

export async function listMaterials(
  ctx: TenantContext,
): Promise<MaterialDto[]> {
  const db = clinicScope(ctx.clinicId);
  const rows = await db.material.findMany({
    orderBy: { name: "asc" },
    take: 200,
    select: MATERIAL_SELECT,
  });
  return rows.map(toMaterialDto);
}

// المواد التي وصلت حد التنبيه أو تحته — تظهر بارزة في شاشة المخزون وبلوحة الطبيب.
export async function lowStockMaterials(
  ctx: TenantContext,
): Promise<MaterialDto[]> {
  const db = clinicScope(ctx.clinicId);
  const rows = await db.material.findMany({
    where: { quantityOnHand: { lte: db.material.fields.minQuantity } },
    orderBy: { name: "asc" },
    select: MATERIAL_SELECT,
  });
  return rows.map(toMaterialDto);
}

export async function getMaterial(
  ctx: TenantContext,
  materialId: string,
): Promise<MaterialDto | null> {
  const db = clinicScope(ctx.clinicId);
  const row = await db.material.findUnique({
    where: { id: materialId },
    select: MATERIAL_SELECT,
  });
  return row ? toMaterialDto(row) : null;
}

export async function createMaterial(
  ctx: TenantContext,
  input: CreateMaterialInput,
): Promise<MaterialDto> {
  const db = clinicScope(ctx.clinicId);
  const row = await db.material.create({
    data: {
      clinicId: ctx.clinicId,
      name: input.name,
      unit: input.unit,
      category: input.category ?? null,
      supplier: input.supplier ?? null,
      minQuantity: input.minQuantity,
      costSyp: input.costSyp,
      quantityOnHand: 0,
    },
    select: MATERIAL_SELECT,
  });
  return toMaterialDto(row);
}

export async function updateMaterial(
  ctx: TenantContext,
  materialId: string,
  input: UpdateMaterialInput,
): Promise<MaterialDto | null> {
  const db = clinicScope(ctx.clinicId);
  const existing = await db.material.findUnique({
    where: { id: materialId },
    select: MATERIAL_SELECT,
  });
  if (!existing) return null;

  return db.$transaction(async (tx) => {
    // الكمية تتغير بالتوريد والاستعمال حصراً — إن عدّلها المستخدم من نافذة
    // التعديل يُسجّل الفرق سطر حركة تسوية في الدفتر فيبقى الرصيد مفهوماً دائماً.
    // الرصيد الحالي يُقرأ داخل المعاملة حصراً — قراءته قبلها يسمح لتوريد متوازٍ
    // أن يُبتلع بقيمة مطلقة قديمة (lost update).
    if (input.quantity !== undefined) {
      const currentRow = await tx.material.findUnique({
        where: { id: materialId },
        select: { quantityOnHand: true },
      });
      const current = Number(currentRow?.quantityOnHand ?? existing.quantityOnHand);
      if (input.quantity !== current) {
        const adjustment = Math.round((input.quantity - current) * 100) / 100;
        await tx.material.update({
          where: { id: materialId },
          data: { quantityOnHand: input.quantity },
          select: { id: true },
        });
        await tx.materialMovement.create({
          data: {
            clinicId: ctx.clinicId,
            materialId,
            quantityChange: adjustment,
            note: "تعديل يدوي للكمية من نافذة التعديل",
            recordedById: ctx.userId,
          },
          select: { id: true },
        });
      }
    }

    // تعديل الهوية والحدود والمورد — الكمية فوق (إن وُجدت) بمعاملتها الخاصة
    const row = await tx.material.update({
      where: { id: materialId },
      data: {
        name: input.name,
        unit: input.unit,
        category: input.category,
        supplier: input.supplier,
        minQuantity: input.minQuantity,
        costSyp: input.costSyp,
      },
      select: MATERIAL_SELECT,
    });
    return toMaterialDto(row);
  });
}

export type SupplyInput = {
  quantity: number;
  note?: string;
  // تاريخ الحركة كما أدخله المستخدم (توريد بفاتورة سابقة مثلاً) — الافتراض الآن
  movedAt?: Date;
};

export function parseSupplyInput(
  body: unknown,
): { ok: true; value: SupplyInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;
  const quantity = parseQuantity(
    b.quantity,
    "الكمية الموردة يجب أن تكون رقماً موجباً",
  );
  if (typeof quantity === "string") {
    return { ok: false, error: quantity };
  }

  const note = parseOptionalText(b.note, "الملاحظات نص حتى 120 حرفاً");
  if (!note.ok) {
    return { ok: false, error: note.error };
  }

  let movedAt: Date | undefined;
  if (b.movedAt !== undefined && b.movedAt !== null) {
    movedAt = new Date(String(b.movedAt));
    if (Number.isNaN(movedAt.getTime())) {
      return { ok: false, error: "التاريخ غير صالح" };
    }
  }

  return { ok: true, value: { quantity, note: note.value ?? undefined, movedAt } };
}

// توريد كمية — زيادة صافية على الرصيد الحالي مع سطر حركة في الدفتر داخل معاملة واحدة.
export async function supplyMaterial(
  ctx: TenantContext,
  materialId: string,
  input: SupplyInput,
): Promise<MaterialDto | null> {
  const db = clinicScope(ctx.clinicId);
  const existing = await db.material.findUnique({
    where: { id: materialId },
    select: { id: true },
  });
  if (!existing) return null;

  return db.$transaction(async (tx) => {
    const row = await tx.material.update({
      where: { id: materialId },
      data: { quantityOnHand: { increment: input.quantity } },
      select: MATERIAL_SELECT,
    });
    await tx.materialMovement.create({
      data: {
        clinicId: ctx.clinicId,
        materialId,
        quantityChange: input.quantity,
        note: input.note,
        recordedById: ctx.userId,
        ...(input.movedAt !== undefined ? { movedAt: input.movedAt } : {}),
      },
      select: { id: true },
    });
    return toMaterialDto(row);
  });
}

export type UsageResult =
  | { ok: true; usage: MaterialUsageDto; material: MaterialDto }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "PATIENT_NOT_FOUND" }
  | { ok: false; reason: "INSUFFICIENT_STOCK"; available: number };

// خصم استعمال مادة — ذريّ: الخصم الشرطي (لا يمر لو كان سيرجع الرصيد سالباً)
// وقيود الاستعمال داخل معاملة واحدة، فلا يُخصم دون تسجيل ولا يُسجَّل دون خصم.
// الخصم الشرطي داخل قاعدة البيانات نفسها يمنع السالب حتى بتزامن طلبات متوازية.
export async function recordMaterialUsage(
  ctx: TenantContext,
  input: UsageInput,
): Promise<UsageResult> {
  const db = clinicScope(ctx.clinicId);

  return db.$transaction(async (tx) => {
    const material = await tx.material.findUnique({
      where: { id: input.materialId },
      select: MATERIAL_SELECT,
    });
    if (!material) {
      return { ok: false, reason: "NOT_FOUND" } as UsageResult;
    }

    if (input.patientId) {
      const patient = await tx.patient.findUnique({
        where: { id: input.patientId },
        select: { id: true },
      });
      if (!patient) {
        return { ok: false, reason: "PATIENT_NOT_FOUND" } as UsageResult;
      }
    }

    // تحديث شرطي: count=0 يعني أن الرصيد الحالي لا يكفي — يُرفض الخصم.
    const decremented = await tx.material.updateMany({
      where: {
        id: input.materialId,
        quantityOnHand: { gte: input.quantityUsed },
      },
      data: { quantityOnHand: { decrement: input.quantityUsed } },
    });
    if (decremented.count === 0) {
      return {
        ok: false,
        reason: "INSUFFICIENT_STOCK",
        available: Number(material.quantityOnHand),
      } as UsageResult;
    }

    const usage = await tx.materialUsage.create({
      data: {
        clinicId: ctx.clinicId,
        materialId: input.materialId,
        quantityUsed: input.quantityUsed,
        patientId: input.patientId,
        appointmentId: input.appointmentId,
        recordedById: ctx.userId,
      },
      select: {
        id: true,
        materialId: true,
        quantityUsed: true,
        patientId: true,
        appointmentId: true,
        createdAt: true,
      },
    });

    // سطر حركة سالب في الدفتر داخل المعاملة نفسها — السجل يعكس كل تغيّر رصيد
    await tx.materialMovement.create({
      data: {
        clinicId: ctx.clinicId,
        materialId: input.materialId,
        quantityChange: -input.quantityUsed,
        note: "استعمال",
        recordedById: ctx.userId,
      },
      select: { id: true },
    });

    return {
      ok: true,
      usage: { ...usage, quantityUsed: Number(usage.quantityUsed) },
      material: toMaterialDto({
        ...material,
        quantityOnHand: Number(material.quantityOnHand) - input.quantityUsed,
      }),
    } as UsageResult;
  });
}

export type UsageLogEntryDto = MaterialUsageDto & { materialName: string };

export async function listMaterialUsages(
  ctx: TenantContext,
  materialId: string,
): Promise<UsageLogEntryDto[] | null> {
  const db = clinicScope(ctx.clinicId);
  const material = await db.material.findUnique({
    where: { id: materialId },
    select: { id: true },
  });
  if (!material) return null;

  const rows = await db.materialUsage.findMany({
    where: { materialId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      materialId: true,
      quantityUsed: true,
      patientId: true,
      appointmentId: true,
      createdAt: true,
      material: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    materialId: row.materialId,
    quantityUsed: Number(row.quantityUsed),
    patientId: row.patientId,
    appointmentId: row.appointmentId,
    createdAt: row.createdAt,
    materialName: row.material.name,
  }));
}

export type PatientUsageRow = {
  createdAt: Date;
  materialName: string;
  quantityUsed: number;
  /** كلفة الاستهلاك = كلفة الوحدة × الكمية — null بلا كلفة مسجلة على المادة */
  costSyp: number | null;
};

/** استهلاك المواد على مريض بعينه — لسجل الدفعات/المخزون في ملفه */
export async function listPatientMaterialUsages(
  ctx: TenantContext,
  patientId: string,
): Promise<PatientUsageRow[]> {
  const db = clinicScope(ctx.clinicId);
  const rows = await db.materialUsage.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      createdAt: true,
      quantityUsed: true,
      material: { select: { name: true, costSyp: true } },
    },
  });
  return rows.map((row) => {
    const quantityUsed = Number(row.quantityUsed);
    return {
      createdAt: row.createdAt,
      materialName: row.material.name,
      quantityUsed,
      costSyp:
        row.material.costSyp === null
          ? null
          : Number(row.material.costSyp) * quantityUsed,
    };
  });
}

// سجل حركات مادة — الدفتر الإلحاقي لكل تغيّر رصيد، الأحدث أولاً لسجل «السجل».
export async function listMaterialMovements(
  ctx: TenantContext,
  materialId: string,
): Promise<MaterialMovementDto[] | null> {
  const db = clinicScope(ctx.clinicId);
  const material = await db.material.findUnique({
    where: { id: materialId },
    select: { id: true },
  });
  if (!material) return null;

  const rows = await db.materialMovement.findMany({
    where: { materialId },
    orderBy: { movedAt: "desc" },
    take: 100,
    select: {
      id: true,
      materialId: true,
      quantityChange: true,
      note: true,
      movedAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    materialId: row.materialId,
    quantityChange: Number(row.quantityChange),
    note: row.note,
    movedAt: row.movedAt,
  }));
}

// حذف مادة — مع سطور استعمالها وحركاتها داخل معاملة واحدة، فلا يبقى سطر يتيم.
// عمليات الاستعمال سجل سريري مالي مرتبط بالمواد، وحذف المادة يفرض حذفها.
export async function deleteMaterial(
  ctx: TenantContext,
  materialId: string,
): Promise<boolean> {
  const db = clinicScope(ctx.clinicId);
  const existing = await db.material.findUnique({
    where: { id: materialId },
    select: { id: true },
  });
  if (!existing) return false;

  await db.$transaction(async (tx) => {
    await tx.materialUsage.deleteMany({ where: { materialId } });
    await tx.material.delete({ where: { id: materialId } });
  });
  return true;
}

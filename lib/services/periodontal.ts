import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";
import { isValidToothFdi } from "@/lib/odontogram/fdi";

// خدمة قراءات الدواعم — نمط findings.ts حرفاً: كل استعلام عبر clinicScope
// بمعرّف العيادة من سياق الجلسة، ولا يلمس الـ handler العميل مباشرة.
// السجل إلحاقي بالكامل: لا تعديل ولا حذف — التصحيح بقياس جديد يحمل تاريخه.

// حدود القياسات السريرية — أول حقول عددية في النظام، بحدود صريحة.
export const POCKET_DEPTH_MIN_MM = 0;
export const POCKET_DEPTH_MAX_MM = 15;
export const RECESSION_MIN_MM = -5;
export const RECESSION_MAX_MM = 10;
export const MOBILITY_MIN_GRADE = 0;
export const MOBILITY_MAX_GRADE = 3;

export type PeriodontalReadingDto = {
  id: string;
  toothFdi: number;
  pocketDepthMm: number | null;
  recessionMm: number | null;
  bleedingOnProbing: boolean;
  mobilityGrade: number | null;
  note: string | null;
  measuredAt: string;
};

export type CreateReadingInput = {
  toothFdi: number;
  pocketDepthMm?: number;
  recessionMm?: number;
  bleedingOnProbing?: boolean;
  mobilityGrade?: number;
  note?: string;
};

const READING_SELECT = {
  id: true,
  toothFdi: true,
  pocketDepthMm: true,
  recessionMm: true,
  bleedingOnProbing: true,
  mobilityGrade: true,
  note: true,
  measuredAt: true,
} as const;

export async function listReadings(
  ctx: TenantContext,
  patientId: string,
): Promise<PeriodontalReadingDto[]> {
  const db = clinicScope(ctx.clinicId);
  const readings = await db.periodontalReading.findMany({
    where: { patientId },
    orderBy: [{ measuredAt: "asc" }, { id: "asc" }],
    select: READING_SELECT,
  });
  return readings.map(serialize);
}

export async function createReading(
  ctx: TenantContext,
  patientId: string,
  input: CreateReadingInput,
): Promise<PeriodontalReadingDto> {
  const db = clinicScope(ctx.clinicId);
  const reading = await db.periodontalReading.create({
    data: {
      clinicId: ctx.clinicId,
      patientId,
      toothFdi: input.toothFdi,
      pocketDepthMm: input.pocketDepthMm,
      recessionMm: input.recessionMm,
      bleedingOnProbing: input.bleedingOnProbing ?? false,
      mobilityGrade: input.mobilityGrade,
      note: input.note,
      recordedById: ctx.userId,
    },
    select: READING_SELECT,
  });
  return serialize(reading);
}

// تحقق نقي — يُختبر في وحدة منفصلة عن قاعدة البيانات.
export function parseCreateReading(
  body: unknown,
): { ok: true; value: CreateReadingInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;

  const toothFdi = b.toothFdi;
  if (typeof toothFdi !== "number" || !isValidToothFdi(toothFdi)) {
    return { ok: false, error: "رقم السن يجب أن يكون بترقيم FDI الدائم (11–48)" };
  }

  const pocket = optionalInt(
    b.pocketDepthMm,
    POCKET_DEPTH_MIN_MM,
    POCKET_DEPTH_MAX_MM,
    "عمق الجيب",
  );
  if (!pocket.ok) return pocket;

  const recession = optionalInt(
    b.recessionMm,
    RECESSION_MIN_MM,
    RECESSION_MAX_MM,
    "الانكماش",
  );
  if (!recession.ok) return recession;

  const mobility = optionalInt(
    b.mobilityGrade,
    MOBILITY_MIN_GRADE,
    MOBILITY_MAX_GRADE,
    "الحركية",
  );
  if (!mobility.ok) return mobility;

  const bleedingOnProbing =
    b.bleedingOnProbing === undefined || b.bleedingOnProbing === null
      ? undefined
      : b.bleedingOnProbing === true;
  if (
    b.bleedingOnProbing !== undefined &&
    b.bleedingOnProbing !== null &&
    typeof b.bleedingOnProbing !== "boolean"
  ) {
    return { ok: false, error: "قيمة النزيف يجب أن تكون منطقية" };
  }

  const note =
    typeof b.note === "string" && b.note.trim()
      ? b.note.trim().slice(0, 500)
      : undefined;

  // القراءة الجزئية مقبولة — الاستكشاف السريري قد يقيّد بعض القياسات فقط،
  // لكن القراءة الفارغة كلياً (بلا أي قياس ولا نزيف ولا ملاحظة) لا معنى لها.
  const hasMeasurement =
    pocket.value !== undefined ||
    recession.value !== undefined ||
    mobility.value !== undefined ||
    bleedingOnProbing === true ||
    note !== undefined;
  if (!hasMeasurement) {
    return { ok: false, error: "القراءة تحتاج قياساً واحداً على الأقل" };
  }

  return {
    ok: true,
    value: {
      toothFdi,
      pocketDepthMm: pocket.value,
      recessionMm: recession.value,
      bleedingOnProbing,
      mobilityGrade: mobility.value,
      note,
    },
  };
}

function optionalInt(
  value: unknown,
  min: number,
  max: number,
  labelAr: string,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    return {
      ok: false,
      error: `${labelAr} يجب أن يكون رقماً صحيحاً بين ${min} و${max}`,
    };
  }
  return { ok: true, value };
}

function serialize(row: {
  id: string;
  toothFdi: number;
  pocketDepthMm: number | null;
  recessionMm: number | null;
  bleedingOnProbing: boolean;
  mobilityGrade: number | null;
  note: string | null;
  measuredAt: Date;
}): PeriodontalReadingDto {
  return {
    id: row.id,
    toothFdi: row.toothFdi,
    pocketDepthMm: row.pocketDepthMm,
    recessionMm: row.recessionMm,
    bleedingOnProbing: row.bleedingOnProbing,
    mobilityGrade: row.mobilityGrade,
    note: row.note,
    measuredAt: row.measuredAt.toISOString(),
  };
}

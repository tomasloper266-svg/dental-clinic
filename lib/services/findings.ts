import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";
import { isValidToothFdi } from "@/lib/odontogram/fdi";
import { parseSurfaceInput } from "@/lib/odontogram/surfaces";
import {
  TOOTH_STATUS_KEYS,
  FINDING_KINDS,
  type ToothStatusKey,
  type FindingKindKey,
} from "@/lib/odontogram/statuses";

// خدمة مشاهدات الأسنان — تتبع نمط lib/services/patients.ts: كل استعلام عبر
// clinicScope بمعرّف العيادة من سياق الجلسة، ولا يلمس الـ handler العميل مباشرة.
// المشاهدات سجل إلحاقي: لا تعديل ولا حذف — التصحيح بقيد جديد يحمل تاريخه.

export type FindingDto = {
  id: string;
  toothFdi: number;
  kind: FindingKindKey;
  status: ToothStatusKey;
  surface: string | null;
  note: string | null;
  recordedAt: string;
};

export type CreateFindingInput = {
  toothFdi: number;
  kind: FindingKindKey;
  status: ToothStatusKey;
  surface?: string;
  note?: string;
};

export async function listFindings(
  ctx: TenantContext,
  patientId: string,
): Promise<FindingDto[]> {
  const db = clinicScope(ctx.clinicId);
  const findings = await db.toothFinding.findMany({
    // clinicId صريح أيضاً — الحقن الآلي في clinicScope ضمانة إضافية.
    where: { patientId },
    orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      toothFdi: true,
      kind: true,
      status: true,
      surface: true,
      note: true,
      recordedAt: true,
    },
  });
  return findings.map(serialize);
}

export async function createFinding(
  ctx: TenantContext,
  patientId: string,
  input: CreateFindingInput,
): Promise<FindingDto> {
  const db = clinicScope(ctx.clinicId);
  const finding = await db.toothFinding.create({
    data: {
      clinicId: ctx.clinicId,
      patientId,
      toothFdi: input.toothFdi,
      kind: input.kind,
      status: input.status,
      surface: input.surface,
      note: input.note,
      recordedById: ctx.userId,
    },
    select: {
      id: true,
      toothFdi: true,
      kind: true,
      status: true,
      surface: true,
      note: true,
      recordedAt: true,
    },
  });
  return serialize(finding);
}

// تحقق نقي — يُختبر في وحدة منفصلة عن قاعدة البيانات.
export function parseCreateFinding(
  body: unknown,
): { ok: true; value: CreateFindingInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;

  const toothFdi = b.toothFdi;
  if (typeof toothFdi !== "number" || !isValidToothFdi(toothFdi)) {
    return { ok: false, error: "رقم السن يجب أن يكون بترقيم FDI الدائم (11–48)" };
  }

  const kind = b.kind;
  if (typeof kind !== "string" || !FINDING_KINDS.includes(kind as never)) {
    return { ok: false, error: "نوع القيد غير صالح" };
  }

  const status = b.status;
  if (typeof status !== "string" || !TOOTH_STATUS_KEYS.includes(status as never)) {
    return { ok: false, error: "حالة السن غير صالحة" };
  }

  // السطح يُخزن بأكواد مرجعية (مثال O+M) — القادم كأسماء عربية من الواجهة
  // القديمة يُطبَّع عبر نفس خريطة هجرة القاعدة، وأي شيء خارج كتالوج تشريح
  // السن نفسه يُرفض (القاطع بلا «المضغية» مثلاً).
  let surface: string | undefined;
  if (typeof b.surface === "string" && b.surface.trim()) {
    const parsed = parseSurfaceInput(b.surface, toothFdi);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    surface = parsed.value;
  }
  const note =
    typeof b.note === "string" && b.note.trim()
      ? b.note.trim().slice(0, 500)
      : undefined;

  return {
    ok: true,
    value: {
      toothFdi,
      kind: kind as FindingKindKey,
      status: status as ToothStatusKey,
      surface,
      note,
    },
  };
}

function serialize(row: {
  id: string;
  toothFdi: number;
  kind: string;
  status: string;
  surface: string | null;
  note: string | null;
  recordedAt: Date;
}): FindingDto {
  return {
    id: row.id,
    toothFdi: row.toothFdi,
    kind: row.kind as FindingKindKey,
    status: row.status as ToothStatusKey,
    surface: row.surface,
    note: row.note,
    recordedAt: row.recordedAt.toISOString(),
  };
}

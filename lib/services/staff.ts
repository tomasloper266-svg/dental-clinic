import type { TenantContext } from "@/lib/tenant/context";
import { clinicScope } from "@/lib/tenant/clinic-client";
import {
  STAFF_ROLES,
  staffRoleLabel,
  type StaffRoleKey,
} from "@/lib/staff-view";

// إعادة تصدير ثوابت الأدوار النقية — مصدرها lib/staff-view (بلا I/O)
// حتى يبقى استيراد ملفات العميل من هناك فقط.
export {
  STAFF_ROLES,
  STAFF_ROLE_LABELS,
  staffRoleLabel,
  type StaffRoleKey,
} from "@/lib/staff-view";

// خدمة الطاقم — بطاقات الأعضاء (اسم، دور، تخصص، هاتف، عمولة، دوام) المستقلة
// عن حسابات الدخول (User): الطبيب هنا كيان جدولة وعمولة قد لا يحسب مسجلاً.
// كل استعلام عبر clinicScope بمعرّف العيادة من سياق الجلسة. التعطيل تحوّل حالة
// آمن (isActive) ولا يحذف شيئاً، والحذف يفصل مواعيده فقط (SET NULL على المخطط).

export type StaffMemberDto = {
  id: string;
  name: string;
  role: StaffRoleKey;
  roleLabelAr: string;
  specialty: string | null;
  phone: string | null;
  commissionPercent: number;
  colorHex: string;
  scheduleNote: string | null;
  isActive: boolean;
  /** مواعيد قادمة (من الفجر بما فيها) لم تُلغَ — تُحسب بالخدمة لا بالمكوّن */
  upcomingCount: number;
};

const STAFF_SELECT = {
  id: true,
  name: true,
  role: true,
  specialty: true,
  phone: true,
  commissionPercent: true,
  colorHex: true,
  scheduleNote: true,
  isActive: true,
} as const;

function toDto(
  row: Omit<StaffMemberDto, "upcomingCount" | "roleLabelAr">,
  upcomingCount: number,
): StaffMemberDto {
  return {
    ...row,
    role: row.role as StaffRoleKey,
    roleLabelAr: staffRoleLabel(row.role as StaffRoleKey),
    upcomingCount,
  };
}

export type ParsedStaffInput = {
  name: string;
  role: StaffRoleKey;
  specialty: string | null;
  phone: string | null;
  commissionPercent: number;
  colorHex: string;
  scheduleNote: string | null;
  isActive: boolean;
};

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

// مدقق الإدخال النقي — يعيد قيمة منتهية أو رسالة خطأ عربية، بلا I/O.
export function parseStaffInput(
  body: unknown,
): { ok: true; value: ParsedStaffInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const raw = body as Record<string, unknown>;

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (name.length < 2) {
    return { ok: false, error: "الاسم مطلوب (حرفان على الأقل)" };
  }

  const role = typeof raw.role === "string" ? raw.role : "";
  if (!STAFF_ROLES.includes(role as StaffRoleKey)) {
    return { ok: false, error: "الدور غير معروف" };
  }

  const commission =
    typeof raw.commissionPercent === "number" ? raw.commissionPercent : Number(raw.commissionPercent);
  if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
    return { ok: false, error: "نسبة العمولة يجب أن تكون بين 0 و 100" };
  }

  const colorHex =
    typeof raw.colorHex === "string" && /^#[0-9a-fA-F]{6}$/.test(raw.colorHex.trim())
      ? raw.colorHex.trim()
      : "#d4af37";

  return {
    ok: true,
    value: {
      name,
      role: role as StaffRoleKey,
      specialty: optionalText(raw.specialty),
      phone: optionalText(raw.phone),
      commissionPercent: Math.round(commission * 100) / 100,
      colorHex,
      scheduleNote: optionalText(raw.scheduleNote),
      isActive: typeof raw.isActive === "boolean" ? raw.isActive : true,
    },
  };
}

export async function listStaff(
  ctx: TenantContext,
  options: { upcomingFrom?: Date } = {},
): Promise<StaffMemberDto[]> {
  const db = clinicScope(ctx.clinicId);

  const members = await db.staffMember.findMany({
    select: STAFF_SELECT,
    orderBy: [{ createdAt: "asc" }],
  });

  // عدّاد المواعيد القادمة بجملة groupBy واحدة — لا N استعلام لكل عضو.
  const from = options.upcomingFrom ?? new Date(0);
  const grouped = await db.appointment.groupBy({
    by: ["staffId"],
    where: {
      staffId: { not: null },
      startsAt: { gte: from },
      status: { not: "CANCELLED" },
    },
    _count: { _all: true },
  });
  const countByStaff = new Map(
    grouped.map((g) => [g.staffId, g._count._all] as const),
  );

  return members.map((row) =>
    toDto(row, countByStaff.get(row.id) ?? 0),
  );
}

export async function createStaff(
  ctx: TenantContext,
  input: ParsedStaffInput,
): Promise<StaffMemberDto> {
  const db = clinicScope(ctx.clinicId);
  const row = await db.staffMember.create({
    data: { ...input, clinicId: ctx.clinicId },
    select: STAFF_SELECT,
  });
  return toDto(row, 0);
}

async function ownedMemberId(
  ctx: TenantContext,
  id: string,
): Promise<string | null> {
  const db = clinicScope(ctx.clinicId);
  const existing = await db.staffMember.findFirst({
    where: { id },
    select: { id: true },
  });
  return existing?.id ?? null;
}

export async function updateStaff(
  ctx: TenantContext,
  id: string,
  input: Partial<ParsedStaffInput>,
): Promise<StaffMemberDto | null> {
  if (!(await ownedMemberId(ctx, id))) return null;

  const db = clinicScope(ctx.clinicId);
  const row = await db.staffMember.update({
    where: { id },
    data: input,
    select: STAFF_SELECT,
  });
  return toDto(row, 0);
}

export async function setStaffActive(
  ctx: TenantContext,
  id: string,
  isActive: boolean,
): Promise<StaffMemberDto | null> {
  return updateStaff(ctx, id, { isActive });
}

/** حذف عضو الطاقم — مواعيده تبقى بلا طبيب (SET NULL). يرد false إن لم يوجد. */
export async function deleteStaff(ctx: TenantContext, id: string): Promise<boolean> {
  if (!(await ownedMemberId(ctx, id))) return false;
  const db = clinicScope(ctx.clinicId);
  await db.staffMember.delete({ where: { id } });
  return true;
}

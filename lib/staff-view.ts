// دوال عرض الطاقم — نقية بلا I/O، تُختبر في وحدة منفصلة عن اللوحة.
import type { TranslationKey } from "@/lib/i18n/core";
// الأفاتار الملوّن يتبع لون التمييز الذي يختاره المستخدم (colorHex) بنفس
// صيغة المرجع: حد شفاف وخلفية تدرّج من نفس درجة اللون.

export type StaffFormValues = {
  name: string;
  role: string;
  specialty: string;
  phone: string;
  commissionPercent: string;
  colorHex: string;
  scheduleNote: string;
};

export const DEFAULT_STAFF_COLOR = "#d4af37";

// ثوابت الأدوار — نقية بلا I/O، يعيد خادم الطاقم تصديرها، وملفات العميل
// تستوردها من هنا مباشرة حتى لا تُسحب Prisma/pg إلى حزمة المتصفح.
export type StaffRoleKey = "DENTIST" | "RECEPTION" | "ASSISTANT" | "ACCOUNTANT";

export const STAFF_ROLES: readonly StaffRoleKey[] = [
  "DENTIST",
  "RECEPTION",
  "ASSISTANT",
  "ACCOUNTANT",
] as const;

export const STAFF_ROLE_LABELS: Record<StaffRoleKey, string> = {
  DENTIST: "طبيب أسنان",
  RECEPTION: "استقبال وإدارة",
  ASSISTANT: "مساعد طبيب",
  ACCOUNTANT: "محاسب",
};

export const STAFF_ROLE_LABEL_KEYS: Record<StaffRoleKey, TranslationKey> = {
  DENTIST: "staff.roleDentist",
  RECEPTION: "staff.roleReception",
  ASSISTANT: "staff.roleAssistant",
  ACCOUNTANT: "staff.roleAccountant",
};

export function staffRoleLabelKey(role: StaffRoleKey): TranslationKey {
  return STAFF_ROLE_LABEL_KEYS[role];
}

export function staffRoleLabel(role: StaffRoleKey): string {
  return STAFF_ROLE_LABELS[role] ?? role;
}

/** نموذج فارغ — قيم إضافة عضو جديد */
export function emptyStaffForm(): StaffFormValues {
  return {
    name: "",
    role: "DENTIST",
    specialty: "",
    phone: "",
    commissionPercent: "0",
    colorHex: DEFAULT_STAFF_COLOR,
    scheduleNote: "",
  };
}

/** نموذج محمّل من عضو قائم — قيم تعديل */
export function staffMemberToForm(member: {
  name: string;
  role: string;
  specialty: string | null;
  phone: string | null;
  commissionPercent: number;
  colorHex: string;
  scheduleNote: string | null;
}): StaffFormValues {
  return {
    name: member.name,
    role: member.role,
    specialty: member.specialty ?? "",
    phone: member.phone ?? "",
    commissionPercent: String(member.commissionPercent),
    colorHex: member.colorHex,
    scheduleNote: member.scheduleNote ?? "",
  };
}

export type AvatarTint = {
  borderColor: string;
  background: string;
  color: string;
};

/** تلوين أفاتار عضو الطاقم من لون التمييز — نفس تركيبة المرجع (55/33/11) */
export function avatarTint(colorHex: string): AvatarTint {
  const hex = /^#[0-9a-fA-F]{6}$/.test(colorHex) ? colorHex : DEFAULT_STAFF_COLOR;
  return {
    borderColor: `${hex}55`,
    background: `linear-gradient(135deg, ${hex}33, ${hex}11)`,
    color: hex,
  };
}

/** نص نسبة العمولة — تُخفى الصفرية كما في المرجع (حقل اختياري) */
export function commissionLabel(percent: number): string | null {
  return percent > 0 ? `${percent}%` : null;
}

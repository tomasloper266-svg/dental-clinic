import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";

// خدمة المرضى — نمط مرجعي لخدمات العيادة: كل استعلام عبر clinicScope
// بمعرّف العيادة من سياق الجلسة، ولا يلمس الـ route handler العميل مباشرة.

export type Gender = "MALE" | "FEMALE";

export type PatientDto = {
  id: string;
  name: string;
  birthYear: number | null;
  phone: string | null;
  address: string | null;
  medicalNotes: string | null;
  gender: Gender | null;
  secondaryPhone: string | null;
  homePhone: string | null;
  email: string | null;
  nationalId: string | null;
  bloodType: string | null;
  allergies: string | null;
  chronicDiseases: string | null;
  emergencyContacts: string | null;
  fileNo: number | null;
  createdAt: Date;
};

const PATIENT_SELECT = {
  id: true,
  name: true,
  birthYear: true,
  phone: true,
  address: true,
  medicalNotes: true,
  gender: true,
  secondaryPhone: true,
  homePhone: true,
  email: true,
  nationalId: true,
  bloodType: true,
  allergies: true,
  chronicDiseases: true,
  emergencyContacts: true,
  fileNo: true,
  createdAt: true,
} as const;

export async function listPatients(
  ctx: TenantContext,
  search?: string,
): Promise<PatientDto[]> {
  const db = clinicScope(ctx.clinicId);
  // البحث بالاسم أو الهاتف أو الرقم الوطني أو رقم الملف (الأيوبي) —
  // الرقم الصرف يطابق fileNo وnationalId بدقة، والنص يطابق الاسم والهواتف.
  const needle = search?.trim();
  const numeric = /^\d+$/.test(needle ?? "") ? Number(needle) : null;
  const where = needle
    ? {
        OR: [
          { name: { contains: needle, mode: "insensitive" as const } },
          { phone: { contains: needle } },
          { secondaryPhone: { contains: needle } },
          { nationalId: { contains: needle } },
          ...(numeric !== null ? [{ fileNo: numeric }] : []),
        ],
      }
    : {};
  const patients = await db.patient.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: PATIENT_SELECT,
  });
  return patients;
}

export async function getPatient(
  ctx: TenantContext,
  patientId: string,
): Promise<PatientDto | null> {
  const db = clinicScope(ctx.clinicId);
  return db.patient.findUnique({
    where: { id: patientId },
    select: PATIENT_SELECT,
  });
}

export type CreatePatientInput = {
  name: string;
  birthYear?: number;
  phone?: string;
  address?: string;
  medicalNotes?: string;
  gender?: Gender;
  secondaryPhone?: string;
  homePhone?: string;
  email?: string;
  nationalId?: string;
  bloodType?: string;
  allergies?: string;
  chronicDiseases?: string;
  emergencyContacts?: string;
};

export type UpdatePatientInput = Omit<
  Partial<CreatePatientInput>,
  "birthYear" | "gender"
> & {
  // null يمسح الحقل في التحديث — أوسع من نوع الإنشاء الذي لا يمسح شيئاً.
  // Omit لأن التقاطع مع Partial يضيّق النوع ويحجب null.
  birthYear?: number | null;
  gender?: Gender | null;
};

// حقول نصية حرة — القيم تُقتطع من الفراغات ويُحوَّل الفراغ إلى undefined
// ليعني «أُفرغ الحقل» بدل «أُهمل».
function optionalString(
  value: unknown,
  guard: string,
): { value?: string } | { error: string } {
  if (value === undefined) return {};
  if (typeof value !== "string") return { error: guard };
  const trimmed = value.trim();
  return { value: trimmed || undefined };
}

// حقول نصية حرة — مفاتيحها النصية فقط (سنة الميلاد والجنس يُعالجان صراحة)؛
// المصفوفتان في validatePatientFields وparseUpdatePatient هما المصدر التشغيلي.
type StringField =
  | "phone"
  | "secondaryPhone"
  | "homePhone"
  | "address"
  | "email"
  | "nationalId"
  | "bloodType"
  | "allergies"
  | "chronicDiseases"
  | "emergencyContacts"
  | "medicalNotes";

export function validatePatientFields(
  b: Record<string, unknown>,
): { ok: true; value: CreatePatientInput } | { ok: false; error: string } {
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (name.length < 2 || name.length > 100) {
    return { ok: false, error: "اسم المريض يجب أن يكون بين 2 و100 حرف" };
  }
  const birthYear =
    typeof b.birthYear === "number" && Number.isInteger(b.birthYear)
      ? b.birthYear
      : undefined;
  if (birthYear !== undefined && (birthYear < 1900 || birthYear > 2100)) {
    return { ok: false, error: "سنة الميلاد غير صالحة" };
  }
  let gender: Gender | undefined;
  if (b.gender !== undefined && b.gender !== null) {
    if (b.gender !== "MALE" && b.gender !== "FEMALE") {
      return { ok: false, error: "الجنس غير صالح" };
    }
    gender = b.gender;
  }

  const strings: ReadonlyArray<[StringField, string]> = [
    ["phone", "رقم الهاتف غير صالح"],
    ["secondaryPhone", "الهاتف الإضافي غير صالح"],
    ["homePhone", "هاتف المنزل غير صالح"],
    ["address", "العنوان غير صالح"],
    ["email", "البريد الإلكتروني غير صالح"],
    ["nationalId", "الرقم الوطني غير صالح"],
    ["bloodType", "فصيلة الدم غير صالحة"],
    ["allergies", "الحساسيات غير صالحة"],
    ["chronicDiseases", "الأمراض المزمنة غير صالحة"],
    ["emergencyContacts", "جهات اتصال الطوارئ غير صالحة"],
    ["medicalNotes", "الملاحظات الطبية غير صالحة"],
  ];

  const value: CreatePatientInput = { name, birthYear, gender };
  for (const [key, guard] of strings) {
    const parsed = optionalString(b[key], guard);
    if ("error" in parsed) return { ok: false, error: parsed.error };
    if (parsed.value !== undefined) value[key] = parsed.value;
  }

  return { ok: true, value };
}

// تحقق نقي — يُختبر في وحدة منفصلة عن قاعدة البيانات.
export function parseCreatePatient(
  body: unknown,
): { ok: true; value: CreatePatientInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  return validatePatientFields(body as Record<string, unknown>);
}

// نفس القواعد لكن كل حقل اختياري — يُحدَّث ما ورد فقط.
export function parseUpdatePatient(
  body: unknown,
): { ok: true; value: UpdatePatientInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;
  const partial: UpdatePatientInput = {};

  if (b.name !== undefined) {
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (name.length < 2 || name.length > 100) {
      return { ok: false, error: "اسم المريض يجب أن يكون بين 2 و100 حرف" };
    }
    partial.name = name;
  }
  if (b.birthYear !== undefined) {
    if (b.birthYear === null) {
      partial.birthYear = null;
    } else if (
      typeof b.birthYear !== "number" ||
      !Number.isInteger(b.birthYear) ||
      b.birthYear < 1900 ||
      b.birthYear > 2100
    ) {
      return { ok: false, error: "سنة الميلاد غير صالحة" };
    } else {
      partial.birthYear = b.birthYear;
    }
  }
  if (b.gender !== undefined) {
    if (b.gender === null) {
      partial.gender = null;
    } else if (b.gender !== "MALE" && b.gender !== "FEMALE") {
      return { ok: false, error: "الجنس غير صالح" };
    } else {
      partial.gender = b.gender;
    }
  }

  const strings: ReadonlyArray<[StringField, string]> = [
    ["phone", "رقم الهاتف غير صالح"],
    ["secondaryPhone", "الهاتف الإضافي غير صالح"],
    ["homePhone", "هاتف المنزل غير صالح"],
    ["address", "العنوان غير صالح"],
    ["email", "البريد الإلكتروني غير صالح"],
    ["nationalId", "الرقم الوطني غير صالح"],
    ["bloodType", "فصيلة الدم غير صالحة"],
    ["allergies", "الحساسيات غير صالحة"],
    ["chronicDiseases", "الأمراض المزمنة غير صالحة"],
    ["emergencyContacts", "جهات اتصال الطوارئ غير صالحة"],
    ["medicalNotes", "الملاحظات الطبية غير صالحة"],
  ];

  for (const [key, guard] of strings) {
    if (b[key] === undefined) continue;
    const parsed = optionalString(b[key], guard);
    if ("error" in parsed) return { ok: false, error: parsed.error };
    // حقل ورد فارغاً يعني «أُفرغ» — يُخزَّن سلسلة فارغة لا إهمالاً للتحديث
    partial[key] = parsed.value ?? "";
  }

  return { ok: true, value: partial };
}

// رقم الأيوبي — أول رقم حر داخل العيادة بدءاً من 1. نقية؛ تُستدعى داخل
// معاملة الإنشاء حيث يمنع القيد الفريد (clinicId, fileNo) أي تزاحم.
export function nextFileNo(existing: ReadonlyArray<number | null>): number {
  return existing.reduce<number>((max, no) => Math.max(max, no ?? 0), 0) + 1;
}

export async function createPatient(
  ctx: TenantContext,
  input: CreatePatientInput,
): Promise<PatientDto> {
  const db = clinicScope(ctx.clinicId);
  return db.$transaction(async (tx) => {
    const numbers = await tx.patient.findMany({
      where: { clinicId: ctx.clinicId },
      select: { fileNo: true },
    });
    const patient = await tx.patient.create({
      // clinicId صريح أيضاً — الحقن الآلي في clinicScope يبقى ضمانة إضافية.
      data: {
        clinicId: ctx.clinicId,
        ...input,
        fileNo: nextFileNo(numbers.map((p) => p.fileNo)),
      },
      select: PATIENT_SELECT,
    });
    return patient;
  });
}

// التحديث محصور بالعيادة عبر clinicScope — مريض عيادة أخرى يعيد null
// ولا يُلمس أبداً، فيتحول العبث عبر المعرّفات إلى 404 وليس تعديلاً.
export async function updatePatient(
  ctx: TenantContext,
  patientId: string,
  input: UpdatePatientInput,
): Promise<PatientDto | null> {
  const db = clinicScope(ctx.clinicId);
  const existing = await db.patient.findFirst({
    where: { id: patientId },
    select: { id: true },
  });
  if (!existing) return null;

  return db.patient.update({
    where: { id: patientId },
    data: input,
    select: PATIENT_SELECT,
  });
}

export type DeletePatientResult = { ok: true } | { ok: false; error: string };

/**
 * حذف مريض بكل سجلاته، محصوراً بالعيادة عبر clinicScope — بموافقة صريحة
 * من الواجهة (تأكيد قبل الحذف). داخل معاملة واحدة: استهلاك المواد المرتبط
 * بمواعيده يُحذف أولاً (بلا حذف تعاقبي في المخطط)، ثم سجلات المريض، ثم
 * مواعيده (تجرّ معها التذكيرات وسجل الحالات بحذف تعاقبي)، ثم المريض نفسه.
 * القيود المالية وكل السجل يُزالون مع المريض — طلب المستخدم الصريح للحذف.
 */
export async function deletePatient(
  ctx: TenantContext,
  patientId: string,
): Promise<DeletePatientResult> {
  const db = clinicScope(ctx.clinicId);
  const existing = await db.patient.findFirst({
    where: { id: patientId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "المريض غير موجود" };

  await db.$transaction(async (tx) => {
    const appointmentIds = await tx.appointment
      .findMany({
        where: { patientId },
        select: { id: true },
      })
      .then((rows) => rows.map((r) => r.id));

    // استهلاك مواد مرتبط بمواعيد المريض بلا patientId لا يحجب حذف المواعيد
    await tx.materialUsage.deleteMany({
      where: { appointmentId: { in: appointmentIds } },
    });
    await tx.materialUsage.deleteMany({ where: { patientId } });
    await tx.instructionSend.deleteMany({ where: { patientId } });
    await tx.ledgerEntry.deleteMany({ where: { patientId } });
    await tx.toothFinding.deleteMany({ where: { patientId } });
    await tx.treatmentPlanItem.deleteMany({ where: { patientId } });
    await tx.waitlistEntry.deleteMany({ where: { patientId } });
    await tx.appointment.deleteMany({ where: { patientId } });
    await tx.patient.delete({ where: { id: patientId } });
  });

  return { ok: true };
}

import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";

// خدمة المرضى — نمط مرجعي لخدمات العيادة: كل استعلام عبر clinicScope
// بمعرّف العيادة من سياق الجلسة، ولا يلمس الـ route handler العميل مباشرة.

export type PatientDto = {
  id: string;
  name: string;
  birthYear: number | null;
  phone: string | null;
  address: string | null;
  medicalNotes: string | null;
};

const PATIENT_SELECT = {
  id: true,
  name: true,
  birthYear: true,
  phone: true,
  address: true,
  medicalNotes: true,
} as const;

export async function listPatients(
  ctx: TenantContext,
  search?: string,
): Promise<PatientDto[]> {
  const db = clinicScope(ctx.clinicId);
  const patients = await db.patient.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {},
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
};

export type UpdatePatientInput = Partial<CreatePatientInput>;

function validateFields(
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
  const phone = typeof b.phone === "string" ? b.phone.trim() : undefined;
  const address =
    typeof b.address === "string" ? b.address.trim() : undefined;
  const medicalNotes =
    typeof b.medicalNotes === "string" ? b.medicalNotes.trim() : undefined;

  return {
    ok: true,
    value: { name, birthYear, phone, address, medicalNotes },
  };
}

// تحقق نقي — يُختبر في وحدة منفصلة عن قاعدة البيانات.
export function parseCreatePatient(
  body: unknown,
): { ok: true; value: CreatePatientInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  return validateFields(body as Record<string, unknown>);
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
    if (
      typeof b.birthYear !== "number" ||
      !Number.isInteger(b.birthYear) ||
      b.birthYear < 1900 ||
      b.birthYear > 2100
    ) {
      return { ok: false, error: "سنة الميلاد غير صالحة" };
    }
    partial.birthYear = b.birthYear;
  }
  if (b.phone !== undefined) {
    if (typeof b.phone !== "string") {
      return { ok: false, error: "رقم الهاتف غير صالح" };
    }
    partial.phone = b.phone.trim();
  }
  if (b.address !== undefined) {
    if (typeof b.address !== "string") {
      return { ok: false, error: "العنوان غير صالح" };
    }
    partial.address = b.address.trim();
  }
  if (b.medicalNotes !== undefined) {
    if (typeof b.medicalNotes !== "string") {
      return { ok: false, error: "الملاحظات الطبية غير صالحة" };
    }
    partial.medicalNotes = b.medicalNotes.trim();
  }

  return { ok: true, value: partial };
}

export async function createPatient(
  ctx: TenantContext,
  input: CreatePatientInput,
): Promise<PatientDto> {
  const db = clinicScope(ctx.clinicId);
  const patient = await db.patient.create({
    // clinicId صريح أيضاً — الحقن الآلي في clinicScope يبقى ضمانة إضافية.
    data: {
      clinicId: ctx.clinicId,
      name: input.name,
      birthYear: input.birthYear,
      phone: input.phone,
      address: input.address,
      medicalNotes: input.medicalNotes,
    },
    select: PATIENT_SELECT,
  });
  return patient;
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

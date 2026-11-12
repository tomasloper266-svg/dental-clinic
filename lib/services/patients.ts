import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";

// خدمة المرضى — نمط مرجعي لخدمات العيادة: كل استعلام عبر clinicScope
// بمعرّف العيادة من سياق الجلسة، ولا يلمس الـ route handler العميل مباشرة.

export type PatientDto = {
  id: string;
  name: string;
  birthYear: number | null;
  phone: string | null;
  medicalNotes: string | null;
};

export async function listPatients(
  ctx: TenantContext,
  search?: string,
): Promise<PatientDto[]> {
  const db = clinicScope(ctx.clinicId);
  const patients = await db.patient.findMany({
    where: search
      ? {
          OR: [{ name: { contains: search } }, { phone: { contains: search } }],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      birthYear: true,
      phone: true,
      medicalNotes: true,
    },
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
    select: {
      id: true,
      name: true,
      birthYear: true,
      phone: true,
      medicalNotes: true,
    },
  });
}

export type CreatePatientInput = {
  name: string;
  birthYear?: number;
  phone?: string;
  medicalNotes?: string;
};

// تحقق نقي — يُختبر في وحدة منفصلة عن قاعدة البيانات.
export function parseCreatePatient(
  body: unknown,
): { ok: true; value: CreatePatientInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;
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
  const medicalNotes =
    typeof b.medicalNotes === "string" ? b.medicalNotes.trim() : undefined;

  return {
    ok: true,
    value: { name, birthYear, phone, medicalNotes },
  };
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
      medicalNotes: input.medicalNotes,
    },
    select: {
      id: true,
      name: true,
      birthYear: true,
      phone: true,
      medicalNotes: true,
    },
  });
  return patient;
}

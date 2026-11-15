import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getPatient } from "@/lib/services/patients";
import { listFindings } from "@/lib/services/findings";
import { listReadings } from "@/lib/services/periodontal";
import { listPlan } from "@/lib/services/treatment-plan";
import { listPatientAppointments } from "@/lib/services/appointments";
import { listLedgerEntries } from "@/lib/services/ledger";
import { listPatientMaterialUsages } from "@/lib/services/inventory";
import { getClinicUsdRate } from "@/lib/services/account";
import PatientRecord from "@/components/patients/record/PatientRecord";

// ملف المريض — أربعة تبويبات (الملف، المواعيد، مخطط الأسنان وخطط العلاج،
// الحساب والسجل المالي). هذه الصفحة تنسيق خادمي فقط: كل البيانات تُقرأ من
// خدمات العيادة المحصورة بالجلسة (findings، الخطة، المواعيد، الدفتر،
// استهلاك المواد) وتُمرَّر لمكوّن العميل الذي ينظّمها في تبويبات.
// لا مسارات جديدة ولا منطق هنا — وعزل clinicScope كما هو.

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const ctx = tenantContextFromSession(session);
  const { patientId } = await params;
  const patient = await getPatient(ctx, patientId);
  if (!patient) notFound();

  const [
    findings,
    readings,
    planItems,
    appointments,
    ledger,
    materialUsages,
    usdRate,
  ] = await Promise.all([
    listFindings(ctx, patientId),
    listReadings(ctx, patientId),
    listPlan(ctx, patientId),
    listPatientAppointments(ctx, patientId),
    listLedgerEntries(ctx, patientId),
    listPatientMaterialUsages(ctx, patientId),
    getClinicUsdRate(ctx),
  ]);

  return (
    <PatientRecord
      patient={patient}
      findings={findings}
      readings={readings}
      planItems={planItems}
      appointments={appointments}
      ledgerEntries={ledger.entries}
      ledgerBalance={ledger.balance}
      materialRows={materialUsages.map((row) => ({
        createdAt: row.createdAt,
        materialName: row.materialName,
        costUsd: row.costUsd ?? 0,
      }))}
      usdRate={usdRate}
    />
  );
}

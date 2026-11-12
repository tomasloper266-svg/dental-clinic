import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getPatient } from "@/lib/services/patients";
import { listFindings } from "@/lib/services/findings";
import { listPlan } from "@/lib/services/treatment-plan";
import { PatientPicker } from "@/components/patients/PatientPicker";
import OdontogramWorkbench from "@/components/odontogram/OdontogramWorkbench";
import { PageHeader } from "@/components/ui/PageHeader";

/**
 * مخطط الأسنان المستقل — منتقي مريض أعلى والرسم التشريحي الكامل تحته.
 * نفس مكوّنات ملف المريض (مصدر واحد، تجربتان): الرسم بالعرض الكامل
 * والحفظ إلحاقي عبر مسارات findings وtreatment-plan القائمة.
 */
export default async function ChartPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const ctx = tenantContextFromSession(session);
  const { patient: patientId } = await searchParams;
  const patient = patientId ? await getPatient(ctx, patientId) : null;
  const [findings, planItems] = patient
    ? await Promise.all([
        listFindings(ctx, patient.id),
        listPlan(ctx, patient.id),
      ])
    : [[], []];

  return (
    <div className="w-full px-4 py-6">
      <PageHeader
        title="مخطط الأسنان"
        description={
          patient
            ? `الرسم التشريحي الكامل للمريض ${patient.name} — القيود المسجلة سجل زمني إلحاقي.`
            : "اختر مريضاً لعرض رسمه التشريحي الكامل — القيود المسجلة سجل زمني إلحاقي."
        }
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <PatientPicker basePath="/chart" selectedPatientId={patient?.id} />
        {patient ? (
          <OdontogramWorkbench
            patientId={patient.id}
            initialFindings={findings}
            initialPlan={planItems}
          />
        ) : (
          <div className="rounded-panel border-warm-300 bg-surface-raised/60 grid min-h-80 place-items-center border border-dashed">
            <p className="text-steel-500 p-8 text-sm">
              اختر مريضاً من القائمة لبدء العمل على مخطط أسنانه — الرسم التشريحي
              يعرض الأسنان الـ32 بأشكالها وحالاتها المسجلة.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

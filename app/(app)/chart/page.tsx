import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getPatient } from "@/lib/services/patients";
import { PatientPicker } from "@/components/patients/PatientPicker";
import { PageHeader } from "@/components/ui/PageHeader";
import { ToothIcon } from "@/components/shell/icons/ToothIcon";

/**
 * مخطط الأسنان المستقل — منتقي مريض أعلى ومسرح الرسم تحته.
 * الموجة 1: الهيكل والمنتقي فقط؛ لوحة الرسم التشريحي تُبنى في الموجة 2.
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
        <div className="grid min-h-80 place-items-center rounded-panel border border-dashed border-warm-300 bg-surface-raised/60">
          {patient ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <ToothIcon size={40} className="text-primary-400" />
              <p className="text-sm font-semibold text-ink-900">
                مساحة الرسم التشريحي — {patient.name}
              </p>
              <p className="max-w-sm text-xs text-steel-500">
                لوحة الأودوغرام التفاعلية تُبنى في الموجة التالية وتحلّ محل
                هذه المساحة — سجل السن وتفاصيله تُقرأ من قيود المريض الحالية.
              </p>
            </div>
          ) : (
            <p className="p-8 text-sm text-steel-500">
              اختر مريضاً من القائمة لبدء العمل على مخطط أسنانه.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

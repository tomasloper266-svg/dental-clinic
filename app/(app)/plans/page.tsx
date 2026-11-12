import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getPatient } from "@/lib/services/patients";
import { PatientPicker } from "@/components/patients/PatientPicker";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClipboardList } from "lucide-react";

/**
 * خطط العلاج المستقلة — منتقي مريض أعلى ولوحة البنود تحته.
 * الموجة 1: الهيكل والمنتقي فقط؛ اللوحة الكانبانية تُبنى في الموجة 4.
 */
export default async function PlansPage({
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
        title="خطط العلاج"
        description={
          patient
            ? `بنود خطة علاج ${patient.name} بحالتها — من التخطيط إلى الموافقة إلى التنفيذ.`
            : "اختر مريضاً لعرض بنود خطته — من التخطيط إلى الموافقة إلى التنفيذ."
        }
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <PatientPicker basePath="/plans" selectedPatientId={patient?.id} />
        <div className="grid min-h-80 place-items-center rounded-panel border border-dashed border-warm-300 bg-surface-raised/60">
          {patient ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <ClipboardList size={40} className="text-primary-400" aria-hidden />
              <p className="text-sm font-semibold text-ink-900">
                لوحة بنود الخطة — {patient.name}
              </p>
              <p className="max-w-sm text-xs text-steel-500">
                اللوحة الكانبانية ببنود الخطة وإجمالياتها تُبنى في موجة لاحقة
                — البنود تُقرأ من قيود خطة المريض الحالية.
              </p>
            </div>
          ) : (
            <p className="p-8 text-sm text-steel-500">
              اختر مريضاً من القائمة لعرض بنود خطته.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

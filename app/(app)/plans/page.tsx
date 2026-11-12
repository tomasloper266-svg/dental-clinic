import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getPatient } from "@/lib/services/patients";
import { listPlan } from "@/lib/services/treatment-plan";
import { PatientPicker } from "@/components/patients/PatientPicker";
import PlansBoard from "@/components/odontogram/PlansBoard";
import { PageHeader } from "@/components/ui/PageHeader";

/**
 * خطط العلاج على مستوى العيادة — منتقي مريض أعلى ولوحة بنود خطة المريض
 * المختار تحته. منظور عرض عبر المنتقي (مغاير لتبويب الخطة داخل ملف
 * المريض الذي يخدم مريضاً واحداً) — نفس خدمات الخطة ومساراتها حصراً:
 * الإجماليات دائمة الظهور، والأعمدة بحسب الحالة، ورقم السن رابط يفتح
 * لوحة السن على مخطط المريض.
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
  const planItems = patient ? await listPlan(ctx, patient.id) : [];

  return (
    <div className="w-full px-4 py-6">
      <PageHeader
        title="خطط العلاج"
        description={
          patient
            ? `بنود خطة ${patient.name} من التخطيط إلى الموافقة إلى التنفيذ — الإجماليات دائم الظهور، ورقم السن ينقل إلى مخططه.`
            : "اختر مريضاً لعرض بنود خطته — من التخطيط إلى الموافقة إلى التنفيذ."
        }
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <PatientPicker basePath="/plans" selectedPatientId={patient?.id} />
        {patient ? (
          <PlansBoard patientId={patient.id} initialItems={planItems} />
        ) : (
          <div className="border-warm-300 bg-surface-raised/60 grid min-h-80 place-items-center rounded-panel border border-dashed">
            <p className="text-steel-500 p-8 text-sm">
              اختر مريضاً من القائمة لعرض بنود خطته على اللوحة — الأعمدة بحسب
              الحالة: مخطط، مقبول، منفَّذ.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

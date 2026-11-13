import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getPatient } from "@/lib/services/patients";
import { listFindings } from "@/lib/services/findings";
import { listPlan } from "@/lib/services/treatment-plan";
import { PatientPicker } from "@/components/patients/PatientPicker";
import OdontogramWorkbench from "@/components/odontogram/OdontogramWorkbench";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { isValidToothFdi } from "@/lib/odontogram/fdi";

/**
 * مخطط الأسنان المستقل — منتقي مريض أعلى والرسم التشريحي الكامل تحته.
 * نفس مكوّنات ملف المريض (مصدر واحد، تجربتان): الرسم بالعرض الكامل
 * والحفظ إلحاقي عبر مسارات findings وtreatment-plan القائمة.
 * ?tooth=<fdi> يفتح لوحة السن مباشرة — ربط بنود الخطط بالمخطط.
 */
export default async function ChartPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string; tooth?: string }>;
}) {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const ctx = tenantContextFromSession(session);
  const { patient: patientId, tooth: toothParam } = await searchParams;
  const patient = patientId ? await getPatient(ctx, patientId) : null;
  const initialTooth =
    toothParam && isValidToothFdi(Number(toothParam)) ? Number(toothParam) : null;
  const [findings, planItems] = patient
    ? await Promise.all([
        listFindings(ctx, patient.id),
        listPlan(ctx, patient.id),
      ])
    : [[], []];

  return (
    <div className={pageWrapClass("full")}>
      <PageHeader
        title="مخطط الأسنان"
        description={
          patient
            ? `الرسم التشريحي الكامل للمريض ${patient.name} — القيود المسجلة سجل زمني إلحاقي.`
            : "اختر مريضاً لعرض رسمه التشريحي الكامل — القيود المسجلة سجل زمني إلحاقي."
        }
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <PatientPicker
          basePath="/chart"
          selectedPatientId={patient?.id}
          className="min-w-0"
        />
        {patient ? (
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>مخطط المريض {patient.name}</CardTitle>
              <p className="numeric text-xs text-warm-500">
                {findings.length} قيد مسجّل · {planItems.length} بند خطة
              </p>
            </CardHeader>
            <CardBody>
              <OdontogramWorkbench
                patientId={patient.id}
                initialFindings={findings}
                initialPlan={planItems}
                initialTooth={initialTooth}
              />
            </CardBody>
          </Card>
        ) : (
          <div className="border-warm-300 bg-surface-raised/60 grid min-h-80 place-items-center rounded-panel border border-dashed">
            <EmptyState
              title="اختر مريضاً للبدء"
              description="اختر مريضاً من القائمة لبدء العمل على مخطط أسنانه — الرسم التشريحي يعرض الأسنان الـ32 بأشكالها وحالاتها المسجلة."
            />
          </div>
        )}
      </div>
    </div>
  );
}

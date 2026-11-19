import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { pageWrapClass } from "@/lib/page-width";
import { getPatient } from "@/lib/services/patients";
import { listFindings } from "@/lib/services/findings";
import { listReadings } from "@/lib/services/periodontal";
import { listPlan, listPlans } from "@/lib/services/treatment-plan";
import { listLedgerEntries } from "@/lib/services/ledger";
import { listStaff } from "@/lib/services/staff";
import { getClinicUsdRate } from "@/lib/services/account";
import DentalPatientSearch from "@/components/dental/DentalPatientSearch";
import DentalChart from "@/components/dental/DentalChart";
import DentalPlanSection from "@/components/dental/DentalPlanSection";
import { EmptyState } from "@/components/ui/EmptyState";

// مخطط الأسنان المستقل — البحث أعلى، المخطط الوطني، ثم بطاقتا الخطة والملخص
// المالي جنباً إلى جنب. كل البيانات من خدمات العيادة المحصورة بالجلسة،
// والمكوّنات نفسها المستخدمة في تبويب الملف — مصدر واحد وتجربتان.
// ?patient=<id> يحدد المريض؛ «فتح الملف الكامل» ينتقل إلى ملفه القائم.

export default async function DentalPage({
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

  const [findings, readings, plans, planItems, ledger, staff, usdRate] = patient
    ? await Promise.all([
        listFindings(ctx, patient.id),
        listReadings(ctx, patient.id),
        listPlans(ctx, patient.id),
        listPlan(ctx, patient.id),
        listLedgerEntries(ctx, patient.id),
        listStaff(ctx),
        getClinicUsdRate(ctx),
      ])
    : [[], [], [], [], null, [], 0];

  const unassignedItems = planItems.filter((item) => !item.planId);

  return (
    <div className={pageWrapClass("full")}>
      <DentalPatientSearch selectedPatientId={patient?.id} className="mb-5" />

      {patient && ledger ? (
        <>
          <DentalChart
            patientId={patient.id}
            initialFindings={findings}
            initialReadings={readings}
            planItems={planItems}
          />

          <div className="mt-6">
            <DentalPlanSection
              patientId={patient.id}
              patientName={patient.name}
              plans={plans}
              unassignedItems={unassignedItems}
              doctors={staff}
              ledger={ledger.entries}
              usdRate={usdRate}
            />
          </div>
        </>
      ) : (
        <div className="border-warm-300 bg-surface-raised/60 rounded-panel grid min-h-80 place-items-center border border-dashed">
          <EmptyState
            title="اختر مريضاً للبدء"
            description="اختر مريضاً من القائمة أعلاه لعرض مخطط أسنانه وخطط العلاج والملخص المالي — البيانات حقيقية من سجلات العيادة."
          />
        </div>
      )}
    </div>
  );
}

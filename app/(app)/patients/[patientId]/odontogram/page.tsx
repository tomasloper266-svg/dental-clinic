import { getServerT } from "@/lib/i18n";
import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getPatient } from "@/lib/services/patients";
import { listFindings } from "@/lib/services/findings";
import { listReadings } from "@/lib/services/periodontal";
import { listPlan } from "@/lib/services/treatment-plan";
import OdontogramWorkbench from "@/components/odontogram/OdontogramWorkbench";
import { PageHeader } from "@/components/ui/PageHeader";

// صفحة أودوغرام مريض وخطة علاجه — قراءة أولية عبر الخدمات المحصورة بالعيادة
// من الجلسة، والتفاعل عبر واجهات /api/patients/[patientId]/findings و/treatment-plan.
export default async function OdontogramPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const t = await getServerT();
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const ctx = tenantContextFromSession(session);
  const { patientId } = await params;
  const patient = await getPatient(ctx, patientId);
  if (!patient) notFound();

  const [findings, planItems, readings] = await Promise.all([
    listFindings(ctx, patientId),
    listPlan(ctx, patientId),
    listReadings(ctx, patientId),
  ]);

  return (
    <div className={pageWrapClass("full")}>
      <PageHeader
        title={t("dental.odontogramTitle", { name: patient.name })}
        description={t("odontogram.findingsTimelineHint")}
        actions={
          <Link
            href={`/patients/${patientId}`}
            className="border-warm-300 bg-surface-raised text-ink-900 hover:bg-surface-hover active:bg-surface-sunken rounded-field focus-visible:outline-primary-500 inline-flex h-10 items-center border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t("patients.file")}
          </Link>
        }
      />
      <div className="mt-5">
        <OdontogramWorkbench
          patientId={patientId}
          initialFindings={findings}
          initialReadings={readings}
          initialPlan={planItems}
        />
      </div>
    </div>
  );
}

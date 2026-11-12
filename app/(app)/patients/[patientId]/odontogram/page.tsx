import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getPatient } from "@/lib/services/patients";
import { listFindings } from "@/lib/services/findings";
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
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const ctx = tenantContextFromSession(session);
  const { patientId } = await params;
  const patient = await getPatient(ctx, patientId);
  if (!patient) notFound();

  const [findings, planItems] = await Promise.all([
    listFindings(ctx, patientId),
    listPlan(ctx, patientId),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <PageHeader
        title={`أودوغرام — ${patient.name}`}
        description="المشاهدات المسجلة تُحفظ كسجل زمني ولا تُستبدل بخطة العلاج. اختيار السن على المخطط يعبّئ بند الخطة الجديد."
        actions={
          <Link
            href={`/patients/${patientId}`}
            className="border-warm-300 bg-surface-raised text-ink-900 hover:bg-surface-hover active:bg-surface-sunken inline-flex h-10 items-center rounded-field border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            ملف المريض
          </Link>
        }
      />
      <div className="mt-5">
        <OdontogramWorkbench
          patientId={patientId}
          initialFindings={findings}
          initialPlan={planItems}
        />
      </div>
    </div>
  );
}

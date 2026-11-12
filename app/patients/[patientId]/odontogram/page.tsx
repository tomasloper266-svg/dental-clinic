import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getPatient } from "@/lib/services/patients";
import { listFindings } from "@/lib/services/findings";
import OdontogramBoard from "@/components/odontogram/OdontogramBoard";

// صفحة أودوغرام مريض — قراءة أولية عبر الخدمات المحصورة بالعيادة من الجلسة،
// والتفاعل يحدث عبر واجهات /api/patients/[patientId]/findings.
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

  const findings = await listFindings(ctx, patientId);

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-teal-800">
          أودوغرام — {patient.name}
        </h1>
        <p className="text-xs text-gray-500">
          المشاهدات المسجلة تُحفظ كسجل زمني ولا تُستبدل بخطة العلاج.
        </p>
      </header>
      <OdontogramBoard patientId={patientId} initialFindings={findings} />
    </main>
  );
}

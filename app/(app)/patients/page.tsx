import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { listPatients } from "@/lib/services/patients";
import { listAppointments } from "@/lib/services/appointments";
import { listClinicLedgerEntries } from "@/lib/services/ledger";
import { dayStart, addDays } from "@/lib/dates";
import { buildPatientRows } from "@/lib/patients-view";
import PatientsView from "@/components/patients/PatientsView";

// شاشة المرضى — الهيكل المرجعي: كل البيانات تُقرأ من خدمات العيادة القائمة
// حصراً في الصفحة الخادمية (المرضى، الدفتر للأرصدة، المواعيد للزيارات)،
// ثم تُبنى الصفوف نقياً وتُمرَّر للعرض الزبوني للبحث والتصفية والترتيب.
export default async function PatientsPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const ctx = tenantContextFromSession(session);
  const now = new Date();
  // نافذة سنة للماضي وللسنة القادمة — أعمدة «آخر زيارة» و«موعد قادم».
  const windowStart = addDays(dayStart(now), -365);
  const windowEnd = addDays(dayStart(now), 366);

  const [patients, clinicEntries, appointments] = await Promise.all([
    listPatients(ctx),
    listClinicLedgerEntries(ctx, { limit: 1000 }),
    listAppointments(ctx, windowStart, windowEnd),
  ]);

  const rows = buildPatientRows(patients, clinicEntries, appointments, now);

  return (
    <div className={pageWrapClass("full")}>
      <PatientsView rows={rows} />
    </div>
  );
}

import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CalendarDays,
  Phone,
  MapPin,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getPatient } from "@/lib/services/patients";
import { listFindings } from "@/lib/services/findings";
import { listPlan } from "@/lib/services/treatment-plan";
import { listPatientAppointments } from "@/lib/services/appointments";
import { parseMedicalNotes } from "@/lib/medical-notes";
import { ageFromBirthYear } from "@/lib/patients-view";
import { planByTooth, planTotals } from "@/lib/treatment-plan-view";
import { splitAppointments } from "@/lib/patient-profile";
import { toothStatusMeta } from "@/lib/odontogram/statuses";
import { latestFindingByTooth } from "@/lib/odontogram/findings-view";
import { formatSyp } from "@/lib/utils";
import {
  STATUS_META as APPT_STATUS_META,
  formatDayLabel,
  formatTime,
} from "@/lib/appointment-ui";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import PatientEditModal from "@/components/patients/PatientEditModal";

// ملف المريض العام — تسلسل بصري مقصود: بيانات أساسية ثم الملاحظات الطبية
// (الأخطر سريرياً أعلى الصفحة) ثم خطة العلاج ثم المواعيد. كل البيانات من
// خدمات العيادة المحصورة بالجلسة، والتحرير عبر نفس نموذج صفحة المرضى.

const dateFmt = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  dateStyle: "medium",
});

function InfoCell({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-warm-700">
      <Icon size={15} aria-hidden className="text-warm-400" />
      {children}
    </span>
  );
}

function NoteSection({
  title,
  value,
  tone = "plain",
}: {
  title: string;
  value: string;
  tone?: "plain" | "danger";
}) {
  return (
    <div className="min-w-0">
      <p
        className={`text-xs font-semibold ${tone === "danger" ? "text-danger-700" : "text-warm-600"}`}
      >
        {title}
      </p>
      <p className="text-ink-900 mt-1 text-sm leading-6 whitespace-pre-line">
        {value}
      </p>
    </div>
  );
}

export default async function PatientProfilePage({
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

  const now = new Date();
  const [findings, planItems, appointments] = await Promise.all([
    listFindings(ctx, patientId),
    listPlan(ctx, patientId),
    listPatientAppointments(ctx, patientId),
  ]);

  const notes = parseMedicalNotes(patient.medicalNotes);
  const hasNotes = Boolean(
    notes.allergies || notes.conditions || notes.medications || notes.other,
  );

  const totals = planTotals(planItems);
  const planRows = planByTooth(planItems);

  const { upcoming, past } = splitAppointments(appointments, now);

  // ملخص الأودوغرام: الحالة الأخيرة لكل سن — والمعتبر بحدث ما دون السليم فقط
  const latest = latestFindingByTooth(findings);
  const noteworthy = [...latest.values()].filter((f) => f.status !== "HEALTHY");

  return (
    <div className={pageWrapClass("full")}>
      {/* ─── بيانات أساسية ─────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <h1 className="text-ink-900 text-2xl font-semibold">{patient.name}</h1>
            <div className="text-warm-700 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <InfoCell icon={Stethoscope}>
                {ageFromBirthYear(patient.birthYear) !== null ? (
                  <>
                    <span className="numeric">{ageFromBirthYear(patient.birthYear)}</span> سنة
                    {patient.birthYear !== null && (
                      <span className="text-warm-400 text-xs">
                        (و.م <span className="numeric">{patient.birthYear}</span>)
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-warm-400">العمر غير مسجل</span>
                )}
              </InfoCell>
              <InfoCell icon={Phone}>
                {patient.phone ? (
                  <span dir="ltr" className="numeric">
                    {patient.phone}
                  </span>
                ) : (
                  <span className="text-warm-400">لا هاتف مسجل</span>
                )}
              </InfoCell>
              {patient.address && (
                <InfoCell icon={MapPin}>{patient.address}</InfoCell>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PatientEditModal patient={patient} />
            <Link
              href={`/patients/${patient.id}/odontogram`}
              className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 inline-flex h-10 items-center gap-2 rounded-field border border-transparent px-4 text-sm font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            >
              الأودوغرام وخطة العلاج
            </Link>
          </div>
        </div>
      </Card>

      {/* ─── الملاحظات الطبية — بانر الحساسية أولًا إن وُجدت ────────── */}
      {notes.allergies && (
        <div
          role="alert"
          className="border-danger-300 bg-danger-50 text-danger-700 mt-4 flex items-start gap-2 rounded-panel border px-4 py-3 text-sm"
        >
          <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
          <p>
            <span className="font-semibold">حساسية:</span>{" "}
            <span className="whitespace-pre-line">{notes.allergies}</span>
          </p>
        </div>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>الملاحظات الطبية</CardTitle>
        </CardHeader>
        {hasNotes ? (
          <div className="grid gap-5 p-5 sm:grid-cols-3">
            <NoteSection title="حساسية" value={notes.allergies} tone="danger" />
            <NoteSection title="أمراض مزمنة" value={notes.conditions} />
            <NoteSection title="أدوية حالية" value={notes.medications} />
            {notes.other && (
              <div className="sm:col-span-3">
                <NoteSection title="ملاحظات أخرى" value={notes.other} />
              </div>
            )}
          </div>
        ) : (
          <p className="text-warm-500 p-5 text-sm">
            لا ملاحظات طبية مسجلة — تُدخل من «تحرير البيانات».
          </p>
        )}
      </Card>

      {/* ─── الخطة (عريضة) والمواعيد (جانبية) ──────────────────────── */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <section className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex items-center justify-between gap-2">
              <CardTitle>خطة العلاج</CardTitle>
              <Link
                href={`/patients/${patient.id}/odontogram`}
                className="text-primary-700 hover:text-primary-800 text-xs font-medium hover:underline"
              >
                إدارة الخطة على الأودوغرام ←
              </Link>
            </CardHeader>

            {planItems.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="لا بنود علاج مسجلة"
                  description="تُضاف بنود الخطة المسعّرة من صفحة الأودوغرام باختيار سن ثم إدخال الإجراء وسعره."
                  action={
                    <Link
                      href={`/patients/${patient.id}/odontogram`}
                      className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 inline-flex h-8 items-center rounded-field px-3 text-xs font-medium text-white transition-colors"
                    >
                      افتح الأودوغرام
                    </Link>
                  }
                  className="border-0 bg-transparent py-6"
                />
              </div>
            ) : (
              <>
                {/* شريط الإجماليات: مقبول/منفذ/الإجمالي العام */}
                <div className="grid grid-cols-2 gap-3 px-5 pt-4 sm:grid-cols-3">
                  {(["PROPOSED", "ACCEPTED", "DONE"] as const).map((status) => {
                    const summary = totals.byStatus[status];
                    const labels = {
                      PROPOSED: "مخطط",
                      ACCEPTED: "مقبول",
                      DONE: "منفذ",
                    } as const;
                    return (
                      <div
                        key={status}
                        className="border-warm-200 bg-surface rounded-panel border px-4 py-3"
                      >
                        <span className="text-warm-500 text-xs">{labels[status]}</span>
                        <p className="text-ink-900 numeric text-lg font-semibold">
                          {formatSyp(summary.total)}
                        </p>
                        <span className="text-warm-400 numeric text-xs">
                          {summary.count} بند
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="border-warm-200 bg-primary-50 border-primary-200 mx-5 mt-3 flex items-center justify-between rounded-panel border px-4 py-3">
                  <span className="text-primary-800 text-sm font-medium">
                    إجمالي الخطة
                  </span>
                  <span className="numeric text-primary-800 text-lg font-semibold">
                    {formatSyp(totals.grandTotal)}
                  </span>
                </div>

                <div className="p-5 pt-4">
                  <Table>
                    <THead>
                      <TRow>
                        <TH className="w-16">السن</TH>
                        <TH>الإجراء</TH>
                        <TH>السعر</TH>
                        <TH>الحالة</TH>
                      </TRow>
                    </THead>
                    <tbody>
                      {planRows.map((item) => {
                        const statusMeta = {
                          PROPOSED: { label: "مخطط", tone: "neutral" as const },
                          ACCEPTED: { label: "مقبول", tone: "info" as const },
                          DONE: { label: "منفذ", tone: "success" as const },
                        }[item.status];
                        return (
                          <TRow key={item.id}>
                            <TD>
                              <span className="numeric border-primary-200 bg-primary-50 text-primary-800 inline-flex items-center justify-center rounded border px-2 py-0.5 text-xs font-bold">
                                {item.toothFdi}
                              </span>
                            </TD>
                            <TD className="max-w-48 truncate">{item.procedure}</TD>
                            <TD className="numeric whitespace-nowrap">
                              {formatSyp(item.priceSyp)}
                            </TD>
                            <TD>
                              <Badge tone={statusMeta.tone}>
                                {statusMeta.label}
                              </Badge>
                            </TD>
                          </TRow>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              </>
            )}
          </Card>

          {/* ملخص الأودوغرام — الأسنان ذات حالة بحدث ما */}
          <Card>
            <CardHeader>
              <CardTitle>مخطط الأسنان (FDI)</CardTitle>
            </CardHeader>
            {noteworthy.length === 0 ? (
              <p className="text-warm-500 p-5 text-sm">
                لا مشاهدات مسجلة على الأسنان بعد — تُقيَّد من صفحة الأودوغرام.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 p-5">
                {noteworthy.slice(0, 8).map((finding) => {
                  const meta = toothStatusMeta(finding.status);
                  return (
                    <Badge key={finding.id} tone="neutral">
                      <span className="text-warm-400 numeric text-[10px]">
                        {finding.toothFdi}
                      </span>
                      {meta ? `${meta.icon} ${meta.labelAr}` : finding.status}
                    </Badge>
                  );
                })}
                {noteworthy.length > 8 && (
                  <span className="text-warm-500 text-xs">
                    + <span className="numeric">{noteworthy.length - 8}</span> أسنان أخرى —
                    التفاصيل في الأودوغرام
                  </span>
                )}
              </div>
            )}
          </Card>
        </section>

        {/* ─── المواعيد ─────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays size={16} aria-hidden className="text-warm-400" />
                المواعيد القادمة
              </CardTitle>
            </CardHeader>
            {upcoming.length === 0 ? (
              <p className="text-warm-500 p-5 text-sm">لا مواعيد قادمة.</p>
            ) : (
              <ul className="divide-warm-200 divide-y">
                {upcoming.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-ink-900 text-sm font-medium">
                        {formatDayLabel(a.startsAt)}
                      </p>
                      <p className="text-warm-500 numeric text-xs">
                        {formatTime(a.startsAt)} · {a.durationMin} دقيقة
                      </p>
                      {a.reason && (
                        <p className="text-warm-600 mt-0.5 truncate text-xs">{a.reason}</p>
                      )}
                    </div>
                    <span
                      className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${APPT_STATUS_META[a.status].chip}`}
                    >
                      {APPT_STATUS_META[a.status].label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الزيارات السابقة</CardTitle>
            </CardHeader>
            {past.length === 0 ? (
              <p className="text-warm-500 p-5 text-sm">لا زيارات سابقة.</p>
            ) : (
              <ul className="divide-warm-200 divide-y">
                {past.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-ink-900 text-sm font-medium">
                        {dateFmt.format(new Date(a.startsAt))}
                      </p>
                      {a.reason && (
                        <p className="text-warm-600 mt-0.5 truncate text-xs">{a.reason}</p>
                      )}
                    </div>
                    <span
                      className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${APPT_STATUS_META[a.status].chip}`}
                    >
                      {APPT_STATUS_META[a.status].label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

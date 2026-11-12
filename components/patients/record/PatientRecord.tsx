"use client";

import { useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Plus,
  ReceiptText,
  Smile,
  Stethoscope,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import type { PatientDto } from "@/lib/services/patients";
import type { FindingDto } from "@/lib/services/findings";
import type { PlanItemDto } from "@/lib/services/treatment-plan";
import type { AppointmentDto } from "@/lib/services/appointments";
import type { LedgerEntryDto } from "@/lib/services/ledger";
import { ageFromBirthYear } from "@/lib/patients-view";
import { parseMedicalNotes } from "@/lib/medical-notes";
import { splitAppointments } from "@/lib/patient-profile";
import OdontogramBoard from "@/components/odontogram/OdontogramBoard";
import TreatmentPlanSection from "@/components/odontogram/TreatmentPlanSection";
import PatientEditModal from "@/components/patients/PatientEditModal";
import OverviewTab from "./OverviewTab";
import AppointmentsTab from "./AppointmentsTab";
import LedgerTab from "./LedgerTab";
import NewAppointmentModal from "./NewAppointmentModal";
import NewLedgerEntryModal from "./NewLedgerEntryModal";
import { cn } from "@/components/ui/cn";

// ملف المريض المتكامل — وحدة عمل سريرية بخمسة تبويبات: نظرة عامة، مخطط
// الأسنان، خطط العلاج، المواعيد، الحسابات. رأس الملف ثابت أعلى الصفحة
// (بانر الحساسية بـ role=alert وأزرار الإجراءات). اختيار السن مشترك بين
// تبويبَي الأودوغرام والخطة: نقر سن في الرسم يعبّئ بند الخطة الجديد،
// وزر السن في الخطة أو الدفتر يفتح السن على الرسم. كل ميزة من الملف
// السابق محفوظة — التبويبات تنظّمها ولا تحذف شيئاً.

export type RecordTab =
  | "overview"
  | "chart"
  | "plans"
  | "appointments"
  | "ledger";

const TABS: ReadonlyArray<{
  key: RecordTab;
  label: string;
  icon: React.ElementType;
}> = [
  { key: "overview", label: "نظرة عامة", icon: Stethoscope },
  { key: "chart", label: "مخطط الأسنان", icon: Smile },
  { key: "plans", label: "خطط العلاج", icon: ClipboardList },
  { key: "appointments", label: "المواعيد", icon: CalendarDays },
  { key: "ledger", label: "الحسابات", icon: Wallet },
];

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

type Props = {
  patient: PatientDto;
  findings: FindingDto[];
  planItems: PlanItemDto[];
  appointments: AppointmentDto[];
  ledgerEntries: LedgerEntryDto[];
  ledgerBalance: number;
};

export default function PatientRecord({
  patient,
  findings,
  planItems,
  appointments,
  ledgerEntries,
  ledgerBalance,
}: Props) {
  const [tab, setTab] = useState<RecordTab>("overview");
  // اختيار السن مشترك بين تبويبَي الأودوغرام والخطة (ورابط الدفتر السني).
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [apptOpen, setApptOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  const { upcoming } = splitAppointments(appointments, new Date());
  const notes = parseMedicalNotes(patient.medicalNotes);

  function focusTooth(fdi: number) {
    setSelectedTooth(fdi);
    setTab("chart");
  }

  const actionButtonClass =
    "inline-flex h-10 items-center gap-2 rounded-field border border-transparent px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <div className="w-full">
      {/* ─── رأس الملف الثابت: بيانات + إجراءات + تبويبات ────────────── */}
      <header className="border-warm-200 bg-surface/95 sticky top-0 z-30 border-b px-4 py-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-ink-900 text-2xl font-semibold">
              {patient.name}
            </h1>
            <div className="text-warm-700 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <InfoCell icon={Stethoscope}>
                {ageFromBirthYear(patient.birthYear) !== null ? (
                  <>
                    <span className="numeric">
                      {ageFromBirthYear(patient.birthYear)}
                    </span>{" "}
                    سنة
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
              <InfoCell icon={CalendarDays}>
                {patient.phone ? (
                  <span dir="ltr" className="numeric">
                    {patient.phone}
                  </span>
                ) : (
                  <span className="text-warm-400">لا هاتف مسجل</span>
                )}
              </InfoCell>
              {patient.address && (
                <InfoCell icon={ReceiptText}>{patient.address}</InfoCell>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PatientEditModal patient={patient} />
            <button
              type="button"
              onClick={() => setApptOpen(true)}
              className={cn(
                actionButtonClass,
                "border-primary-200 bg-primary-50 text-primary-800 hover:bg-primary-100 focus-visible:outline-primary-500",
              )}
            >
              <CalendarPlus size={16} aria-hidden />
              موعد جديد
            </button>
            <button
              type="button"
              onClick={() => setLedgerOpen(true)}
              className={cn(
                actionButtonClass,
                "border-primary-200 bg-primary-50 text-primary-800 hover:bg-primary-100 focus-visible:outline-primary-500",
              )}
            >
              <Plus size={16} aria-hidden />
              قيد جديد
            </button>
          </div>
        </div>

        {/* بانر الحساسية — دائم الظهور أعلى الملف إن وُجدت */}
        {notes.allergies && (
          <div
            role="alert"
            className="border-danger-300 bg-danger-50 text-danger-700 mt-3 flex items-start gap-2 rounded-panel border px-4 py-2.5 text-sm"
          >
            <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
            <p>
              <span className="font-semibold">حساسية:</span>{" "}
              <span className="whitespace-pre-line">{notes.allergies}</span>
            </p>
          </div>
        )}

        {/* شريط التبويبات */}
        <nav aria-label="أقسام ملف المريض" className="mt-3">
          <div
            role="tablist"
            aria-label="تبويبات ملف المريض"
            className="flex gap-1 overflow-x-auto"
          >
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`patient-tab-${key}`}
                  aria-selected={active}
                  aria-controls={`patient-panel-${key}`}
                  onClick={() => setTab(key)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-field px-3 py-2 text-sm font-medium transition-colors",
                    "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
                    active
                      ? "bg-primary-600 text-white"
                      : "text-warm-600 hover:bg-surface-hover hover:text-ink-900",
                  )}
                >
                  <Icon size={15} aria-hidden />
                  {label}
                  {key === "appointments" && upcoming.length > 0 && (
                    <span
                      className={cn(
                        "numeric ms-0.5 rounded-full px-1.5 text-[11px] font-semibold",
                        active
                          ? "bg-white/20"
                          : "bg-primary-100 text-primary-800",
                      )}
                    >
                      {upcoming.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* ─── اللوحات — كلها مركّبة والمخفية بـ hidden حتى لا يفقد تبويب
           الأودوغرام قيوده المحلية عند التنقل بين التبويبات ──────────── */}
      <div className="px-4 py-6">
        <div
          role="tabpanel"
          id="patient-panel-overview"
          aria-labelledby="patient-tab-overview"
          hidden={tab !== "overview"}
        >
          <OverviewTab
            medicalNotes={patient.medicalNotes}
            planItems={planItems}
            appointments={appointments}
            onOpenPlans={() => setTab("plans")}
            onOpenAppointments={() => setTab("appointments")}
          />
        </div>

        <div
          role="tabpanel"
          id="patient-panel-chart"
          aria-labelledby="patient-tab-chart"
          hidden={tab !== "chart"}
        >
          <OdontogramBoard
            patientId={patient.id}
            initialFindings={findings}
            selectedTooth={selectedTooth}
            onSelectTooth={setSelectedTooth}
          />
        </div>

        <div
          role="tabpanel"
          id="patient-panel-plans"
          aria-labelledby="patient-tab-plans"
          hidden={tab !== "plans"}
        >
          <TreatmentPlanSection
            patientId={patient.id}
            initialItems={planItems}
            preselectedTooth={selectedTooth}
            onFocusTooth={focusTooth}
          />
        </div>

        <div
          role="tabpanel"
          id="patient-panel-appointments"
          aria-labelledby="patient-tab-appointments"
          hidden={tab !== "appointments"}
        >
          <AppointmentsTab
            appointments={appointments}
            onNewAppointment={() => setApptOpen(true)}
          />
        </div>

        <div
          role="tabpanel"
          id="patient-panel-ledger"
          aria-labelledby="patient-tab-ledger"
          hidden={tab !== "ledger"}
        >
          <LedgerTab
            entries={ledgerEntries}
            balance={ledgerBalance}
            planItems={planItems}
            onNewEntry={() => setLedgerOpen(true)}
            onFocusTooth={focusTooth}
          />
        </div>

        <p className="text-warm-400 mt-6 text-center text-xs">
          الرسم التشريحي الكامل بمنتقي المرضى على صفحة{" "}
          <Link
            href="/chart"
            className="text-primary-700 hover:text-primary-800 hover:underline"
          >
            مخطط الأسنان
          </Link>{" "}
          — ولوحة بنود كل المرضى على{" "}
          <Link
            href="/plans"
            className="text-primary-700 hover:text-primary-800 hover:underline"
          >
            خطط العلاج
          </Link>
          .
        </p>
      </div>

      <NewAppointmentModal
        open={apptOpen}
        onClose={() => setApptOpen(false)}
        patientId={patient.id}
      />
      <NewLedgerEntryModal
        open={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        patientId={patient.id}
        planItems={planItems}
      />
    </div>
  );
}

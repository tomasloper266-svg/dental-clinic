"use client";

import { useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  FileText,
  HeartPulse,
  PackageSearch,
  Plus,
  Smile,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import type { PatientDto } from "@/lib/services/patients";
import type { FindingDto } from "@/lib/services/findings";
import type { PeriodontalReadingDto } from "@/lib/services/periodontal";
import type { PlanItemDto } from "@/lib/services/treatment-plan";
import type { AppointmentDto } from "@/lib/services/appointments";
import type { LedgerEntryDto } from "@/lib/services/ledger";
import { ageFromBirthYear, genderLabel } from "@/lib/patients-view";
import { parseMedicalNotes } from "@/lib/medical-notes";
import { summarizePatientLedger } from "@/lib/ledger-view";
import { summarizePeriodontal } from "@/lib/odontogram/periodontal-view";
import { firstLetter } from "@/components/ui/EntityCell";
import OdontogramBoard from "@/components/odontogram/OdontogramBoard";
import TreatmentPlanSection from "@/components/odontogram/TreatmentPlanSection";
import OverviewTab from "./OverviewTab";
import AppointmentsTab from "./AppointmentsTab";
import LedgerTab from "./LedgerTab";
import NewAppointmentModal from "./NewAppointmentModal";
import NewLedgerEntryModal from "./NewLedgerEntryModal";
import { PageHeader, HeaderDivider } from "@/components/ui/PageHeader";
import { DualAmount } from "@/components/ui/DualAmount";
import { cn } from "@/components/ui/cn";

// ملف المريض — أربعة تبويبات كالمرجع: الملف، المواعيد، مخطط الأسنان
// وخطط العلاج (الرسم والخطة معاً في تبويب واحد)، والحساب والسجل المالي.
// رأس الملف: أفاتار + اسم + بيانات، تحته شريط التنبيهات والملخص المالي،
// ثم الإجراءات الثلاثة: موعد جديد، سجل عملية، مريض جديد.

export type RecordTab = "overview" | "appointments" | "chart" | "ledger";

function WarningPill({
  icon: Icon,
  children,
  tone,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  tone: "danger" | "warning";
}) {
  const classes =
    tone === "danger"
      ? "border-danger-300 bg-danger-50 text-danger-700"
      : "border-warning-300 bg-warning-50 text-warning-700";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        classes,
      )}
    >
      <Icon size={12} aria-hidden />
      {children}
    </span>
  );
}

function InfoCell({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <span className="text-warm-700 inline-flex items-center gap-1.5 text-sm">
      <Icon size={15} aria-hidden className="text-warm-400" />
      {children}
    </span>
  );
}

type Props = {
  patient: PatientDto;
  findings: FindingDto[];
  /** قراءات الدواعم الأولية — للوحتها في تبويب الرسم وللملخص في تبويب الملف */
  readings: PeriodontalReadingDto[];
  planItems: PlanItemDto[];
  appointments: AppointmentDto[];
  ledgerEntries: LedgerEntryDto[];
  ledgerBalance: number;
  /** صفوف استهلاك المواد (المخزون) على هذا المريض — لتنبيه المخزون وللدفتر */
  materialRows: ReadonlyArray<{
    createdAt: Date | string;
    materialName: string;
    costUsd: number;
  }>;
  /** سعر صرف الدولار من إعدادات العيادة — لعرض العملة المزدوجة */
  usdRate: number;
};

export default function PatientRecord({
  patient,
  findings,
  readings,
  planItems,
  appointments,
  ledgerEntries,
  ledgerBalance,
  materialRows,
  usdRate,
}: Props) {
  const [tab, setTab] = useState<RecordTab>("overview");
  // اختيار السن مشترك بين الرسم وخطة العلاج في التبويب نفسه.
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [apptOpen, setApptOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  const notes = parseMedicalNotes(patient.medicalNotes);
  const summary = summarizePatientLedger(ledgerEntries, ledgerBalance);
  const dueUsd = Math.max(ledgerBalance, 0);
  const allergies = patient.allergies ?? notes.allergies;
  const chronic = patient.chronicDiseases ?? notes.conditions;

  const TABS: ReadonlyArray<{
    key: RecordTab;
    label: string;
    icon: React.ElementType;
    count?: number;
  }> = [
    { key: "overview", label: "الملف", icon: FileText },
    {
      key: "appointments",
      label: "المواعيد",
      icon: CalendarDays,
      count: appointments.length,
    },
    {
      key: "chart",
      label: "مخطط الأسنان وخطط العلاج",
      icon: Smile,
      count: planItems.length,
    },
    { key: "ledger", label: "الحساب والسجل المالي", icon: ClipboardList },
  ];

  const actionButtonClass =
    "inline-flex h-10 items-center gap-2 rounded-field border border-transparent px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <div className="w-full">
      <div className="px-4 pt-6">
        <PageHeader
          title={patient.name}
          leading={
            <span
              aria-hidden
              className="bg-primary-500/10 text-primary-700 grid size-14 shrink-0 place-items-center rounded-full text-xl font-bold"
            >
              {firstLetter(patient.name)}
            </span>
          }
          description={
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <InfoCell icon={UserPlus}>
                {genderLabel(patient.gender) || "—"}
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
              {patient.secondaryPhone && (
                <InfoCell icon={CalendarDays}>
                  <span dir="ltr" className="numeric">
                    {patient.secondaryPhone}
                  </span>
                </InfoCell>
              )}
              {patient.birthYear !== null && (
                <InfoCell icon={HeartPulse}>
                  <span className="numeric">{patient.birthYear}</span>
                  {ageFromBirthYear(patient.birthYear) !== null && (
                    <span className="text-warm-400 text-xs">
                      (
                      <span className="numeric">
                        {ageFromBirthYear(patient.birthYear)}
                      </span>{" "}
                      سنة)
                    </span>
                  )}
                </InfoCell>
              )}
              {patient.address && (
                <InfoCell icon={Smile}>{patient.address}</InfoCell>
              )}
              {patient.fileNo !== null && (
                <InfoCell icon={ClipboardList}>
                  <span className="numeric">رقم {patient.fileNo}</span>
                </InfoCell>
              )}
            </span>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setApptOpen(true)}
                className={cn(
                  actionButtonClass,
                  "bg-primary-600 hover:bg-primary-700 focus-visible:outline-primary-500 text-white",
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
                سجل عملية
              </button>
              <Link
                href="/patients?create=1"
                className={cn(
                  actionButtonClass,
                  "border-primary-200 bg-primary-50 text-primary-800 hover:bg-primary-100 focus-visible:outline-primary-500",
                )}
              >
                <UserPlus size={16} aria-hidden />
                مريض جديد
              </Link>
            </div>
          }
        />

        {/* شريط التنبيهات والملخص المالي — تنبيهات يميناً (تنبيه مستحق،
            تنبيه مخزون، الحساسيات والأمراض) والملخص يساراً */}
        <div className="rounded-panel border-warm-200 bg-surface-raised flex flex-wrap items-center justify-between gap-3 border px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {dueUsd > 0 && (
              <WarningPill icon={TriangleAlert} tone="danger">
                تنبيه مستحق
              </WarningPill>
            )}
            {materialRows.length > 0 && (
              <WarningPill icon={PackageSearch} tone="warning">
                تنبيه مخزون
              </WarningPill>
            )}
            {allergies && (
              <WarningPill icon={TriangleAlert} tone="danger">
                {allergies}
              </WarningPill>
            )}
            {chronic && (
              <WarningPill icon={HeartPulse} tone="warning">
                {chronic}
              </WarningPill>
            )}
            {dueUsd === 0 &&
              materialRows.length === 0 &&
              !allergies &&
              !chronic && (
                <span className="text-warm-400 text-xs">لا تنبيهات</span>
              )}
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-warm-500 text-[11px] font-medium">مستحق</p>
              <DualAmount
                usd={summary.balanceUsd}
                usdRate={usdRate}
                tone={dueUsd > 0 ? "danger" : "default"}
              />
            </div>
            <div>
              <p className="text-warm-500 text-[11px] font-medium">
                إجمالي المدفوع
              </p>
              {/* دفعات الدفتر وحدها — الخصومات ليست دفعات ولذا تُعرض ببطاقة
                  منفصلة بدل خلطها هنا تحت عنوان المدفوع (سجل art_yHnC9AAM بند 14ب) */}
              <DualAmount usd={summary.paymentsUsd} usdRate={usdRate} />
            </div>
            {summary.discountUsd > 0 && (
              <div>
                <p className="text-warm-500 text-[11px] font-medium">
                  الخصومات
                </p>
                <DualAmount usd={summary.discountUsd} usdRate={usdRate} />
              </div>
            )}
            <div className="flex items-center gap-1.5">
              {dueUsd > 0 ? (
                <>
                  <TriangleAlert
                    size={14}
                    aria-hidden
                    className="text-danger-600"
                  />
                  <span className="text-danger-600 text-sm font-semibold">
                    مستحق
                  </span>
                </>
              ) : (
                <>
                  <span
                    aria-hidden
                    className="bg-primary-600 grid size-4 place-items-center rounded-full text-[10px] text-white"
                  >
                    ✓
                  </span>
                  <span className="text-primary-700 text-sm font-semibold">
                    مسدد
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <HeaderDivider className="mt-4" />

        {/* شريط التبويبات */}
        <nav aria-label="أقسام ملف المريض" className="mt-3">
          <div
            role="tablist"
            aria-label="تبويبات ملف المريض"
            className="flex gap-1 overflow-x-auto"
          >
            {TABS.map(({ key, label, icon: Icon, count }) => {
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
                    "rounded-field inline-flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                    "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
                    active
                      ? "bg-primary-600 text-white"
                      : "text-warm-600 hover:bg-surface-hover hover:text-ink-900",
                  )}
                >
                  <Icon size={15} aria-hidden />
                  {label}
                  {count !== undefined && count > 0 && (
                    <span
                      className={cn(
                        "numeric ms-0.5 rounded-full px-1.5 text-[11px] font-semibold",
                        active
                          ? "bg-white/20"
                          : "bg-primary-100 text-primary-800",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* ─── اللوحات — كلها مركّبة والمخفية بـ hidden حتى لا يفقد تبويب
           الرسم قيوده المحلية عند التنقل بين التبويبات ──────────── */}
      <div className="px-4 py-6">
        <div
          role="tabpanel"
          id="patient-panel-overview"
          aria-labelledby="patient-tab-overview"
          hidden={tab !== "overview"}
        >
          <OverviewTab
            patient={patient}
            periodontal={summarizePeriodontal(readings)}
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
          id="patient-panel-chart"
          aria-labelledby="patient-tab-chart"
          hidden={tab !== "chart"}
        >
          <div className="space-y-4">
            <OdontogramBoard
              patientId={patient.id}
              initialFindings={findings}
              initialReadings={readings}
              selectedTooth={selectedTooth}
              onSelectTooth={setSelectedTooth}
            />
            <TreatmentPlanSection
              patientId={patient.id}
              initialItems={planItems}
              preselectedTooth={selectedTooth}
              onFocusTooth={setSelectedTooth}
            />
          </div>
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
            usdRate={usdRate}
            materialRows={materialRows}
            onNewEntry={() => setLedgerOpen(true)}
          />
        </div>
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
        initialType="CHARGE"
      />
    </div>
  );
}

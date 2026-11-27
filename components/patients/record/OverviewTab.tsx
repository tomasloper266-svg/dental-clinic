"use client";

import {
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  ShieldAlert,
  Users,
} from "lucide-react";
import type { PatientDto } from "@/lib/services/patients";
import { parseMedicalNotes } from "@/lib/medical-notes";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import PatientEditModal from "@/components/patients/PatientEditModal";
import PeriodontalSummaryCard from "./PeriodontalSummaryCard";
import type { PeriodontalSummary } from "@/lib/odontogram/periodontal-view";

// تبويب «الملف» — بطاقتان كالمرجع: البيانات الشخصية (الهواتف، سنة الميلاد،
// العنوان، البريد، الرقم الوطني، جهات اتصال الطوارئ) والسجل الطبي
// والملاحظات (التحذيرات، الأمراض المزمنة، الملاحظات) مع زر تعديل البيانات.

function DataItem({
  icon: Icon,
  label,
  value,
  ltr = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="bg-primary-500/10 text-primary-700 grid size-8 shrink-0 place-items-center rounded-full"
      >
        <Icon size={14} />
      </span>
      <div className="min-w-0">
        <p className="text-warm-500 text-[11px] font-medium">{label}</p>
        <p
          className={`text-ink-900 text-sm font-medium ${ltr ? "numeric text-start" : ""}`}
          dir={ltr ? "ltr" : undefined}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export default function OverviewTab({
  patient,
  periodontal,
}: {
  patient: PatientDto;
  /** ملخص الدواعم — يُعرض فقط حين توجد قياسات مسجلة */
  periodontal?: PeriodontalSummary;
}) {
  // الحقول المهيكلة أولاً — والسطور المركّبة القديمة احتياطاً للبيانات السابقة
  const { t } = useI18n();
  const notes = parseMedicalNotes(patient.medicalNotes);
  const allergies = patient.allergies ?? notes.allergies;
  const chronic = patient.chronicDiseases ?? notes.conditions;

  const personal: Array<{
    icon: React.ElementType;
    label: string;
    value: string;
    ltr?: boolean;
  }> = [
    {
      icon: Phone,
      label: t("form.phone"),
      value: patient.phone ?? "—",
      ltr: true,
    },
    {
      icon: PhoneCall,
      label: t("form.secondaryPhone"),
      value: patient.secondaryPhone ?? "—",
      ltr: true,
    },
    {
      icon: Phone,
      label: t("form.homePhone"),
      value: patient.homePhone ?? "—",
      ltr: true,
    },
    {
      icon: Mail,
      label: t("form.email"),
      value: patient.email ?? "—",
      ltr: true,
    },
    {
      icon: MapPin,
      label: t("form.address"),
      value: patient.address ?? "—",
    },
    {
      icon: ShieldAlert,
      label: t("form.nationalId"),
      value: patient.nationalId ?? "—",
      ltr: true,
    },
    {
      icon: Users,
      label: t("form.emergency"),
      value: patient.emergencyContacts ?? "—",
    },
  ];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {/* ─── البيانات الشخصية ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("overview.personalInfo")}</CardTitle>
        </CardHeader>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <DataItem
            icon={Users}
            label={t("form.gender")}
            value={
              patient.gender === "MALE"
                ? t("gender.male")
                : patient.gender === "FEMALE"
                  ? t("gender.female")
                  : "—"
            }
          />
          <DataItem
            icon={Mail}
            label={t("form.birthYear")}
            value={patient.birthYear !== null ? String(patient.birthYear) : "—"}
          />
          {personal.map((item) => (
            <DataItem key={item.label} {...item} />
          ))}
        </div>
      </Card>

      {/* ─── السجل الطبي والملاحظات ───────────────────────────────── */}
      <Card>
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle>{t("overview.medicalRecord")}</CardTitle>
          <PatientEditModal patient={patient} />
        </CardHeader>
        <div className="space-y-5 p-5">
          <div>
            <p className="text-danger-700 flex items-center gap-1.5 text-xs font-semibold">
              <ShieldAlert size={13} aria-hidden />
              {t("overview.warnings")}
            </p>
            {allergies ? (
              <p className="text-ink-900 mt-1.5 text-sm leading-6 whitespace-pre-line">
                {allergies}
              </p>
            ) : (
              <p className="text-warm-400 mt-1.5 text-sm">
                {t("overview.noAllergies")}
              </p>
            )}
          </div>
          <div>
            <p className="text-warning-700 text-xs font-semibold">
              {t("form.chronic")}
            </p>
            {chronic ? (
              <p className="text-ink-900 mt-1.5 text-sm leading-6 whitespace-pre-line">
                {chronic}
              </p>
            ) : (
              <p className="text-warm-400 mt-1.5 text-sm">
                {t("overview.noChronic")}
              </p>
            )}
          </div>
          {patient.medicalNotes && (
            <div>
              <p className="text-warm-600 text-xs font-semibold">
                {t("form.notes")}
              </p>
              <p className="text-ink-900 mt-1.5 text-sm leading-6 whitespace-pre-line">
                {patient.medicalNotes}
              </p>
            </div>
          )}
          {!allergies && !chronic && !patient.medicalNotes && (
            <p className="text-warm-400 text-sm">{t("overview.noRecord")}</p>
          )}
        </div>
      </Card>

      {periodontal && periodontal.readingCount > 0 && (
        <PeriodontalSummaryCard summary={periodontal} patientId={patient.id} />
      )}
    </div>
  );
}

"use client";

import { Mail, MapPin, Phone, PhoneCall, ShieldAlert, Users } from "lucide-react";
import type { PatientDto } from "@/lib/services/patients";
import { genderLabel } from "@/lib/patients-view";
import { parseMedicalNotes } from "@/lib/medical-notes";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import PatientEditModal from "@/components/patients/PatientEditModal";

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
        className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-500/10 text-primary-700"
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

export default function OverviewTab({ patient }: { patient: PatientDto }) {
  // الحقول المهيكلة أولاً — والسطور المركّبة القديمة احتياطاً للبيانات السابقة
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
      label: "الهاتف الرئيسي",
      value: patient.phone ?? "—",
      ltr: true,
    },
    {
      icon: PhoneCall,
      label: "هاتف إضافي",
      value: patient.secondaryPhone ?? "—",
      ltr: true,
    },
    {
      icon: Phone,
      label: "هاتف المنزل",
      value: patient.homePhone ?? "—",
      ltr: true,
    },
    {
      icon: Mail,
      label: "البريد الإلكتروني",
      value: patient.email ?? "—",
      ltr: true,
    },
    {
      icon: MapPin,
      label: "العنوان",
      value: patient.address ?? "—",
    },
    {
      icon: ShieldAlert,
      label: "الرقم الوطني / الهوية",
      value: patient.nationalId ?? "—",
      ltr: true,
    },
    {
      icon: Users,
      label: "جهات اتصال الطوارئ",
      value: patient.emergencyContacts ?? "—",
    },
  ];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {/* ─── البيانات الشخصية ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>البيانات الشخصية</CardTitle>
        </CardHeader>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <DataItem
            icon={Users}
            label="الجنس"
            value={genderLabel(patient.gender) ?? "—"}
          />
          <DataItem
            icon={Mail}
            label="سنة الميلاد"
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
          <CardTitle>السجل الطبي والملاحظات</CardTitle>
          <PatientEditModal patient={patient} />
        </CardHeader>
        <div className="space-y-5 p-5">
          <div>
            <p className="text-danger-700 flex items-center gap-1.5 text-xs font-semibold">
              <ShieldAlert size={13} aria-hidden />
              تحذيرات
            </p>
            {allergies ? (
              <p className="text-ink-900 mt-1.5 whitespace-pre-line text-sm leading-6">
                {allergies}
              </p>
            ) : (
              <p className="text-warm-400 mt-1.5 text-sm">لا حساسيات مسجلة</p>
            )}
          </div>
          <div>
            <p className="text-warning-700 text-xs font-semibold">
              الأمراض المزمنة
            </p>
            {chronic ? (
              <p className="text-ink-900 mt-1.5 whitespace-pre-line text-sm leading-6">
                {chronic}
              </p>
            ) : (
              <p className="text-warm-400 mt-1.5 text-sm">لا أمراض مزمنة مسجلة</p>
            )}
          </div>
          {patient.medicalNotes && (
            <div>
              <p className="text-warm-600 text-xs font-semibold">ملاحظات</p>
              <p className="text-ink-900 mt-1.5 whitespace-pre-line text-sm leading-6">
                {patient.medicalNotes}
              </p>
            </div>
          )}
          {!allergies && !chronic && !patient.medicalNotes && (
            <p className="text-warm-400 text-sm">
              لا سجل طبي بعد — أضف التحذيرات والأمراض المزمنة من «تعديل
              البيانات».
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

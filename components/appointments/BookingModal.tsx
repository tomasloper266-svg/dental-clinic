"use client";

import { useEffect, useState } from "react";
import type { StaffMemberDto } from "@/lib/services/staff";
import { doctorDisplayName } from "@/lib/staff-name";
import { STATUS_META } from "@/lib/appointment-ui";
import {
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
} from "@/lib/appointment-state";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/components/i18n/I18nProvider";

// نافذة «موعد جديد» على شكل المرجع: المريض والطبيب، التاريخ والوقت، المدة
// ونوع الخدمة، ثم الحالة والملاحظات. كل الحقول مرتبطة بواجهة برمجة العيادة:
// المرضى من /api/patients والأطباء من /api/staff، والحفظ يُنشئ موعداً حقيقياً.
// أخطاء التحقق تظهر داخل الحقل، وخطأ التعارض (409) كرسالة تحت النموذج.

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90] as const;

type PatientOption = { id: string; name: string };

type BookingModalProps = {
  open: boolean;
  onClose: () => void;
  /** التاريخ المبدئي من التقويم YYYY-MM-DD */
  dateValue: string;
  /** وقت مبدئي HH:mm — من النقر على فجوة فارغة في الشبكة */
  initialTime?: string;
  onBooked: () => void;
};

type FormState = {
  patientId: string;
  staffId: string;
  date: string;
  time: string;
  duration: number;
  reason: string;
  status: AppointmentStatus;
  note: string;
};

function initialForm(dateValue: string, initialTime: string): FormState {
  return {
    patientId: "",
    staffId: "",
    date: dateValue,
    time: initialTime,
    duration: 30,
    reason: "",
    status: "SCHEDULED",
    note: "",
  };
}

export default function BookingModal({
  open,
  onClose,
  dateValue,
  initialTime = "09:00",
  onBooked,
}: BookingModalProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(() =>
    initialForm(dateValue, initialTime),
  );
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [doctors, setDoctors] = useState<StaffMemberDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  // الحقول المستهدفة برسالة الخطأ — رسائل الخادم بلا هدف فتُعرض تحت النموذج.
  const [errorFields, setErrorFields] = useState<
    ReadonlyArray<"patient" | "date" | "time">
  >([]);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // قوائم المرضى والأطباء النشطين — من خدمة العيادة نفسها عند كل فتح.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void (async () => {
      try {
        const [patientsRes, staffRes] = await Promise.all([
          fetch("/api/patients"),
          fetch("/api/staff"),
        ]);
        if (patientsRes.ok) {
          const data = (await patientsRes.json()) as {
            patients: PatientOption[];
          };
          if (alive) setPatients(data.patients);
        }
        if (staffRes.ok) {
          const data = (await staffRes.json()) as { staff: StaffMemberDto[] };
          // الأطباء فقط النشطون — فلتر «الطبيب» كما في المرجع.
          if (alive) {
            setDoctors(
              data.staff.filter((s) => s.isActive && s.role === "DENTIST"),
            );
          }
        }
      } catch {
        // بلا قوائم يبقى الإرسال متاحاً ورسالة التحقق تشرح ما ينقص.
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  // نافذة جديدة بذكريات سابقة — إعادة ضبط عند كل فتح.
  useEffect(() => {
    if (open) {
      setForm(initialForm(dateValue, initialTime));
      setError(null);
      setErrorFields([]);
    }
  }, [open, dateValue, initialTime]);

  async function submit() {
    if (!form.patientId) {
      setError(t("booking.error.patient"));
      setErrorFields(["patient"]);
      return;
    }
    if (!form.date || !form.time) {
      setError(t("booking.error.datetime"));
      setErrorFields(["date", "time"]);
      return;
    }
    setSaving(true);
    setError(null);
    setErrorFields([]);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patientId: form.patientId,
          startsAt: `${form.date}T${form.time}:00`,
          durationMin: form.duration,
          reason: form.reason.trim() || undefined,
          note: form.note.trim() || undefined,
          staffId: form.staffId || undefined,
          status: form.status,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("booking.error.save"));
        return;
      }
      toast(t("booking.savedToast"));
      onBooked();
      onClose();
    } catch {
      setError(t("common.error.network"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("appt.new")}
      titleClassName="font-display text-xl font-normal"
      footer={
        <>
          <Button onClick={submit} loading={saving}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t("booking.patient")}
            htmlFor="booking-patient"
            error={
              errorFields.includes("patient") ? (error ?? undefined) : undefined
            }
          >
            <Select
              id="booking-patient"
              value={form.patientId}
              onChange={(e) => set("patientId", e.target.value)}
            >
              <option value="">{t("booking.choose")}</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("booking.doctor")} htmlFor="booking-staff">
            <Select
              id="booking-staff"
              value={form.staffId}
              onChange={(e) => set("staffId", e.target.value)}
            >
              <option value="">{t("booking.pick")}</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {doctorDisplayName(d.name)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t("booking.date")}
            htmlFor="booking-date"
            error={
              errorFields.includes("date") ? (error ?? undefined) : undefined
            }
          >
            <Input
              id="booking-date"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
          <Field
            label={t("booking.time")}
            htmlFor="booking-time"
            error={
              errorFields.includes("time") ? (error ?? undefined) : undefined
            }
          >
            <Input
              id="booking-time"
              type="time"
              value={form.time}
              onChange={(e) => set("time", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("booking.duration")} htmlFor="booking-duration">
            <Select
              id="booking-duration"
              value={form.duration}
              onChange={(e) => set("duration", Number(e.target.value))}
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {t("timeline.duration", { minutes: d })}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("booking.serviceType")} htmlFor="booking-reason">
            <Input
              id="booking-reason"
              type="text"
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              placeholder={t("booking.servicePlaceholder")}
            />
          </Field>
        </div>

        <Field label={t("booking.status")} htmlFor="booking-status">
          <Select
            id="booking-status"
            value={form.status}
            onChange={(e) => set("status", e.target.value as AppointmentStatus)}
          >
            {APPOINTMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(STATUS_META[s].labelKey)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("booking.notes")} htmlFor="booking-note">
          <Textarea
            id="booking-note"
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>

        {error && errorFields.length === 0 && (
          <p
            role="alert"
            className="rounded-field border-danger-300 bg-danger-50 text-danger-700 border px-3 py-2 text-xs"
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

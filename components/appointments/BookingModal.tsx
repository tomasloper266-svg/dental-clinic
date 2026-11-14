"use client";

import { useEffect, useState } from "react";
import type { StaffMemberDto } from "@/lib/services/staff";
import { STATUS_META } from "@/lib/appointment-ui";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/appointment-state";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

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
  const [form, setForm] = useState<FormState>(() => initialForm(dateValue, initialTime));
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [doctors, setDoctors] = useState<StaffMemberDto[]>([]);
  const [error, setError] = useState<string | null>(null);
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
          const data = (await patientsRes.json()) as { patients: PatientOption[] };
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
    }
  }, [open, dateValue, initialTime]);

  async function submit() {
    if (!form.patientId) {
      setError("اختر مريضاً أولاً");
      return;
    }
    if (!form.date || !form.time) {
      setError("حدّد تاريخاً ووقتاً للموعد");
      return;
    }
    setSaving(true);
    setError(null);
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
        setError(data.error ?? "تعذر حفظ الموعد");
        return;
      }
      toast("تم حفظ الموعد بنجاح");
      onBooked();
      onClose();
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="موعد جديد"
      titleClassName="font-display text-xl font-normal"
      footer={
        <>
          <Button onClick={submit} loading={saving}>
            {saving ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="المريض *"
            htmlFor="booking-patient"
            error={error?.includes("مريض") ? error : undefined}
          >
            <Select
              id="booking-patient"
              value={form.patientId}
              onChange={(e) => set("patientId", e.target.value)}
            >
              <option value="">— اختر —</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الطبيب" htmlFor="booking-staff">
            <Select
              id="booking-staff"
              value={form.staffId}
              onChange={(e) => set("staffId", e.target.value)}
            >
              <option value="">— حدد —</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  د. {d.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="التاريخ *"
            htmlFor="booking-date"
            error={error?.includes("تاريخاً") ? error : undefined}
          >
            <Input
              id="booking-date"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
          <Field
            label="الوقت *"
            htmlFor="booking-time"
            error={error?.includes("وقتاً") ? error : undefined}
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
          <Field label="المدة (دقائق)" htmlFor="booking-duration">
            <Select
              id="booking-duration"
              value={form.duration}
              onChange={(e) => set("duration", Number(e.target.value))}
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} دقيقة
                </option>
              ))}
            </Select>
          </Field>
          <Field label="نوع الخدمة" htmlFor="booking-reason">
            <Input
              id="booking-reason"
              type="text"
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              placeholder="حشو تجميلي…"
            />
          </Field>
        </div>

        <Field label="الحالة" htmlFor="booking-status">
          <Select
            id="booking-status"
            value={form.status}
            onChange={(e) => set("status", e.target.value as AppointmentStatus)}
          >
            {APPOINTMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="ملاحظات" htmlFor="booking-note">
          <Textarea
            id="booking-note"
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>

        {error && !error.includes("مريض") && !error.includes("تاريخاً") && !error.includes("وقتاً") && (
          <p
            role="alert"
            className="rounded-field border border-danger-300 bg-danger-50 px-3 py-2 text-xs text-danger-700"
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

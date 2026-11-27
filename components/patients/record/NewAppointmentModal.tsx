"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/components/i18n/I18nProvider";

// حجز موعد لمريض معروف من ملفه — المريض ثابت (يأتي من المسار) والنموذج
// للتاريخ والوقت والمدة والسبب فقط. خطأ التعارض (409) يظهر داخلياً،
// والحجز الناجح يعيد القراءة من الخادم ليُحدَّث تبويب المواعيد.

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90] as const;

/** تاريخ اليوم بتوقيت الجهاز بصيغة YYYY-MM-DD — لقيمة الحقل الافتراضية */
function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

type Props = {
  open: boolean;
  onClose: () => void;
  patientId: string;
};

export default function NewAppointmentModal({
  open,
  onClose,
  patientId,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [date, setDate] = useState(todayIso);
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState<number>(30);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // نافذة جديدة بذكريات سابقة — إعادة ضبط عند كل فتح.
  useEffect(() => {
    if (open) {
      setDate(todayIso());
      setTime("09:00");
      setDuration(30);
      setReason("");
      setError(null);
    }
  }, [open]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patientId,
          startsAt: `${date}T${time}:00`,
          durationMin: duration,
          reason: reason.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("newAppt.error"));
        return;
      }
      toast(t("newAppt.savedToast"));
      router.refresh();
      onClose();
    } catch {
      setError(t("common.error.network"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("appt.new")}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("newAppt.date")} htmlFor="patient-appt-date">
            <Input
              id="patient-appt-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label={t("newAppt.time")} htmlFor="patient-appt-time">
            <Input
              id="patient-appt-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
          <Field label={t("newAppt.duration")} htmlFor="patient-appt-duration">
            <Select
              id="patient-appt-duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("newAppt.reason")} htmlFor="patient-appt-reason">
            <Input
              id="patient-appt-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("newAppt.reasonPlaceholder")}
            />
          </Field>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-field border-danger-300 bg-danger-50 text-danger-700 border px-3 py-2 text-xs"
          >
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={submit} loading={saving}>
            <CalendarPlus size={16} aria-hidden />
            {saving ? t("newAppt.saving") : t("newAppt.booking")}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { usePatientSearch, type PatientOption } from "@/lib/use-patient-search";

// نموذج حجز موعد في نافذة موحّدة — بحث مريض + تاريخ + وقت + مدة + سبب.
// خطأ التعارض (409) يظهر كرسالة داخلية تحت النموذج، والحجز الناجح يعرض
// إشعاراً عابراً. الزر نفسه هو الإجراء السريع الموحّد في شريط الصفحة.

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90] as const;

type BookingModalProps = {
  open: boolean;
  onClose: () => void;
  /** تاريخ مبدئي من التقويم YYYY-MM-DD */
  dateValue: string;
  /** وقت مبدئي HH:mm — من النقر على فجوة فارغة في الشبكة */
  initialTime?: string;
  onBooked: () => void;
};

export default function BookingModal({
  open,
  onClose,
  dateValue,
  initialTime = "09:00",
  onBooked,
}: BookingModalProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<PatientOption | null>(null);
  const [search, setSearch] = useState("");
  const options = usePatientSearch(search, open);
  const [time, setTime] = useState(initialTime);
  const [duration, setDuration] = useState<number>(30);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // نافذة جديدة بذكريات سابقة — إعادة ضبط عند كل فتح.
  useEffect(() => {
    if (open) {
      setSelected(null);
      setSearch("");
      setTime(initialTime);
      setDuration(30);
      setReason("");
      setError(null);
    }
  }, [open, initialTime]);

  async function submit() {
    if (!selected) {
      setError("اختر مريضاً أولاً");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patientId: selected.id,
          startsAt: `${dateValue}T${time}:00`,
          durationMin: duration,
          reason: reason.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "تعذر حجز الموعد");
        return;
      }
      toast("تم حجز الموعد بنجاح");
      onBooked();
      onClose();
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="حجز موعد جديد">
      <div className="flex flex-col gap-4">
        <Field label="المريض" htmlFor="booking-patient">
          {selected ? (
            <div className="flex items-center justify-between rounded-field border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">
              <span>
                {selected.name}
                {selected.phone ? ` · ${selected.phone}` : ""}
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs font-medium text-primary-700 underline"
              >
                تغيير
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search
                size={16}
                aria-hidden
                className="absolute start-3 top-1/2 -translate-y-1/2 text-warm-400"
              />
              <Input
                id="booking-patient"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو الهاتف…"
                className="ps-9"
              />
              {options.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-field border border-warm-200 bg-surface-raised shadow-md">
                  {options.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(p);
                          setSearch("");
                        }}
                        className="w-full px-3 py-2 text-start text-sm hover:bg-surface-hover"
                      >
                        {p.name}
                        {p.phone ? (
                          <span className="text-warm-500"> · {p.phone}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="التاريخ" htmlFor="booking-date">
            <Input
              id="booking-date"
              type="date"
              value={dateValue}
              readOnly
            />
          </Field>
          <Field label="الوقت" htmlFor="booking-time">
            <Input
              id="booking-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
          <Field label="المدة (دقيقة)" htmlFor="booking-duration">
            <Select
              id="booking-duration"
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
          <Field label="السبب (اختياري)" htmlFor="booking-reason">
            <Input
              id="booking-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="كشف، حشو…"
            />
          </Field>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-field border border-danger-300 bg-danger-50 px-3 py-2 text-xs text-danger-700"
          >
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={submit} loading={saving}>
            <CalendarPlus size={16} aria-hidden />
            {saving ? "جارٍ الحجز…" : "تأكيد الحجز"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  );
}

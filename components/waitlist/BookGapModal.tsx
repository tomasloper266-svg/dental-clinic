"use client";

import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import type { WaitlistStatus } from "@/lib/services/waitlist";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatTime } from "@/lib/appointment-ui";

// حجز مريض من قائمة الانتظار في فجوة شاغرة — اختيار المريض (المرتبون
// بالأولوية أولًا) ومدة لا تتجاوز الفجوة، ثم تأكيد بفحص التعارض على
// الخادم نفسه. نتيجة 409 تعني أن الفجوة شوغلت للتو.

export type GapJson = {
  start: string;
  end: string;
  durationMin: number;
};

export type WaitlistEntryJson = {
  id: string;
  patientId: string;
  patientName: string;
  preferredWindow: string;
  priority: number;
  status: WaitlistStatus;
  note: string | null;
};

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90] as const;

type BookGapModalProps = {
  gap: GapJson;
  /** القيود المنتظرة — تُعرض مرتبة بالأولوية */
  waiting: WaitlistEntryJson[];
  onClose: () => void;
  onBooked: () => void;
};

export default function BookGapModal({
  gap,
  waiting,
  onClose,
  onBooked,
}: BookGapModalProps) {
  const { toast } = useToast();
  const [entryId, setEntryId] = useState<string | null>(waiting[0]?.id ?? null);
  const [duration, setDuration] = useState<number>(
    Math.min(30, gap.durationMin),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // خيارات المدة التي تناسب الفجوة فقط — الحجز الأطول من الفجوة يهدرها.
  const fittingDurations = DURATION_OPTIONS.filter(
    (d) => d <= gap.durationMin,
  );

  useEffect(() => {
    if (!fittingDurations.includes(duration as (typeof DURATION_OPTIONS)[number])) {
      setDuration(fittingDurations[fittingDurations.length - 1] ?? gap.durationMin);
    }
  }, [gap.durationMin, duration, fittingDurations]);

  async function submit() {
    if (!entryId) {
      setError("اختر مريضاً من القائمة");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/waitlist/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          waitlistEntryId: entryId,
          startsAt: gap.start,
          durationMin: duration,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "تعذر الحجز");
        return;
      }
      const entry = waiting.find((e) => e.id === entryId);
      toast(
        `تم حجز ${entry?.patientName ?? "المريض"} في فجوة ${formatTime(gap.start)}`,
      );
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
      open
      onClose={onClose}
      title={`حجز في فجوة ${formatTime(gap.start)} — ${formatTime(gap.end)}`}
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-field border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-800">
          مدة الفجوة الشاغرة <span className="numeric font-semibold">{gap.durationMin}</span> دقيقة —
          اختر المريض والمدة المناسبة.
        </p>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-ink-900">
            المريض المنتظر
          </legend>
          {waiting.length === 0 ? (
            <p className="rounded-field border border-warm-200 bg-surface-sunken px-3 py-2 text-xs text-warm-600">
              لا مرضى في قائمة الانتظار — أضف مريضاً أولاً.
            </p>
          ) : (
            waiting.map((e) => (
              <label
                key={e.id}
                className="flex cursor-pointer items-center gap-3 rounded-field border border-warm-200 px-3 py-2 text-sm transition-colors has-checked:border-primary-500 has-checked:bg-primary-50"
              >
                <input
                  type="radio"
                  name="waitlist-entry"
                  value={e.id}
                  checked={entryId === e.id}
                  onChange={() => setEntryId(e.id)}
                  className="accent-primary-600"
                />
                <span className="flex-1">
                  <span className="font-medium text-ink-900">{e.patientName}</span>
                  <span className="block text-xs text-warm-500">
                    {e.preferredWindow}
                    {e.priority > 0 ? ` · أولوية ${e.priority}` : ""}
                  </span>
                </span>
              </label>
            ))
          )}
        </fieldset>

        <Field label="المدة (دقيقة)" htmlFor="gap-duration">
          <Select
            id="gap-duration"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {fittingDurations.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>

        {error && (
          <p
            role="alert"
            className="rounded-field border border-danger-300 bg-danger-50 px-3 py-2 text-xs text-danger-700"
          >
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={submit} loading={saving} disabled={waiting.length === 0}>
            <CalendarCheck size={16} aria-hidden />
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

"use client";

import { useEffect, useRef, useState } from "react";

// نموذج حجز موعد — بحث مريض + تاريخ + وقت + مدة. خطأ التعارض (409)
// يظهر كرسالة داخلية تحت الحقل، لا كتنبيه نظام.

export type PatientOption = {
  id: string;
  name: string;
  phone: string | null;
};

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90] as const;

export default function BookingForm({
  dateValue,
  onBooked,
}: {
  dateValue: string;
  onBooked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<PatientOption[]>([]);
  const [selected, setSelected] = useState<PatientOption | null>(null);
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState<number>(30);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const searchSeq = useRef(0);

  // بحث المرضى مع تراجع بسيط لتقليل الطلبات أثناء الكتابة.
  useEffect(() => {
    if (!open || !search.trim()) {
      setOptions([]);
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/patients?q=${encodeURIComponent(search.trim())}`,
        );
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { patients: PatientOption[] };
        if (seq === searchSeq.current) setOptions(data.patients);
      } catch {
        if (seq === searchSeq.current) setOptions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, open]);

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
      setSelected(null);
      setSearch("");
      setReason("");
      onBooked();
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white active:bg-teal-800"
      >
        + حجز موعد جديد
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-teal-800">حجز موعد</h3>

      <label className="block text-xs font-medium text-gray-600">المريض</label>
      {selected ? (
        <div className="mt-1 flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
          <span>
            {selected.name}
            {selected.phone ? ` · ${selected.phone}` : ""}
          </span>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-xs text-teal-700 underline"
          >
            تغيير
          </button>
        </div>
      ) : (
        <div className="mt-1">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الهاتف…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
          />
          {options.length > 0 && (
            <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white">
              {options.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(p);
                      setOptions([]);
                    }}
                    className="w-full px-3 py-2 text-right text-sm hover:bg-teal-50"
                  >
                    {p.name}
                    {p.phone ? (
                      <span className="text-gray-500"> · {p.phone}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600">
            التاريخ
          </label>
          <input
            type="date"
            value={dateValue}
            readOnly
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">
            الوقت
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">
            المدة (دقيقة)
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">
            السبب (اختياري)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="كشف، حشو…"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="flex-1 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "جارٍ الحجز…" : "تأكيد الحجز"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-600"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { STATUS_META, formatTime } from "@/lib/appointment-ui";

// لوحة التذكير اليومي — مواعيد الغد مرتبة زمنياً، ولكل مريض زر واتساب مباشر
// يفتح الرابط المقبّد مع نص التذكير، وزر نسخ للرسالة كخيار ثانٍ.

type ReminderJson = {
  appointmentId: string;
  patientId: string;
  patientName: string;
  phone: string | null;
  startsAt: string;
  durationMin: number;
  status:
    | "SCHEDULED"
    | "CONFIRMED"
    | "IN_TREATMENT"
    | "COMPLETED"
    | "CANCELLED"
    | "NO_SHOW";
  reason: string | null;
  whatsappUrl: string | null;
  message: string;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "loaded"; reminders: ReminderJson[] };

export default function RemindersBoard() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/reminders/tomorrow");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { reminders: ReminderJson[] };
      setState({ kind: "loaded", reminders: data.reminders });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function copyMessage(reminder: ReminderJson) {
    try {
      await navigator.clipboard.writeText(reminder.message);
      setCopiedId(reminder.appointmentId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // النسخ اختياري — الفشل لا يعطل القائمة، وواتساب يبقى الخيار الأساسي.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {state.kind === "loading" && <RemindersSkeleton />}

      {state.kind === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
          تعذر تحميل قائمة التذكير
          <button type="button" onClick={refresh} className="ms-2 underline">
            إعادة المحاولة
          </button>
        </div>
      )}

      {state.kind === "loaded" &&
        (state.reminders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            لا مواعيد غداً — القائمة فارغة.
          </div>
        ) : (
          <ul className="space-y-2">
            {state.reminders.map((r) => (
              <li
                key={r.appointmentId}
                className="rounded-2xl bg-white p-4 shadow-md"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-teal-800 tabular-nums">
                    {formatTime(r.startsAt)}
                  </span>
                  <span className="text-sm font-semibold text-gray-800">
                    {r.patientName}
                  </span>
                  <span
                    className={`ms-auto rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_META[r.status].chip}`}
                  >
                    {STATUS_META[r.status].label}
                  </span>
                </div>
                {r.reason && (
                  <p className="mt-1 text-xs text-gray-500">{r.reason}</p>
                )}
                <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-700">
                  {r.message}
                </p>
                {r.whatsappUrl ? (
                  <div className="mt-2 flex items-center gap-2">
                    <a
                      href={r.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white"
                    >
                      إرسال واتساب
                    </a>
                    <button
                      type="button"
                      onClick={() => copyMessage(r)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700"
                    >
                      {copiedId === r.appointmentId ? "تم النسخ ✓" : "نسخ النص"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-700">
                    لا يوجد رقم هاتف لهذا المريض — أضف الرقم في ملفه ليظهر زر
                    واتساب.
                  </p>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

function RemindersSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-xl border border-gray-100 bg-gray-50"
        />
      ))}
    </div>
  );
}

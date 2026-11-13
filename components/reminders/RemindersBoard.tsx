"use client";

import { useCallback, useState } from "react";
import { STATUS_META, formatTime } from "@/lib/appointment-ui";
import { reminderCounters } from "@/lib/reminders/counters";

// لوحة التذكير اليومي — زر «تجهيز تذكيرات الغد» يجمع مواعيد الغد ويولّد لكل
// مريض رسالة عربية جاهزة برابط واتساب، وزر واحد يفتح الرابط ويسجّل «أُرسل».

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
  sent: boolean;
};

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "loaded"; reminders: ReminderJson[] };

// تسجيل إرسال موعد في القاعدة — يعيد true عند النجاح. الفتح في واتساب
// يتم من الرابط نفسه؛ هنا فقط السجل.
async function recordReminderSent(appointmentId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/reminders/${appointmentId}/sent`, {
      method: "POST",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function RemindersBoard() {
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [recordFailedId, setRecordFailedId] = useState<string | null>(null);

  // تجهيز تذكيرات الغد — نفس زر البداية وزر التحديث بعد التجهيز.
  const prepare = useCallback(async () => {
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

  // ضغطة واحدة: الرابط يفتح واتساب بالنص الجاهز (href) والتسجيل يجري بالتوازي.
  async function sendReminder(reminder: ReminderJson) {
    const ok = await recordReminderSent(reminder.appointmentId);
    if (!ok) {
      setRecordFailedId(reminder.appointmentId);
      return;
    }
    setRecordFailedId(null);
    setState((prev) =>
      prev.kind === "loaded"
        ? {
            kind: "loaded",
            reminders: prev.reminders.map((r) =>
              r.appointmentId === reminder.appointmentId
                ? { ...r, sent: true }
                : r,
            ),
          }
        : prev,
    );
  }

  async function copyMessage(reminder: ReminderJson) {
    try {
      await navigator.clipboard.writeText(reminder.message);
      setCopiedId(reminder.appointmentId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // النسخ اختياري — الفشل لا يعطل القائمة، وواتساب يبقى الخيار الأساسي.
    }
  }

  if (state.kind === "idle") {
    return (
      <div className="rounded-panel bg-surface-raised shadow-xs border border-warm-200 flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-ink-900 text-sm font-semibold">
          جهّز تذكيرات الغد بضغطة واحدة — رسالة عربية جاهزة لكل مريض مع رابط
          واتساب مباشر.
        </p>
        <button
          type="button"
          onClick={prepare}
          className="bg-primary-600 hover:bg-primary-700 rounded-field px-6 py-3 text-sm font-bold text-white transition-colors"
        >
          تجهيز تذكيرات الغد
        </button>
      </div>
    );
  }

  if (state.kind === "loading") {
    return <RemindersSkeleton />;
  }

  if (state.kind === "error") {
    return (
      <div className="rounded-panel border-danger-200 bg-danger-50 border p-4 text-center text-sm text-danger-700">
        تعذر تجهيز قائمة التذكير
        <button type="button" onClick={prepare} className="ms-2 underline">
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const counters = reminderCounters(state.reminders);

  return (
    <div className="flex flex-col gap-4">
      {state.reminders.length === 0 ? (
        <div className="rounded-panel border-warm-300 bg-surface-raised border border-dashed p-6 text-center text-sm text-warm-500">
          لا مواعيد غداً — القائمة فارغة.
        </div>
      ) : (
        <>
          <div className="rounded-panel bg-surface-raised shadow-xs border border-warm-200 flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-xs">
            <span className="text-primary-800 font-bold tabular-nums">
              جاهز: {counters.ready}
            </span>
            <span className="text-primary-700 font-bold tabular-nums">
              أُرسل: {counters.sent}
            </span>
            <span className="text-warning-700 font-bold tabular-nums">
              متبقي: {counters.remaining}
            </span>
            <button
              type="button"
              onClick={prepare}
              className="border-warm-300 bg-surface-raised text-ink-900 hover:bg-surface-hover ms-auto rounded-field border px-3 py-1.5 transition-colors"
            >
              إعادة التجهيز
            </button>
          </div>

          <ul className="flex flex-col gap-2">
            {state.reminders.map((r) => (
              <ReminderRow
                key={r.appointmentId}
                reminder={r}
                copied={copiedId === r.appointmentId}
                recordFailed={recordFailedId === r.appointmentId}
                onSend={() => sendReminder(r)}
                onCopy={() => copyMessage(r)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type ReminderRowProps = {
  reminder: ReminderJson;
  copied: boolean;
  recordFailed: boolean;
  onSend: () => void;
  onCopy: () => void;
};

function ReminderRow({
  reminder,
  copied,
  recordFailed,
  onSend,
  onCopy,
}: ReminderRowProps) {
  return (
    <li className="rounded-panel bg-surface-raised shadow-xs border border-warm-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-primary-800 text-sm font-bold tabular-nums">
          {formatTime(reminder.startsAt)}
        </span>
        <span className="text-ink-900 text-sm font-semibold">
          {reminder.patientName}
        </span>
        {reminder.sent && (
          <span className="bg-primary-50 border-primary-200 text-primary-800 rounded-full border px-2 py-0.5 text-[11px] font-bold">
            أُرسل ✓
          </span>
        )}
        <span
          className={`ms-auto rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_META[reminder.status].chip}`}
        >
          {STATUS_META[reminder.status].label}
        </span>
      </div>
      {reminder.reason && (
        <p className="text-warm-500 mt-1 text-xs">{reminder.reason}</p>
      )}
      <p className="bg-surface-sunken text-ink-900 mt-2 rounded-field px-3 py-2 text-xs leading-5">
        {reminder.message}
      </p>
      {reminder.whatsappUrl ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {reminder.sent ? (
            <>
              <span className="bg-primary-50 text-primary-800 border-primary-200 rounded-field border px-4 py-2 text-xs font-bold">
                أُرسل
              </span>
              <a
                href={reminder.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-700 text-xs underline"
              >
                فتح واتساب مجدداً
              </a>
            </>
          ) : (
            <a
              href={reminder.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onSend}
              className="bg-primary-600 hover:bg-primary-700 rounded-field px-4 py-2 text-xs font-bold text-white transition-colors"
            >
              إرسال واتساب
            </a>
          )}
          <button
            type="button"
            onClick={onCopy}
            className="border-warm-300 bg-surface-raised text-ink-900 hover:bg-surface-hover rounded-field border px-3 py-2 text-xs transition-colors"
          >
            {copied ? "تم النسخ ✓" : "نسخ النص"}
          </button>
        </div>
      ) : (
        <p className="text-warning-700 mt-2 text-xs">
          لا يوجد رقم هاتف لهذا المريض — أضف الرقم في ملفه ليظهر زر واتساب.
        </p>
      )}
      {recordFailed && (
        <p className="text-warning-700 mt-2 text-xs">
          تعذر تسجيل الإرسال في السجل — تأكد من فتح واتساب ثم
          <button
            type="button"
            onClick={onSend}
            className="ms-1 underline"
          >
            سجّل الإرسال يدوياً
          </button>
        </p>
      )}
    </li>
  );
}

function RemindersSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="border-warm-100 bg-surface-sunken h-28 animate-pulse rounded-panel border"
        />
      ))}
    </div>
  );
}

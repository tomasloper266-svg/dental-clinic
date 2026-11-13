"use client";

import { useCallback, useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Copy,
  Hourglass,
  MessageCircle,
} from "lucide-react";
import { STATUS_META, formatTime } from "@/lib/appointment-ui";
import { reminderCounters } from "@/lib/reminders/counters";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { EntityCell } from "@/components/ui/EntityCell";
import { PillAction, IconAction } from "@/components/ui/TableActions";
import { StatCard } from "@/components/ui/StatCard";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";

// لوحة التذكير اليومي — زر «تجهيز تذكيرات الغد» يجمع مواعيد الغد ويولّد لكل
// مريض رسالة عربية جاهزة برابط واتساب، وزر إرسال واحد يفتح الرابط ويسجّل
// «أُرسل». البنية على شكل المرجع: ترويسة بارزة، بطاقات إحصاء، ثم جدول موحّد.

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

  const counters =
    state.kind === "loaded" ? reminderCounters(state.reminders) : null;

  return (
    <>
      <PageHeader
        title="تذكير الغد"
        description="لوحة عمليات: أرسل التذكير لكل مريض بواتساب أو انسخ نصّه — الرسالة عربية جاهزة برابط مباشر."
        actions={
          <Button
            shape="pill"
            onClick={() => void prepare()}
            loading={state.kind === "loading"}
          >
            <CalendarClock size={16} aria-hidden />
            تجهيز تذكيرات الغد
          </Button>
        }
      />

      <div className="mt-5">
        {state.kind === "error" ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-panel border border-danger-300 bg-danger-50 px-6 py-10 text-center"
          >
            <p className="text-sm font-medium text-danger-700">
              تعذر تجهيز قائمة التذكير — تحقق من الاتصال ثم أعد المحاولة.
            </p>
            <Button variant="secondary" size="sm" onClick={() => void prepare()}>
              إعادة المحاولة
            </Button>
          </div>
        ) : state.kind !== "loaded" ? (
          <EmptyState
            icon={CalendarPlus}
            title={
              state.kind === "loading"
                ? "جارٍ تجهيز تذكيرات الغد…"
                : "لم تُجهّز تذكيرات الغد بعد"
            }
            description="اضغط «تجهيز تذكيرات الغد» لجمع مواعيد الغد وتوليد رسالة عربية جاهزة لكل مريض مع رابط واتساب مباشر."
          />
        ) : state.reminders.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="لا مواعيد غداً"
            description="القائمة فارغة — احجز مواعيد الغد أولاً ثم أعد التجهيز."
          />
        ) : (
          <>
            {/* بطاقات الإحصاء: جاهز / أُرسل / متبقي */}
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                value={String(counters!.ready)}
                label="جاهز"
                icon={CalendarClock}
              />
              <StatCard
                value={String(counters!.sent)}
                label="أُرسل"
                icon={CheckCircle2}
              />
              <StatCard
                value={String(counters!.remaining)}
                label="متبقي"
                icon={Hourglass}
                tone="danger"
              />
            </div>

            {/* جدول التذكيرات — الشاشات المتوسطة فأعلى */}
            <Table className="mt-4 hidden md:table">
              <THead>
                <TRow>
                  <TH>المريض</TH>
                  <TH>الرسالة</TH>
                  <TH>حالة الموعد</TH>
                  <TH>الإرسال</TH>
                  <TH className="w-32">إجراءات</TH>
                </TRow>
              </THead>
              <tbody>
                {state.reminders.map((r) => (
                  <ReminderRow
                    key={r.appointmentId}
                    reminder={r}
                    variant="table"
                    copied={copiedId === r.appointmentId}
                    recordFailed={recordFailedId === r.appointmentId}
                    onSend={() => sendReminder(r)}
                    onCopy={() => copyMessage(r)}
                  />
                ))}
              </tbody>
            </Table>

            {/* بطاقات الموبايل */}
            <ul className="mt-4 flex flex-col gap-2 md:hidden">
              {state.reminders.map((r) => (
                <ReminderRow
                  key={r.appointmentId}
                  reminder={r}
                  variant="card"
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
    </>
  );
}

type ReminderRowProps = {
  reminder: ReminderJson;
  variant: "table" | "card";
  copied: boolean;
  recordFailed: boolean;
  onSend: () => void;
  onCopy: () => void;
};

/** شارة حالة الإرسال — أُرسل ناجحة، جاهز محايدة. */
function SendBadge({ sent }: { sent: boolean }) {
  return sent ? (
    <StatusPill tone="success">أُرسل</StatusPill>
  ) : (
    <Badge tone="neutral">جاهز</Badge>
  );
}

function ReminderRow({
  reminder,
  variant,
  copied,
  recordFailed,
  onSend,
  onCopy,
}: ReminderRowProps) {
  const subtitle = `${formatTime(reminder.startsAt)}${reminder.reason ? ` · ${reminder.reason}` : ""}`;

  const sendControls = reminder.whatsappUrl ? (
    <span className="flex items-center gap-1.5">
      {!reminder.sent && (
        <PillAction
          variant="success"
          href={reminder.whatsappUrl}
          onClick={onSend}
          target="_blank"
          rel="noopener noreferrer"
        >
          إرسال واتساب
        </PillAction>
      )}
      {reminder.sent && (
        <IconAction
          icon={MessageCircle}
          label="فتح واتساب مجدداً"
          href={reminder.whatsappUrl}
        />
      )}
      <IconAction
        icon={Copy}
        label={copied ? "تم نسخ النص" : "نسخ النص"}
        onClick={onCopy}
      />
    </span>
  ) : (
    <span className="text-xs text-warning-700">
      لا يوجد رقم هاتف — أضف الرقم في ملف المريض
    </span>
  );

  const recordFailedNote = recordFailed ? (
    <button
      type="button"
      onClick={onSend}
      className="text-warning-700 text-xs underline"
    >
      تعذر تسجيل الإرسال — سجّله يدوياً
    </button>
  ) : null;

  if (variant === "table") {
    return (
      <TRow>
        <TD>
          <EntityCell
            name={reminder.patientName}
            subtitle={subtitle}
            className="min-w-0"
          />
        </TD>
        <TD className="max-w-64">
          <p className="truncate text-xs text-warm-600" title={reminder.message}>
            {reminder.message}
          </p>
          {recordFailedNote}
        </TD>
        <TD>
          <StatusPill tone={STATUS_META[reminder.status].tone}>
            {STATUS_META[reminder.status].label}
          </StatusPill>
        </TD>
        <TD>
          <SendBadge sent={reminder.sent} />
        </TD>
        <TD>{sendControls}</TD>
      </TRow>
    );
  }

  return (
    <li className="rounded-panel border border-warm-200 bg-surface-raised p-4">
      <div className="flex items-center justify-between gap-2">
        <EntityCell
          name={reminder.patientName}
          subtitle={subtitle}
          className="min-w-0"
        />
        <SendBadge sent={reminder.sent} />
      </div>
      <p className="mt-2 rounded-field bg-surface-sunken px-3 py-2 text-xs leading-5 text-ink-900">
        {reminder.message}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusPill tone={STATUS_META[reminder.status].tone}>
          {STATUS_META[reminder.status].label}
        </StatusPill>
        {sendControls}
      </div>
      {recordFailedNote && <div className="mt-2">{recordFailedNote}</div>}
    </li>
  );
}

"use client";

import { useState } from "react";
import { ALLOWED_TRANSITIONS } from "@/lib/appointment-state";
import type { AppointmentStatus } from "@/lib/appointment-state";
import {
  STATUS_LABEL,
  STATUS_META,
  formatDayLabel,
  formatTime,
} from "@/lib/appointment-ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { StatusPill } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

// تفاصيل الموعد في لوحة جانبية — المعلومات كاملة، وانتقالات آلة الحالات
// فقط (المسموح بها، من lib/appointment-state). الإلغاء ولم-يحضر عمليتان
// حساستان: تأكيد صريح قبل التنفيذ، والنتيجة إشعار عابر.

export type AppointmentJson = {
  id: string;
  patientId: string;
  patientName: string;
  startsAt: string;
  durationMin: number;
  status: AppointmentStatus;
  reason: string | null;
  note: string | null;
};

type AppointmentDetailsDrawerProps = {
  appointment: AppointmentJson | null;
  onClose: () => void;
  /** يُستدعى بعد نجاح أي انتقال حالة لإعادة تحميل التقويم */
  onChanged: () => void;
};

export function AppointmentDetailsDrawer({
  appointment,
  onClose,
  onChanged,
}: AppointmentDetailsDrawerProps) {
  const { toast } = useToast();
  const [pending, setPending] = useState<AppointmentStatus | null>(null);
  const [confirming, setConfirming] = useState<AppointmentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!appointment) return null;

  const meta = STATUS_META[appointment.status];
  const nexts = ALLOWED_TRANSITIONS[appointment.status];
  const confirmedTarget = confirming;

  async function transition(to: AppointmentStatus) {
    if (!appointment) return;
    setPending(to);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "تعذر تغيير الحالة");
        return;
      }
      toast(`تم تحديث حالة الموعد إلى «${STATUS_LABEL(to)}»`);
      setConfirming(null);
      onChanged();
      onClose();
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setPending(null);
    }
  }

  function requestTransition(to: AppointmentStatus) {
    // العمليات الحساسة (إلغاء، لم يحضر) تمر بتأكيد صريح قبل التنفيذ.
    if (to === "CANCELLED" || to === "NO_SHOW") {
      setConfirming(to);
      return;
    }
    void transition(to);
  }

  return (
    <>
      <Drawer open onClose={onClose} title="تفاصيل الموعد">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-semibold text-ink-900">
              {appointment.patientName}
            </p>
            <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
          </div>

          <dl className="flex flex-col gap-2 rounded-panel border border-warm-200 bg-surface px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-warm-500">اليوم</dt>
              <dd className="font-medium text-ink-900">
                {formatDayLabel(new Date(`${appointment.startsAt.slice(0, 10)}T00:00:00`))}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-warm-500">الوقت</dt>
              <dd className="numeric font-medium text-ink-900">
                {formatTime(appointment.startsAt)} · {appointment.durationMin} دقيقة
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-warm-500">السبب</dt>
              <dd className="font-medium text-ink-900">
                {appointment.reason || "بدون سبب محدد"}
              </dd>
            </div>
            {appointment.note && (
              <div className="flex items-start justify-between gap-3">
                <dt className="shrink-0 text-warm-500">ملاحظة</dt>
                <dd className="text-start text-ink-900">{appointment.note}</dd>
              </div>
            )}
          </dl>

          {nexts.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-warm-600">
                تعديل الحالة
              </p>
              <div className="flex flex-wrap gap-2">
                {nexts.map((to) => (
                  <Button
                    key={to}
                    size="sm"
                    variant={
                      to === "CANCELLED" || to === "NO_SHOW"
                        ? "danger"
                        : "secondary"
                    }
                    loading={pending === to}
                    disabled={pending !== null && pending !== to}
                    onClick={() => requestTransition(to)}
                  >
                    {STATUS_LABEL(to)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {nexts.length === 0 && (
            <p className="rounded-field border border-warm-200 bg-surface-sunken px-3 py-2 text-xs text-warm-600">
              هذه الحالة نهائية — لا انتقالات أخرى مسموحة.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-field border border-danger-300 bg-danger-50 px-3 py-2 text-xs text-danger-700"
            >
              {error}
            </p>
          )}
        </div>
      </Drawer>

      {confirmedTarget && (
        <ConfirmDialog
          open
          onClose={() => setConfirming(null)}
          title={
            confirmedTarget === "CANCELLED"
              ? "تأكيد إلغاء الموعد"
              : "تأكيد تسجيل عدم الحضور"
          }
          description={
            confirmedTarget === "CANCELLED"
              ? `سيُلغى موعد ${appointment.patientName} ويُفتح وقته في الجدول. لا يمكن التراجع عن الإلغاء.`
              : `سيُسجَّل أن ${appointment.patientName} لم يحضر هذا الموعد. لا يمكن التراجع.`
          }
          confirmLabel={
            confirmedTarget === "CANCELLED" ? "تأكيد الإلغاء" : "تأكيد عدم الحضور"
          }
          loading={pending === confirmedTarget}
          onConfirm={() => void transition(confirmedTarget)}
        />
      )}
    </>
  );
}

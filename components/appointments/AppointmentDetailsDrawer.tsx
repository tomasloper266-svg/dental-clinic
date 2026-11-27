"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { ALLOWED_TRANSITIONS } from "@/lib/appointment-state";
import type { AppointmentStatus } from "@/lib/appointment-state";
import { doctorDisplayName } from "@/lib/staff-name";
import { STATUS_META, formatDayLabel, formatTime } from "@/lib/appointment-ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { StatusPill } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/components/i18n/I18nProvider";

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
  // الطبيب المسند — اختياري (كل الأطباء = null)
  staffId: string | null;
  staffName: string | null;
};

type AppointmentDetailsDrawerProps = {
  appointment: AppointmentJson | null;
  onClose: () => void;
  /** يُستدعى بعد نجاح أي انتقال حالة لإعادة تحميل التقويم */
  onChanged: () => void;
};

/** نتيجة تعبئة الفجوة تلقائياً — تأتي من استجابة PATCH الحالة (waitlistFill). */
type WaitlistFillJson = {
  waitlistEntryId: string;
  patientId: string;
  patientName: string;
  appointmentId: string;
  startsAt: string;
  durationMin: number;
};

export function AppointmentDetailsDrawer({
  appointment,
  onClose,
  onChanged,
}: AppointmentDetailsDrawerProps) {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const [pending, setPending] = useState<AppointmentStatus | null>(null);
  const [confirming, setConfirming] = useState<AppointmentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fill, setFill] = useState<WaitlistFillJson | null>(null);
  const [undoing, setUndoing] = useState(false);

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
        setError(data.error ?? t("drawer.error.status"));
        return;
      }
      const data = (await res.json()) as {
        waitlistFill?: WaitlistFillJson | null;
      };
      if (data.waitlistFill) {
        // حجز تلقائي لمنتظر في الفجوة — تبقى اللوحة مفتوحة لعرض النتيجة
        // وزر التراجع بضغطة بدل إغلاقها فوراً.
        setFill(data.waitlistFill);
        toast(
          t("drawer.fillToast", {
            name: data.waitlistFill.patientName,
            time: formatTime(data.waitlistFill.startsAt, locale),
          }),
        );
      } else {
        toast(t("drawer.statusToast", { label: t(STATUS_META[to].labelKey) }));
      }
      setConfirming(null);
      onChanged();
      if (!data.waitlistFill) onClose();
    } catch {
      setError(t("common.error.network"));
    } finally {
      setPending(null);
    }
  }

  async function undoFill() {
    if (!fill) return;
    setUndoing(true);
    setError(null);
    try {
      const res = await fetch("/api/waitlist/auto-fill/undo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filledAppointmentId: fill.appointmentId,
          waitlistEntryId: fill.waitlistEntryId,
          sourceAppointmentId: appointment?.id,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? t("drawer.error.undo"));
        return;
      }
      toast(
        t("drawer.undoToast", {
          patient: appointment?.patientName ?? "",
          name: fill.patientName,
        }),
      );
      setFill(null);
      onChanged();
    } catch {
      setError(t("common.error.network"));
    } finally {
      setUndoing(false);
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
      <Drawer open onClose={onClose} title={t("drawer.title")}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-ink-900 text-base font-semibold">
              {appointment.patientName}
            </p>
            <StatusPill tone={meta.tone}>{t(meta.labelKey)}</StatusPill>
          </div>

          <dl className="rounded-panel border-warm-200 bg-surface flex flex-col gap-2 border px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-warm-500">{t("drawer.day")}</dt>
              <dd className="text-ink-900 font-medium">
                {formatDayLabel(
                  new Date(`${appointment.startsAt.slice(0, 10)}T00:00:00`),
                  locale,
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-warm-500">{t("drawer.time")}</dt>
              <dd className="numeric text-ink-900 font-medium">
                {formatTime(appointment.startsAt, locale)} ·{" "}
                {t("timeline.duration", { minutes: appointment.durationMin })}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-warm-500">{t("drawer.reason")}</dt>
              <dd className="text-ink-900 font-medium">
                {appointment.reason || t("drawer.noReason")}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-warm-500">{t("drawer.doctor")}</dt>
              <dd className="text-ink-900 font-medium">
                {appointment.staffName
                  ? doctorDisplayName(appointment.staffName)
                  : t("drawer.noDoctor")}
              </dd>
            </div>
            {appointment.note && (
              <div className="flex items-start justify-between gap-3">
                <dt className="text-warm-500 shrink-0">{t("drawer.note")}</dt>
                <dd className="text-ink-900 text-start">{appointment.note}</dd>
              </div>
            )}
          </dl>

          {nexts.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-warm-600 text-xs font-semibold">
                {t("drawer.changeStatus")}
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
                    {t(STATUS_META[to].labelKey)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {nexts.length === 0 && (
            <p className="rounded-field border-warm-200 bg-surface-sunken text-warm-600 border px-3 py-2 text-xs">
              {t("drawer.finalStatus")}
            </p>
          )}

          {fill && (
            <div
              role="status"
              className="rounded-field border-primary-200 bg-primary-50 flex flex-col gap-2 border px-3 py-2.5 text-sm"
            >
              <p className="text-primary-800">
                {t("drawer.fillNotice", {
                  name: fill.patientName,
                  time: formatTime(fill.startsAt, locale),
                  minutes: fill.durationMin,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={undoing}
                  disabled={pending !== null}
                  onClick={() => void undoFill()}
                >
                  <Undo2 size={14} aria-hidden />
                  {t("drawer.undoFill")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setFill(null);
                    onClose();
                  }}
                  disabled={undoing}
                >
                  {t("drawer.ok")}
                </Button>
              </div>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-field border-danger-300 bg-danger-50 text-danger-700 border px-3 py-2 text-xs"
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
              ? t("drawer.confirmCancelTitle")
              : t("drawer.confirmNoShowTitle")
          }
          description={
            confirmedTarget === "CANCELLED"
              ? t("drawer.confirmCancelDesc", {
                  patient: appointment.patientName,
                })
              : t("drawer.confirmNoShowDesc", {
                  patient: appointment.patientName,
                })
          }
          confirmLabel={
            confirmedTarget === "CANCELLED"
              ? t("drawer.confirmCancel")
              : t("drawer.confirmNoShow")
          }
          loading={pending === confirmedTarget}
          onConfirm={() => void transition(confirmedTarget)}
        />
      )}
    </>
  );
}

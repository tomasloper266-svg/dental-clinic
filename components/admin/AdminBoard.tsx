"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { formatDate as formatDateLocale } from "@/lib/i18n/format";
import type { Locale, T } from "@/lib/i18n/core";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { StatusPill, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TD, TH, THead, TRow } from "@/components/ui/Table";
import { cn } from "@/components/ui/cn";
import { ManualActivationCard } from "./ManualActivationCard";

export type AdminClinicRow = {
  id: string;
  name: string;
  owner: string;
  ownerPhone: string;
  registeredAt: string;
  patients: number;
  status: "ACTIVE" | "EXPIRED";
  isTrial: boolean;
  daysLeft: number;
  endsAtIso: string;
};

export type AdminPaymentRow = {
  id: string;
  clinicName: string;
  plan: "MONTHLY" | "YEARLY";
  planLabel: string;
  amountUsd: number;
  transferRef: string;
  createdAt: string;
};

type AdminBoardProps = {
  clinics: AdminClinicRow[];
  pendingPayments: AdminPaymentRow[];
};

const DATE_FORMAT_OPTS: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeZone: "UTC",
};

function formatDate(iso: string, locale: Locale): string {
  return formatDateLocale(new Date(iso), locale, DATE_FORMAT_OPTS);
}

function statusTone(row: AdminClinicRow): BadgeTone {
  return row.status === "EXPIRED" ? "danger" : "success";
}

function statusLabel(row: AdminClinicRow, t: T): string {
  if (row.status === "EXPIRED") return t("admin.expiredBlock");
  if (row.isTrial) {
    return row.daysLeft <= 0
      ? t("admin.trialEndsToday")
      : t("admin.trialDaysLeft", { days: row.daysLeft });
  }
  return row.daysLeft <= 0
    ? t("admin.subEndsToday")
    : t("admin.subDaysLeft", { days: row.daysLeft });
}

/**
 * لوحة إدارة المنصة: العيادات بحالتها وطلبات التفعيل المعلقة بأزرار
 * اعتماد/رفض مع سبب اختياري. القرار يمر عبر API الجلسة الإدارية حصراً.
 */
export function AdminBoard({ clinics, pendingPayments }: AdminBoardProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [deciding, setDeciding] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function decide(paymentId: string, decision: "APPROVED" | "REJECTED") {
    if (deciding) return;
    setDeciding(paymentId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: notes[paymentId] || undefined }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? t("api.billing.decisionFailed"));
        return;
      }
      router.refresh();
    } catch {
      setError(t("errors.offline"));
    } finally {
      setDeciding(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="font-display text-2xl font-normal text-ink-900">
          {t("admin.platformBoard")}
        </h1>
        <p className="mt-1 text-sm text-steel-600">
          {t("admin.boardHint")}
        </p>
      </div>

      {/* طلبات التفعيل المعلقة */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("admin.pendingRequestsCount")}{pendingPayments.length})
          </CardTitle>
        </CardHeader>
        <CardBody>
          {error && (
            <p role="alert" className="mb-3 text-sm font-medium text-danger-600">
              {error}
            </p>
          )}
          {pendingPayments.length === 0 ? (
            <EmptyState
              title={t("admin.noPendingRequests")}
              description={t("admin.pendingHint")}
            />
          ) : (
            <ul className="space-y-3">
              {pendingPayments.map((payment) => (
                <li
                  key={payment.id}
                  className="rounded-field border border-warm-200 bg-surface p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink-900">
                        {payment.clinicName} {t("subscription.planSuffix")} {payment.planLabel} ({payment.amountUsd}$)
                      </p>
                      <p className="mt-1 text-sm text-steel-600">
                        {t("subscription.transferRef")}{" "}
                        <span dir="ltr" className="select-all font-bold">
                          {payment.transferRef}
                        </span>{" "}
                        — {formatDate(payment.createdAt, locale)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={notes[payment.id] ?? ""}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [payment.id]: e.target.value }))
                        }
                        placeholder={t("appointments.reasonOptional")}
                        className="w-40 rounded-field border border-warm-300 bg-surface-raised px-3 py-1.5 text-sm"
                      />
                      <Button
                        onClick={() => decide(payment.id, "APPROVED")}
                        disabled={deciding !== null}
                      >
                        {t("admin.approve")}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => decide(payment.id, "REJECTED")}
                        disabled={deciding !== null}
                      >
                        {t("admin.reject")}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* العيادات المسجلة */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.clinicsCount")}{clinics.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {clinics.length === 0 ? (
            <EmptyState title={t("admin.noClinics")} description={t("admin.noClinicsYet")} />
          ) : (
            <Table>
              <THead>
                <TRow>
                  <TH>{t("common.clinic")}</TH>
                  <TH>{t("admin.owner")}</TH>
                  <TH>{t("common.registration")}</TH>
                  <TH>{t("common.patients")}</TH>
                  <TH>{t("common.status")}</TH>
                  <TH>{t("subscription.endsOn")}</TH>
                </TRow>
              </THead>
              <tbody>
                {clinics.map((clinic) => (
                  <TRow key={clinic.id}>
                    <TD className="font-semibold text-ink-900">{clinic.name}</TD>
                    <TD>{clinic.owner}</TD>
                    <TD>{formatDate(clinic.registeredAt, locale)}</TD>
                    <TD>{clinic.patients}</TD>
                    <TD>
                      <StatusPill tone={statusTone(clinic)}>
                        {statusLabel(clinic, t)}
                      </StatusPill>
                    </TD>
                    <TD className={cn(clinic.status === "EXPIRED" && "text-danger-600")}>
                      {formatDate(clinic.endsAtIso, locale)}
                    </TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* التفعيل اليدوي بلا دفع — يضبط نهاية الاشتراك مباشرة بجلسة الإدارة */}
      <ManualActivationCard clinics={clinics} />
    </main>
  );
}

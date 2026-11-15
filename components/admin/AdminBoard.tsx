"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

const DATE_FORMAT = new Intl.DateTimeFormat("ar", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

function statusTone(row: AdminClinicRow): BadgeTone {
  return row.status === "EXPIRED" ? "danger" : "success";
}

function statusLabel(row: AdminClinicRow): string {
  if (row.status === "EXPIRED") return "منتهية — الدخول ممنوع";
  if (row.isTrial) {
    return row.daysLeft <= 0
      ? "تجربة — تنتهي اليوم"
      : `تجربة — ${row.daysLeft} يوم متبقٍ`;
  }
  return row.daysLeft <= 0
    ? "مشترك — ينتهي اليوم"
    : `مشترك — ${row.daysLeft} يوم متبقٍ`;
}

/**
 * لوحة إدارة المنصة: العيادات بحالتها وطلبات التفعيل المعلقة بأزرار
 * اعتماد/رفض مع سبب اختياري. القرار يمر عبر API الجلسة الإدارية حصراً.
 */
export function AdminBoard({ clinics, pendingPayments }: AdminBoardProps) {
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
        setError(data?.error ?? "تعذر تنفيذ القرار — أعد المحاولة");
        return;
      }
      router.refresh();
    } catch {
      setError("لا يوجد اتصال — تحقق من الشبكة وأعد المحاولة");
    } finally {
      setDeciding(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="font-display text-2xl font-normal text-ink-900">
          لوحة إدارة المنصة
        </h1>
        <p className="mt-1 text-sm text-steel-600">
          العيادات المسجلة وحالتها، وطلبات تفعيل اشتراكات شام كاش.
        </p>
      </div>

      {/* طلبات التفعيل المعلقة */}
      <Card>
        <CardHeader>
          <CardTitle>
            طلبات التفعيل المعلقة ({pendingPayments.length})
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
              title="لا طلبات معلقة"
              description="ستظهر هنا حوالات شام كاش التي يرفعها أصحاب العيادات بانتظار التأكيد."
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
                        {payment.clinicName} — باقة {payment.planLabel} ({payment.amountUsd}$)
                      </p>
                      <p className="mt-1 text-sm text-steel-600">
                        رقم الحوالة:{" "}
                        <span dir="ltr" className="select-all font-bold">
                          {payment.transferRef}
                        </span>{" "}
                        — {formatDate(payment.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={notes[payment.id] ?? ""}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [payment.id]: e.target.value }))
                        }
                        placeholder="سبب (اختياري)"
                        className="w-40 rounded-field border border-warm-300 bg-surface-raised px-3 py-1.5 text-sm"
                      />
                      <Button
                        onClick={() => decide(payment.id, "APPROVED")}
                        disabled={deciding !== null}
                      >
                        اعتماد
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => decide(payment.id, "REJECTED")}
                        disabled={deciding !== null}
                      >
                        رفض
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
          <CardTitle>العيادات ({clinics.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {clinics.length === 0 ? (
            <EmptyState title="لا عيادات" description="لم تُسجل أي عيادة بعد." />
          ) : (
            <Table>
              <THead>
                <TRow>
                  <TH>العيادة</TH>
                  <TH>صاحبها</TH>
                  <TH>التسجيل</TH>
                  <TH>المرضى</TH>
                  <TH>الحالة</TH>
                  <TH>تنتهي</TH>
                </TRow>
              </THead>
              <tbody>
                {clinics.map((clinic) => (
                  <TRow key={clinic.id}>
                    <TD className="font-semibold text-ink-900">{clinic.name}</TD>
                    <TD>{clinic.owner}</TD>
                    <TD>{formatDate(clinic.registeredAt)}</TD>
                    <TD>{clinic.patients}</TD>
                    <TD>
                      <StatusPill tone={statusTone(clinic)}>
                        {statusLabel(clinic)}
                      </StatusPill>
                    </TD>
                    <TD className={cn(clinic.status === "EXPIRED" && "text-danger-600")}>
                      {formatDate(clinic.endsAtIso)}
                    </TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </main>
  );
}

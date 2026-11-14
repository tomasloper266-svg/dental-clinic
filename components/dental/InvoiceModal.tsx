"use client";

import { useState } from "react";
import { Printer, CircleDollarSign } from "lucide-react";
import { toothLabelAr } from "@/lib/odontogram/fdi";
import type { LedgerEntryDto } from "@/lib/services/ledger";
import type { PlanItemDto } from "@/lib/services/treatment-plan";
import { planStatusMeta } from "@/lib/treatment-plan-view";
import { formatWeekdayDateCell } from "@/lib/dates";
import {
  INVOICE_STATUS_LABELS,
  type DetailedInvoiceView,
} from "@/lib/patient-finance";
import { INVOICE_STATUS_TONE } from "@/lib/invoices-view";
import { useMoney } from "@/components/ui/CurrencyContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/Badge";
import SettlePaymentModal from "@/components/finance/SettlePaymentModal";
import { ToothIcon } from "@/components/shell/icons/ToothIcon";

// تفاصيل الفاتورة المشتقة من الدفتر — بنودها قيود الرسوم المربوطة بعناصر
// الخطة، والدفعات المسجلة مخصصة لها بالتسلسل. التسديد عبر مسار الدفتر القائم.

type Props = {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  invoice: DetailedInvoiceView;
  /** قيود الرسوم التابعة لهذه الفاتورة — لعرض بنودها */
  charges: LedgerEntryDto[];
  planItems: PlanItemDto[];
  usdRate: number;
  onLedgerChanged: () => void;
  /** فتح نموذج التسديد خارج النافذة — يلغي النموذج المدمج عند تمريره */
  onSettle?: () => void;
  /** سطر المرافق من سجل المريض — يظهر في شريط الفاتورة عند وجوده */
  companionLine?: string | null;
};

export default function InvoiceModal({
  open,
  onClose,
  patientId,
  patientName,
  invoice,
  charges,
  planItems,
  usdRate,
  onLedgerChanged,
  onSettle,
  companionLine,
}: Props) {
  // المبالغ المعروضة تمر عبر سياق العملة — USD/SYP من الإعدادات يغيّرها كلها.
  const money = useMoney();
  const [settleOpen, setSettleOpen] = useState(false);

  function itemFor(charge: LedgerEntryDto): PlanItemDto | null {
    const linked = charge.treatmentItemId;
    return linked
      ? (planItems.find((item) => item.id === linked) ?? null)
      : null;
  }

  const itemStatus = (charge: LedgerEntryDto) => {
    const item = itemFor(charge);
    return item ? planStatusMeta(item.status) : null;
  };

  const toothText = (charge: LedgerEntryDto) => {
    const item = itemFor(charge);
    return item && item.toothFdi > 0 ? toothLabelAr(item.toothFdi) : "—";
  };

  const itemText = (charge: LedgerEntryDto) => {
    const item = itemFor(charge);
    return item ? item.procedure : (charge.note ?? "—");
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`الفاتورة ${invoice.number}`}
        className="max-w-2xl"
      >
        {/* شريط الفاتورة — المريض والتاريخ يميناً، والرقم والحالة يساراً */}
        <div className="bg-warning-500/5 border-warning-200 mt-1 flex items-start justify-between gap-3 rounded-field border px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-ink-900 truncate text-sm font-bold">{patientName}</p>
            <p className="numeric text-steel-500 mt-0.5 text-xs">
              فاتورة عيادة أسنان — {formatWeekdayDateCell(invoice.date)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <StatusPill tone={INVOICE_STATUS_TONE[invoice.status]}>
                {INVOICE_STATUS_LABELS[invoice.status]}
              </StatusPill>
              <span className="numeric text-warning-600 text-sm font-bold">
                {invoice.number}
              </span>
            </div>
            {companionLine && (
              <p className="text-steel-500 text-xs">{companionLine}</p>
            )}
          </div>
        </div>

        <div className="rounded-field border-warm-200 mt-3 border">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-warm-200 text-steel-500 border-b text-xs">
                <th className="px-3 py-2 text-start font-medium">البند</th>
                <th className="px-3 py-2 text-start font-medium">السن</th>
                <th className="px-3 py-2 text-start font-medium">المبلغ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {charges.map((charge) => {
                const status = itemStatus(charge);
                return (
                  <tr key={charge.id}>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        {itemText(charge)}
                        {status && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.toneClass}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {status.labelAr}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-steel-600">{toothText(charge)}</td>
                    <td className="numeric px-3 py-2.5 font-semibold">
                      {money(charge.amountSyp)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="border-warm-200 divide-y divide-warm-100 border-t px-3">
            <SummaryRow
              label="المجموع"
              value={money(invoice.totalSyp)}
            />
            <SummaryRow
              label="الخصم"
              value={money(invoice.discountSyp)}
            />
            <SummaryRow
              label="الإجمالي"
              value={money(invoice.totalSyp - invoice.discountSyp)}
              tone="gold"
              emphasis
            />
            <SummaryRow
              label="المسدد"
              value={money(invoice.paidSyp)}
              tone="success"
            />
            <SummaryRow
              label="المتبقي"
              value={money(invoice.remainingSyp)}
              tone="danger"
              emphasis
            />
          </div>
        </div>

        {/* الدفعات المسجلة — مخصصة لهذه الفاتورة */}
        <section className="mt-4">
          <h3 className="text-ink-900 inline-flex items-center gap-1.5 text-sm font-semibold">
            <CircleDollarSign size={16} className="text-warning-500" aria-hidden />
            الدفعات المسجلة
          </h3>
          {invoice.payments.length === 0 ? (
            <div className="flex flex-col items-center py-6">
              <ToothIcon className="text-warning-500 h-8 w-8" aria-hidden />
              <p className="text-steel-500 mt-2 text-sm">لا دفعات بعد</p>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-warm-100">
              {invoice.payments.map((payment, index) => (
                <li
                  key={`${payment.date}-${index}`}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="text-steel-600">{payment.note || "دفعة"}</span>
                  <span className="numeric font-medium">
                    {money(payment.amountSyp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="border-warm-200 mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={15} aria-hidden />
            طباعة الإيصال
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => (onSettle ? onSettle() : setSettleOpen(true))}
              disabled={invoice.remainingSyp <= 0}
            >
              <CircleDollarSign size={15} aria-hidden />
              تسديد دفعة
            </Button>
            <Button variant="secondary" onClick={onClose}>
              إغلاق
            </Button>
          </div>
        </footer>
      </Modal>

      {!onSettle && (
        <SettlePaymentModal
          open={settleOpen}
          onClose={() => setSettleOpen(false)}
          onSaved={() => {
            setSettleOpen(false);
            onLedgerChanged();
          }}
          patientId={patientId}
          patientName={patientName}
          dueSyp={invoice.remainingSyp}
          usdRate={usdRate}
        />
      )}
    </>
  );
}

function SummaryRow({
  label,
  value,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  tone?: "gold" | "success" | "danger";
  emphasis?: boolean;
}) {
  const toneClass =
    tone === "gold"
      ? "text-warning-500"
      : tone === "success"
        ? "text-success-600"
        : tone === "danger"
          ? "text-danger-600"
          : "text-ink-900";
  return (
    <div className="flex items-center justify-between py-2">
      <span
        className={`text-sm ${emphasis ? "text-ink-900 font-semibold" : "text-steel-600"}`}
      >
        {label}
      </span>
      <span className={`numeric text-sm font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

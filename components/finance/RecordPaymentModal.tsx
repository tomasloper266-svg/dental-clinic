"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { sypToUsd, usdToSyp } from "@/lib/currency";
import { toDateInputValue } from "@/lib/dates";
import {
  composePaymentNote,
  formatUsdSpaced,
  PAYMENT_METHOD_OPTIONS,
  type ClinicInvoiceRow,
  type PaymentMethod,
} from "@/lib/invoices-view";
import type { PatientDto } from "@/lib/services/patients";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

// نموذج «تسديد دفعة» — يسجل قيد دفعة (PAYMENT) عبر مسار الدفتر القائم
// (POST /api/patients/:id/ledger). «على الفاتورة» خياران: دفعة على حساب
// المريض (بدون فوترة) أو سداد فاتورة معلقة، وطريقة الدفع والتاريخ يُضمَّنان
// في بيان القيد والتاريخ (createdAt) دون أي تغيير في المخطط.

type Props = {
  onClose: () => void;
  onSaved: () => void;
  /** سعر الصرف المعتمد للتحويل إلى الليرة عند التسجيل */
  usdRate: number;
  patients: PatientDto[];
  /** فواتير العيادة كلها — لبناء قائمة الفواتير المعلقة لكل مريض */
  invoices: ClinicInvoiceRow[];
  /** تعبئة مسبقة — من زر التسديد في صف الجدول */
  initialPatientId?: string | null;
  initialChargeId?: string | null;
  /** تعبئة مبلغ مسبق من رصيد المريض — من صفحة المستحقات دون فاتورة محددة */
  initialDueSyp?: number;
};

export default function RecordPaymentModal({
  onClose,
  onSaved,
  usdRate,
  patients,
  invoices,
  initialPatientId,
  initialChargeId,
  initialDueSyp,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const initialInvoice = useMemo(
    () => invoices.find((row) => row.chargeId === initialChargeId) ?? null,
    [invoices, initialChargeId],
  );

  const [patientId, setPatientId] = useState(
    initialInvoice?.patientId ?? initialPatientId ?? patients[0]?.id ?? "",
  );
  const [chargeId, setChargeId] = useState(initialInvoice?.chargeId ?? "");
  const [amountStr, setAmountStr] = useState(() => {
    if (initialInvoice && initialInvoice.remainingSyp > 0) {
      return String(
        Math.round(sypToUsd(initialInvoice.remainingSyp, usdRate) * 100) / 100,
      );
    }
    if (initialDueSyp !== undefined && initialDueSyp > 0) {
      return String(Math.round(sypToUsd(initialDueSyp, usdRate) * 100) / 100);
    }
    return "";
  });
  const [method, setMethod] = useState<PaymentMethod>("نقدا");
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // فواتير المريض المختار التي عليها متبقٍ — خيارات «على الفاتورة» بعد
  // خيار الحساب (بدون فوترة) الذي يبقى اختياراً صالحاً دائماً
  const outstanding = useMemo(
    () =>
      invoices.filter(
        (row) => row.patientId === patientId && row.remainingSyp > 0,
      ),
    [invoices, patientId],
  );

  const selectedInvoice = useMemo(
    () => outstanding.find((row) => row.chargeId === chargeId) ?? null,
    [outstanding, chargeId],
  );

  const amount = Number(amountStr);
  const dateIso = date ? new Date(`${date}T12:00:00`) : null;
  const futureDate =
    dateIso !== null && dateIso.getTime() > Date.now() + 60_000;

  /**
   * نقي — بيان الدفعة: مع الفاتورة يُذكر رقمها، وبدونها فالدفعة على حساب
   * المريض (بدون فوترة) — وكلاهما يمر عبر composePaymentNote نفسها.
   */
  function paymentBaseNote(): string {
    const parts = [
      notes.trim(),
      selectedInvoice
        ? `سداد الفاتورة ${selectedInvoice.number}`
        : "على الحساب (بدون فوترة)",
    ];
    return parts.filter(Boolean).join(" — ");
  }

  function validate(): string | null {
    if (!patientId) return "اختر المريض";
    if (!Number.isFinite(amount) || amount <= 0)
      return "المبلغ يجب أن يكون رقماً موجباً";
    if (!dateIso || Number.isNaN(dateIso.getTime())) return "التاريخ غير صالح";
    if (futureDate) return "لا يمكن تسجيل الدفعة بتاريخ مستقبلي";
    return null;
  }

  async function submit() {
    const validationError = validate();
    if (validationError || !dateIso) {
      setError(validationError ?? "التاريخ غير صالح");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/patients/${encodeURIComponent(patientId)}/ledger`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: "PAYMENT",
            amountSyp: -usdToSyp(amount, usdRate),
            note: composePaymentNote(method, paymentBaseNote()),
            createdAt: dateIso.toISOString(),
          }),
        },
      );
      const data = (await res.json()) as { entry?: object; error?: string };
      if (!res.ok || !data.entry) {
        setError(data.error ?? "تعذر تسجيل الدفعة، أعد المحاولة");
        return;
      }
      toast("سُجّلت الدفعة في الدفتر");
      onSaved();
      router.refresh();
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
      title="تسديد دفعة"
      titleClassName="font-display text-lg text-warning-600"
      className="max-w-lg"
      footer={
        <>
          <Button variant="gold" loading={saving} onClick={() => void submit()}>
            تسجيل الدفعة
          </Button>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      {/* عمودان — على شكل المرجع: المريض/المبلغ/التاريخ يميناً،
          على الفاتورة/طريقة الدفع/ملاحظات يساراً */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="المريض *" htmlFor="pay-patient">
          <Select
            id="pay-patient"
            value={patientId}
            onChange={(e) => {
              setPatientId(e.target.value);
              setChargeId("");
            }}
          >
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="على الفاتورة"
          htmlFor="pay-invoice"
          hint={
            patients.length > 0 && outstanding.length === 0
              ? "لا فواتير معلقة — الدفعة تُقيَّد على الحساب"
              : undefined
          }
        >
          <Select
            id="pay-invoice"
            value={chargeId}
            onChange={(e) => setChargeId(e.target.value)}
          >
            <option value="">فواتير على الحساب (بدون فوترة)</option>
            {outstanding.map((row) => (
              <option key={row.chargeId} value={row.chargeId}>
                {row.number} — متبقى {formatUsdSpaced(
                  sypToUsd(row.remainingSyp, usdRate),
                )}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="المبلغ *"
          htmlFor="pay-amount"
          hint={
            selectedInvoice
              ? `المتبقي على الفاتورة: ${formatUsdSpaced(
                  sypToUsd(selectedInvoice.remainingSyp, usdRate),
                )}`
              : undefined
          }
        >
          <div className="relative">
            <span className="text-steel-500 pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm">
              $
            </span>
            <Input
              id="pay-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="numeric pe-7"
            />
          </div>
        </Field>

        <Field label="طريقة الدفع" htmlFor="pay-method">
          <Select
            id="pay-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          >
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="التاريخ" htmlFor="pay-date" error={futureDate ? "لا يمكن تسجيل الدفعة بتاريخ مستقبلي" : undefined}>
          <Input
            id="pay-date"
            type="date"
            value={date}
            max={toDateInputValue(new Date())}
            onChange={(e) => setDate(e.target.value)}
            className="numeric"
          />
        </Field>

        <Field label="ملاحظات" htmlFor="pay-notes">
          <Textarea
            id="pay-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظة اختيارية…"
            className="min-h-10"
          />
        </Field>

        {error && (
          <p role="alert" className="text-xs text-danger-600 sm:col-span-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

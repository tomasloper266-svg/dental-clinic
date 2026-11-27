"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { roundUsd2, sypToUsd, usdToSyp } from "@/lib/currency";
import { useDisplayCurrency, useMoney } from "@/components/ui/CurrencyContext";
import {
  isDateInputFuture,
  parseDateInputValue,
  toDateInputValue,
} from "@/lib/dates";
import {
  buildPaymentBody,
  composePaymentNote,
  PAYMENT_METHOD_OPTIONS,
  type ClinicInvoiceRow,
  type PaymentMethod,
} from "@/lib/invoices-view";
import type { PatientDto } from "@/lib/services/patients";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { emitLedgerChanged } from "@/lib/ledger-events";
import type { TranslationKey } from "@/lib/i18n/core";

// طريقة الدفع قيمة بيانات كانونية تُرسل كما هي في بيان القيد — التسمية وحدها تُترجم عند العرض
const PAYMENT_METHOD_LABEL_KEYS: Record<PaymentMethod, TranslationKey> = {
  "نقدا": "finance.cash",
  "شيك": "finance.methodCheck",
  "تحويل": "finance.methodTransfer",
  "بطاقة": "finance.methodCard",
};

// نموذج «تسديد دفعة» — يسجل قيد دفعة (PAYMENT) عبر مسار الدفتر القائم
// (POST /api/patients/:id/ledger). «على الفاتورة» خياران: دفعة على حساب
// المريض (بدون فوترة) أو سداد فاتورة معلقة، ومعرّف الفاتورة المختار يُرسل
// في الجسم فعلياً (appliedChargeId — ترشيح عرض حصراً) مع طريقة الدفع والتاريخ
// في بيان القيد والتاريخ (createdAt)، دون أي تغيير في معادلة الرصيد.

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
  initialDueUsd?: number;
};

export default function RecordPaymentModal({
  onClose,
  onSaved,
  usdRate,
  patients,
  invoices,
  initialPatientId,
  initialChargeId,
  initialDueUsd,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const { toast } = useToast();
  // وحدة الحقل تتبع العملة المعروضة — بالدولار يُحوَّل إلى الليرة عند
  // التسجيل، وبالليرة يُقيَّد المبلغ كما هو دون تحويل.
  const currency = useDisplayCurrency();
  const money = useMoney();
  const isUsdInput = currency === "USD";
  // المخزن الآن دولار: بإدخال الدولار يُقيَّد كما هو (بمنزلتين)، وبالليرة
  // يُقسم على السعر عند التسجيل. العرض بالمقلوب: الليرة تُشتق بالضرب.
  const toDisplayAmount = (usd: number) =>
    isUsdInput ? usd : usdToSyp(usd, usdRate);
  const fromDisplayAmount = (display: number) =>
    isUsdInput
      ? roundUsd2(display)
      : roundUsd2(sypToUsd(display, usdRate));

  const initialInvoice = useMemo(
    () => invoices.find((row) => row.chargeId === initialChargeId) ?? null,
    [invoices, initialChargeId],
  );

  const [patientId, setPatientId] = useState(
    initialInvoice?.patientId ?? initialPatientId ?? patients[0]?.id ?? "",
  );
  const [chargeId, setChargeId] = useState(initialInvoice?.chargeId ?? "");
  const [amountStr, setAmountStr] = useState(() => {
    if (initialInvoice && initialInvoice.remainingUsd > 0) {
      return String(
        Math.round(toDisplayAmount(initialInvoice.remainingUsd) * 100) / 100,
      );
    }
    if (initialDueUsd !== undefined && initialDueUsd > 0) {
      return String(
        Math.round(toDisplayAmount(initialDueUsd) * 100) / 100,
      );
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
        (row) => row.patientId === patientId && row.remainingUsd > 0,
      ),
    [invoices, patientId],
  );

  const selectedInvoice = useMemo(
    () => outstanding.find((row) => row.chargeId === chargeId) ?? null,
    [outstanding, chargeId],
  );

  const amount = Number(amountStr);
  // التاريخ يوم بيوم بلا مكوّن وقت (الخطأ 15): «اليوم» يُقبل أي كانت الساعة
  // ولحظة التخزين منتصف ليل UTC فتبقى ماضية أي كانت ساعة الإدخال.
  const dateIso = date ? parseDateInputValue(date) : null;
  const futureDate = dateIso !== null && isDateInputFuture(date, new Date());

  /**
   * نقي — بيان الدفعة: مع الفاتورة يُذكر رقمها، وبدونها فالدفعة على حساب
   * المريض (بدون فوترة) — وكلاهما يمر عبر composePaymentNote نفسها.
   */
  function paymentBaseNote(): string {
    const parts = [
      notes.trim(),
      selectedInvoice
        ? t("finance.payInvoiceTitle", { number: selectedInvoice.number })
        : t("finance.onAccount"),
    ];
    return parts.filter(Boolean).join(" — ");
  }

  function validate(): string | null {
    if (!patientId) return t("patients.choose");
    if (!Number.isFinite(amount) || amount <= 0)
      return t("api.amountPositive");
    if (!dateIso || Number.isNaN(dateIso.getTime())) return t("api.invalidDate");
    if (futureDate) return t("api.payment.futureDate");
    return null;
  }

  async function submit() {
    const validationError = validate();
    if (validationError || !dateIso) {
      setError(validationError ?? t("api.invalidDate"));
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
          body: JSON.stringify(
            buildPaymentBody({
              amountUsd: -fromDisplayAmount(amount),
              note: composePaymentNote(method, paymentBaseNote()),
              createdAt: dateIso.toISOString(),
              appliedChargeId: chargeId || undefined,
            }),
          ),
        },
      );
      const data = (await res.json()) as { entry?: object; error?: string };
      if (!res.ok || !data.entry) {
        setError(data.error ?? t("finance.paymentFailed"));
        return;
      }
      toast(t("finance.paymentRecorded"));
      emitLedgerChanged();
      onSaved();
      router.refresh();
    } catch {
      setError(t("errors.serverRetry"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("finance.settlePayment")}
      titleClassName="font-display text-lg text-warning-600"
      className="max-w-lg"
      footer={
        <>
          <Button variant="gold" loading={saving} onClick={() => void submit()}>
            {t("finance.recordPayment")}
          </Button>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      {/* عمودان — على شكل المرجع: المريض/المبلغ/التاريخ يميناً،
          على الفاتورة/طريقة الدفع/ملاحظات يساراً */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("common.patientRequired")} htmlFor="pay-patient">
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
          label={t("finance.onInvoice")}
          htmlFor="pay-invoice"
          hint={
            patients.length > 0 && outstanding.length === 0
              ? t("finance.noPendingInvoices")
              : undefined
          }
        >
          <Select
            id="pay-invoice"
            value={chargeId}
            onChange={(e) => setChargeId(e.target.value)}
          >
            <option value="">{t("invoices.onAccount")}</option>
            {outstanding.map((row) => (
              <option key={row.chargeId} value={row.chargeId}>
                {row.number} {t("dues.remainingSuffix2")} {money(row.remainingUsd)}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={t("common.amountRequired")}
          htmlFor="pay-amount"
          hint={
            selectedInvoice
              ? t("finance.remainingOnInvoice", { amount: money(selectedInvoice.remainingUsd) })
              : undefined
          }
        >
          <div className="relative">
            <span className="text-steel-500 pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm">
              {isUsdInput ? "$" : t("common.sypSymbol")}
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

        <Field label={t("finance.paymentMethod")} htmlFor="pay-method">
          <Select
            id="pay-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          >
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(PAYMENT_METHOD_LABEL_KEYS[option])}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("common.date")} htmlFor="pay-date" error={futureDate ? t("api.payment.futureDate") : undefined}>
          <Input
            id="pay-date"
            type="date"
            value={date}
            max={toDateInputValue(new Date())}
            onChange={(e) => setDate(e.target.value)}
            className="numeric"
          />
        </Field>

        <Field label={t("common.notes")} htmlFor="pay-notes">
          <Textarea
            id="pay-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("common.noteOptionalPlaceholder")}
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

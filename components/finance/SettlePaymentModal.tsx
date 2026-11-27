"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dualFromUsdParts, isUsdAmount } from "@/lib/currency";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { emitLedgerChanged } from "@/lib/ledger-events";

// تسديد دفعة سريع — قيد دفعة (PAYMENT) جاهز عبر مسار الدفتر القائم
// (POST /api/patients/:id/ledger) بمبلغ المستحق المتبقي معبّأ مسبقاً.
// المستحق قابل للتعديل قبل التسجيل، والتحقق المالي يبقى في الخدمة.

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  patientId: string;
  patientName: string;
  /** المستحق الحالي — يعبّأ حقل المبلغ مسبقاً به */
  dueUsd: number;
  usdRate: number;
};

export default function SettlePaymentModal({
  open,
  onClose,
  onSaved,
  patientId,
  patientName,
  dueUsd,
  usdRate,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const { toast } = useToast();
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmountStr(dueUsd > 0 ? String(dueUsd) : "");
      setNote("");
      setError(null);
    }
  }, [open, dueUsd]);

  const amount = Number(amountStr);
  const parts =
    Number.isFinite(amount) && amount > 0
      ? dualFromUsdParts(-amount, usdRate)
      : null;

  async function submit() {
    if (!isUsdAmount(amount) || amount <= 0) {
      setError(t("api.amountPositive2dp"));
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
            amountUsd: -amount,
            note: note.trim() || undefined,
          }),
        },
      );
      const data = (await res.json()) as { entry?: object; error?: string };
      if (!res.ok || !data.entry) {
        setError(data.error ?? t("finance.paymentFailed"));
        return;
      }
      toast(t("finance.paymentRecorded"));
      emitLedgerChanged();
      onClose();
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
      open={open}
      onClose={onClose}
      title={`تسديد دفعة — ${patientName}`}
      footer={
        <>
          <Button loading={saving} onClick={() => void submit()}>
            {t("finance.recordPayment")}
          </Button>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-field border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-800">
          {t("finance.paymentNegativeHintLong")}
        </p>
        <Field
          label={t("finance.amountUsd")}
          htmlFor="settle-amount"
          hint={
            parts !== null
              ? `سيُسجَّل في الدفتر: ${parts.usd} (${parts.syp})`
              : undefined
          }
        >
          <Input
            id="settle-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0.01}
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="numeric"
          />
        </Field>
        <Field label={t("common.descriptionOptional")} htmlFor="settle-note">
          <Input
            id="settle-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("finance.paymentPlaceholder")}
          />
        </Field>
        {error && (
          <p role="alert" className="text-xs text-danger-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

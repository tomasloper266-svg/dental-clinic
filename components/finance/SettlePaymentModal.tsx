"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dualFromSypParts } from "@/lib/currency";
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
  dueSyp: number;
  usdRate: number;
};

export default function SettlePaymentModal({
  open,
  onClose,
  onSaved,
  patientId,
  patientName,
  dueSyp,
  usdRate,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmountStr(dueSyp > 0 ? String(dueSyp) : "");
      setNote("");
      setError(null);
    }
  }, [open, dueSyp]);

  const amount = Number(amountStr);
  const parts =
    Number.isFinite(amount) && amount > 0
      ? dualFromSypParts(-amount, usdRate)
      : null;

  async function submit() {
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("المبلغ يجب أن يكون رقماً صحيحاً موجباً");
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
            amountSyp: -amount,
            note: note.trim() || undefined,
          }),
        },
      );
      const data = (await res.json()) as { entry?: object; error?: string };
      if (!res.ok || !data.entry) {
        setError(data.error ?? "تعذر تسجيل الدفعة، أعد المحاولة");
        return;
      }
      toast("سُجّلت الدفعة في الدفتر");
      emitLedgerChanged();
      onClose();
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
      open={open}
      onClose={onClose}
      title={`تسديد دفعة — ${patientName}`}
      footer={
        <>
          <Button loading={saving} onClick={() => void submit()}>
            تسجيل الدفعة
          </Button>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-field border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-800">
          تُسجَّل الدفعة بقيمة سالبة تخفض رصيد المريض في الدفتر.
        </p>
        <Field
          label="المبلغ (ل.س)"
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
            inputMode="numeric"
            min={1}
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="numeric"
          />
        </Field>
        <Field label="البيان (اختياري)" htmlFor="settle-note">
          <Input
            id="settle-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="دفعة تسديد…"
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

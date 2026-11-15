"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { LedgerEntryType } from "@/lib/services/ledger";
import type { PlanItemDto } from "@/lib/services/treatment-plan";
import { isUsdAmount } from "@/lib/currency";
import { LEDGER_ENTRY_TYPE_META } from "@/lib/ledger-view";
import { toothNameAr } from "@/lib/odontogram/fdi";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { emitLedgerChanged } from "@/lib/ledger-events";

// تسجيل قيد مالي جديد من ملف المريض — عبر مسار الدفتر القائم (POST فقط:
// القيد غير قابل للتعديل أو الحذف، والتصحيح بقيد عكسي). إشارة المبلغ حسب
// النوع يتحقق منها الخادم ورسالته العربية تظهر داخلياً كما هي.

const ENTRY_TYPES = ["CHARGE", "PAYMENT", "ADJUSTMENT", "REFUND"] as const;

const TYPE_HINTS: Record<LedgerEntryType, string> = {
  CHARGE: "موجب — رسوم علاج تُضاف على المريض",
  PAYMENT: "سالب — دفعة تُخصم من رصيده",
  ADJUSTMENT: "بالاتجاهين — تصحيح يُضاف أو يُخصم",
  REFUND: "موجب — مبلغ مسترد للمريض",
};

type Props = {
  open: boolean;
  onClose: () => void;
  patientId: string;
  planItems: PlanItemDto[];
  /** نوع القيد المعبّأ عند الفتح — لتسديد دفعة جاهزة من رأس الملف */
  initialType?: LedgerEntryType;
  /** قيمة المبلغ المعبّأة عند الفتح — عادةً المستحق المتبقي */
  initialAmountUsd?: number;
};

export default function NewLedgerEntryModal({
  open,
  onClose,
  patientId,
  planItems,
  initialType = "CHARGE",
  initialAmountUsd,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [type, setType] = useState<LedgerEntryType>(initialType);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [treatmentItemId, setTreatmentItemId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // نافذة جديدة بذكريات سابقة — إعادة ضبط عند كل فتح على القيم المطلوبة.
  useEffect(() => {
    if (open) {
      setType(initialType);
      setAmount(initialAmountUsd !== undefined ? String(initialAmountUsd) : "");
      setNote("");
      setTreatmentItemId("");
      setError(null);
    }
  }, [open, initialType, initialAmountUsd]);

  async function submit() {
    const amountUsd = Number(amount);
    if (!isUsdAmount(amountUsd) || amountUsd === 0) {
      setError("المبلغ يجب أن يكون رقماً غير صفري بمنزلتين عشريتين كحد أقصى");
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
            type,
            amountUsd,
            note: note.trim() || undefined,
            treatmentItemId: treatmentItemId || undefined,
          }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "تعذر إنشاء القيد");
        return;
      }
      toast("تم تسجيل القيد بنجاح");
      emitLedgerChanged();
      router.refresh();
      onClose();
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="قيد مالي جديد">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="نوع القيد" htmlFor="ledger-type">
            <Select
              id="ledger-type"
              value={type}
              onChange={(e) => setType(e.target.value as LedgerEntryType)}
            >
              {ENTRY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LEDGER_ENTRY_TYPE_META[t].labelAr}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="المبلغ ($)" htmlFor="ledger-amount">
            <Input
              id="ledger-amount"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={type === "PAYMENT" ? "-50" : "50"}
              className="numeric"
            />
          </Field>
        </div>

        <p className="text-warm-500 -mt-2 text-[11px]">{TYPE_HINTS[type]}</p>

        <Field label="العلاج المرتبط (اختياري)" htmlFor="ledger-item">
          <Select
            id="ledger-item"
            value={treatmentItemId}
            onChange={(e) => setTreatmentItemId(e.target.value)}
          >
            <option value="">بلا رابط بند</option>
            {planItems.map((item) => (
              <option key={item.id} value={item.id}>
                السن {item.toothFdi} ({toothNameAr(item.toothFdi)}) —{" "}
                {item.procedure}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="ملاحظة (اختياري)" htmlFor="ledger-note">
          <Input
            id="ledger-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مثال: دفعة أولى على الخطة"
            maxLength={300}
          />
        </Field>

        {error && (
          <p
            role="alert"
            className="rounded-field border border-danger-300 bg-danger-50 px-3 py-2 text-xs text-danger-700"
          >
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={submit} loading={saving}>
            <Plus size={16} aria-hidden />
            {saving ? "جارٍ الحفظ…" : "تسجيل القيد"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  );
}

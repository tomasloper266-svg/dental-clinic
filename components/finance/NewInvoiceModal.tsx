"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { usdToSyp } from "@/lib/currency";
import {
  buildChargeWithItemsBody,
  invoiceItemDescription,
  type InvoiceItemPayload,
} from "@/lib/invoices-view";
import {
  isDateInputFuture,
  parseDateInputValue,
  toDateInputValue,
} from "@/lib/dates";
import type { PatientDto } from "@/lib/services/patients";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { emitLedgerChanged } from "@/lib/ledger-events";

// «فاتورة جديدة» من صفحة الفواتير — تُصدر الفاتورة بقيد رسوم واحد (CHARGE)
// ببنود مهيكلة (items) عبر مسار الدفتر، فتأخذ رقماً واحداً من تسلسل العيادة
// وتُصنَّف بنودها في تجميع الإيراد حسب نوع العلاج. الأسعار تُدخل بالدولار
// على شكل المرجع وتُحوَّل إلى الليرة بسعر العيادة عند التسجيل.

type InvoiceItemDraft = { procedure: string; tooth: string; priceUsd: string };

const EMPTY_ITEM: InvoiceItemDraft = { procedure: "", tooth: "", priceUsd: "" };

type Props = {
  onClose: () => void;
  onIssued: () => void;
  usdRate: number;
  patients: PatientDto[];
};

export default function NewInvoiceModal({
  onClose,
  onIssued,
  usdRate,
  patients,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [items, setItems] = useState<InvoiceItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [discountStr, setDiscountStr] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // التاريخ يوم بيوم بلا مكوّن وقت (الخطأ 15): «اليوم» يُقبل أي كانت الساعة
  // ولحظة التخزين منتصف ليل UTC فتبقى ماضية أي كانت ساعة الإدخال.
  const dateIso = date ? parseDateInputValue(date) : null;
  const futureDate = dateIso !== null && isDateInputFuture(date, new Date());

  const totalUsd = useMemo(() => {
    let total = 0;
    for (const item of items) {
      const price = Number(item.priceUsd);
      if (item.procedure.trim() && Number.isFinite(price) && price > 0) {
        total += price;
      }
    }
    return total;
  }, [items]);

  function setItem(index: number, patch: Partial<InvoiceItemDraft>) {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function validate(): string | null {
    if (!patientId) return "اختر المريض";
    if (!dateIso || Number.isNaN(dateIso.getTime())) return "التاريخ غير صالح";
    if (futureDate) return "لا يمكن إصدار الفاتورة بتاريخ مستقبلي";
    const valid = items.filter(
      (item) => item.procedure.trim() && Number(item.priceUsd) > 0,
    );
    if (valid.length === 0)
      return "أدخل بنداً واحداً على الأقل (الإجراء والمبلغ)";
    const discount = Number(discountStr);
    if (discountStr && (!Number.isFinite(discount) || discount < 0))
      return "الخصم يجب أن يكون رقماً موجباً";
    if (discount > totalUsd) return "الخصم أكبر من إجمالي الفاتورة";
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
      const validItems = items.filter(
        (item) => item.procedure.trim() && Number(item.priceUsd) > 0,
      );
      // كل بند يُحوَّل إلى الليرة مستقلاً (تقريب وحدة التخزين)، ومبلغ القيد
      // يُبنى كمجموع البنود المحوَّلة — فيمر تحقق «مجموع البنود = المبلغ» دائماً.
      const payloadItems: InvoiceItemPayload[] = validItems.map((item) => {
        const procedure = item.procedure.trim();
        const tooth = item.tooth.trim();
        return {
          description: invoiceItemDescription(procedure, tooth || undefined),
          // التصنيف نص حر أساس تجميع الإيراد حسب نوع العلاج — للفاتورة
          // اليدوية بلا حقل تصنيف، فالإجراء نفسه هو التصنيف.
          category: procedure,
          amountSyp: usdToSyp(Number(item.priceUsd), usdRate),
        };
      });
      const res = await fetch(
        `/api/patients/${encodeURIComponent(patientId)}/ledger`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            buildChargeWithItemsBody({
              items: payloadItems,
              note: notes.trim() || `فاتورة — ${payloadItems.length} بنود`,
              createdAt: dateIso.toISOString(),
            }),
          ),
        },
      );
      const data = (await res.json()) as { entry?: object; error?: string };
      if (!res.ok || !data.entry) {
        setError(data.error ?? "تعذر إصدار الفاتورة، أعد المحاولة");
        return;
      }
      const discount = Number(discountStr);
      if (Number.isFinite(discount) && discount > 0) {
        const res = await fetch(
          `/api/patients/${encodeURIComponent(patientId)}/ledger`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              type: "ADJUSTMENT",
              amountSyp: -usdToSyp(discount, usdRate),
              note: notes.trim()
                ? `خصم على فاتورة — ${notes.trim()}`
                : "خصم على فاتورة",
              createdAt: dateIso.toISOString(),
            }),
          },
        );
        if (!res.ok) {
          setError("صدرت الفاتورة لكن تعذر تسجيل الخصم");
          return;
        }
      }
      toast("صدرت الفاتورة في الدفتر");
      emitLedgerChanged();
      onIssued();
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
      title="فاتورة جديدة"
      className="max-w-2xl"
      footer={
        <>
          <Button loading={saving} onClick={() => void submit()}>
            إصدار الفاتورة
          </Button>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="المريض *" htmlFor="inv-patient">
            <Select
              id="inv-patient"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            >
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="التاريخ"
            htmlFor="inv-date"
            error={futureDate ? "لا يمكن الإصدار بتاريخ مستقبلي" : undefined}
          >
            <Input
              id="inv-date"
              type="date"
              value={date}
              max={toDateInputValue(new Date())}
              onChange={(e) => setDate(e.target.value)}
              className="numeric"
            />
          </Field>
        </div>

        {/* بنود الفاتورة — قيد رسوم واحد ببنود مهيكلة تُصنَّف في التقارير */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-ink-900">البنود *</legend>
          {items.map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              <Input
                aria-label="الإجراء"
                placeholder="الإجراء — تنظيف عميق"
                value={item.procedure}
                onChange={(e) => setItem(index, { procedure: e.target.value })}
              />
              <Input
                aria-label="السن"
                placeholder="السن"
                value={item.tooth}
                onChange={(e) => setItem(index, { tooth: e.target.value })}
                className="numeric w-24 shrink-0"
              />
              <div className="relative w-28 shrink-0">
                <span className="text-steel-500 pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm">
                  $
                </span>
                <Input
                  aria-label="المبلغ بالدولار"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={item.priceUsd}
                  onChange={(e) => setItem(index, { priceUsd: e.target.value })}
                  className="numeric pe-7"
                />
              </div>
              <button
                type="button"
                aria-label="حذف البند"
                disabled={items.length === 1}
                onClick={() =>
                  setItems((current) => current.filter((_, i) => i !== index))
                }
                className="text-steel-500 hover:text-danger-600 disabled:opacity-40"
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItems((current) => [...current, { ...EMPTY_ITEM }])}
            className="text-primary-700 inline-flex w-fit items-center gap-1 text-sm font-medium hover:underline"
          >
            <Plus size={15} aria-hidden />
            إضافة بند
          </button>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="الخصم ($)"
            htmlFor="inv-discount"
            hint={`الإجمالي: $ ${totalUsd.toLocaleString("en-US")}`}
          >
            <Input
              id="inv-discount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0"
              value={discountStr}
              onChange={(e) => setDiscountStr(e.target.value)}
              className="numeric"
            />
          </Field>
          <Field label="ملاحظات" htmlFor="inv-notes">
            <Textarea
              id="inv-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظة اختيارية…"
            />
          </Field>
        </div>

        {error && (
          <p role="alert" className="text-xs text-danger-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

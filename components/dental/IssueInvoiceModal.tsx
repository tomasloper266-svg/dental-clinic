"use client";

import { useEffect, useState } from "react";
import type { PlanItemDto } from "@/lib/services/treatment-plan";
import { planStatusMeta } from "@/lib/treatment-plan-view";
import {
  buildChargeWithItemsBody,
  type InvoiceItemPayload,
} from "@/lib/invoices-view";
import type { StaffMemberDto } from "@/lib/services/staff";
import { useMoney } from "@/components/ui/CurrencyContext";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

// إصدار فاتورة من بنود الخطة — قيد رسوم واحد (CHARGE) ببنود مهيكلة للبنود
// المختارة كلها، فتأخذ الفاتورة رقماً واحداً من تسلسل العيادة وتُصنَّف بنودها
// في تجميع الإيراد حسب الإجراء. الخصم قيد تسوية سالبة منفصل، والفاتورة المعروضة
// لاحقاً مشتقة من هذه القيود نفسها (لا نموذج فواتير منفصل).

type Props = {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  planName: string;
  items: PlanItemDto[];
  doctors: StaffMemberDto[];
  onIssued: (chargeIds: string[]) => void;
};

type IssueResult = { entry: { id: string } };

export default function IssueInvoiceModal({
  open,
  onClose,
  patientId,
  patientName,
  planName,
  items,
  doctors,
  onIssued,
}: Props) {
  const { toast } = useToast();
  const money = useMoney();
  const [doctorName, setDoctorName] = useState("");
  const [date, setDate] = useState("");
  const [discountStr, setDiscountStr] = useState("0");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // المكتمل مختار مسبقاً عند كل فتح — كما في سطر المساعدة بالمرجع
  useEffect(() => {
    if (open) {
      setSelected(new Set(items.filter((i) => i.status === "DONE").map((i) => i.id)));
      setDiscountStr("0");
      setNotes("");
      setError(null);
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, items]);

  const discount = Number(discountStr);
  const selectedItems = items.filter((item) => selected.has(item.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function issue() {
    if (selectedItems.length === 0) {
      setError("اختر بنداً واحداً على الأقل لإصدار الفاتورة");
      return;
    }
    if (!Number.isInteger(discount) || discount < 0) {
      setError("الخصم يجب أن يكون رقماً صحيحاً غير سالب");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // بنود الفاتورة من بنود الخطة المختارة — الوصف هو الإجراء نفسه
      // والتصنيف نص حر أساس تجميع الإيراد حسب نوع العلاج.
      const payloadItems: InvoiceItemPayload[] = selectedItems.map((item) => ({
        description: item.procedure,
        category: item.procedure,
        amountSyp: item.priceSyp,
      }));
      const res = await fetch(`/api/patients/${encodeURIComponent(patientId)}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildChargeWithItemsBody({
            items: payloadItems,
            note:
              notes.trim() ||
              `فاتورة خطة — ${payloadItems.length} بنود`,
          }),
          // بند واحد مختار يبقى مربوطاً برقم بند الخطة — حاجز التكرار مع
          // القيد التلقائي (recordTreatmentCharge) كما هو. متعدد البنود لا
          // يحمل ربطاً لكل بند على القيد — البنود نفسها تحمل أوصافها.
          ...(selectedItems.length === 1
            ? { treatmentItemId: selectedItems[0].id }
            : {}),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "تعذر إصدار الفاتورة، لم يُسجَّل أي قيد");
        return;
      }
      const data = (await res.json()) as IssueResult;
      const chargeIds = [data.entry.id];
      if (discount > 0) {
        const res = await fetch(`/api/patients/${encodeURIComponent(patientId)}/ledger`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "ADJUSTMENT",
            amountSyp: -discount,
            note: notes.trim() ? `خصم — ${notes.trim()}` : "خصم فاتورة",
          }),
        });
        if (!res.ok) {
          setError("صدرت الفاتورة لكن تعذر تسجيل الخصم");
          onIssued(chargeIds);
          return;
        }
      }
      toast("صدرت الفاتورة وسُجلت بقيود الدفتر");
      onIssued(chargeIds);
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="إصدار الفاتورة"
      titleClassName="text-warning-500 text-base font-bold"
      className="max-w-2xl"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="المريض *" htmlFor="issue-patient">
          <Input id="issue-patient" value={patientName} readOnly />
        </Field>
        <Field label="الطبيب" htmlFor="issue-doctor">
          <select
            id="issue-doctor"
            value={doctorName}
            onChange={(event) => setDoctorName(event.target.value)}
            className="focus-ring w-full rounded-field border border-warm-300 bg-surface px-3 py-2 text-sm text-ink-900"
          >
            <option value="">—</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.name}>
                {doctor.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="التاريخ" htmlFor="issue-date">
          <Input
            id="issue-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <Field label="خصم" htmlFor="issue-discount">
          <Input
            id="issue-discount"
            type="number"
            min={0}
            value={discountStr}
            onChange={(event) => setDiscountStr(event.target.value)}
          />
        </Field>
      </div>

      <p className="text-steel-500 mt-3 text-xs">
        بنود العناصر «{planName}» — احتسب ما سيُدرج في الفاتورة (للبنود المختارة مسبقاً)
      </p>

      <ul className="border-warm-200 mt-2 divide-y divide-warm-100 rounded-field border">
        {items.length === 0 && (
          <li className="text-steel-500 px-3 py-3 text-sm">
            لا بنود في هذه الخطة بعد.
          </li>
        )}
        {items.map((item) => {
          const meta = planStatusMeta(item.status);
          const checked = selected.has(item.id);
          return (
            <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(item.id)}
                  className="accent-warning-500 h-4 w-4"
                />
                <span className="text-ink-900">{item.procedure}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.toneClass}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {meta.labelAr}
                </span>
              </label>
              <span className="numeric text-sm font-semibold text-warning-500">
                {money(item.priceSyp)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3">
        <Field label="ملاحظات" htmlFor="issue-notes">
          <textarea
            id="issue-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="focus-ring w-full rounded-field border border-warm-300 bg-surface px-3 py-2 text-sm text-ink-900"
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger-700">
          {error}
        </p>
      )}

      <footer className="mt-4 flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          إغلاق
        </Button>
        <Button variant="gold" onClick={issue} loading={saving}>
          إصدار الفاتورة
        </Button>
      </footer>
    </Modal>
  );
}

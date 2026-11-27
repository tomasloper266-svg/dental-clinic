"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { roundUsd2 } from "@/lib/currency";
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
import { toothAnatomy } from "@/lib/odontogram/anatomy";
import {
  formatSurfaceAr,
  surfaceCodesOf,
} from "@/lib/odontogram/surfaces";
import { isValidToothFdi } from "@/lib/odontogram/fdi";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { emitLedgerChanged } from "@/lib/ledger-events";
import { cn } from "@/components/ui/cn";

// «فاتورة جديدة» من صفحة الفواتير — تُصدر الفاتورة بقيد رسوم واحد (CHARGE)
// ببنود مهيكلة (items) عبر مسار الدفتر، فتأخذ رقماً واحداً من تسلسل العيادة
// وتُصنَّف بنودها في تجميع الإيراد حسب نوع العلاج. الأسعار تُدخل بالدولار
// على شكل المرجع وتُحوَّل إلى الليرة بسعر العيادة عند التسجيل.

type InvoiceItemDraft = {
  procedure: string;
  tooth: string;
  /** أكواد أسطح البند مجمّعة (مثال «O+M») — تُرسل مع سن صالح حصراً */
  surface: string;
  priceUsd: string;
};

const EMPTY_ITEM: InvoiceItemDraft = {
  procedure: "",
  tooth: "",
  surface: "",
  priceUsd: "",
};

type Props = {
  onClose: () => void;
  onIssued: () => void;
  patients: PatientDto[];
};

export default function NewInvoiceModal({
  onClose,
  onIssued,
  patients,
}: Props) {
  const { t } = useI18n();
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
    if (!patientId) return t("patients.choose");
    if (!dateIso || Number.isNaN(dateIso.getTime())) return t("api.invalidDate");
    if (futureDate) return t("invoices.noFutureDate");
    const valid = items.filter(
      (item) => item.procedure.trim() && Number(item.priceUsd) > 0,
    );
    if (valid.length === 0)
      return t("invoices.oneItemMin");
    const discount = Number(discountStr);
    if (discountStr && (!Number.isFinite(discount) || discount < 0))
      return t("api.plans.discountPositive");
    if (discount > totalUsd) return t("invoices.discountTooLarge");
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
      const validItems = items.filter(
        (item) => item.procedure.trim() && Number(item.priceUsd) > 0,
      );
      // الأسعار تُدخل بالدولار — وهي الآن وحدة التخزين نفسها، فتُخزَّن كما
      // دخلت بمنزلتين عشريتين بلا أي تحويل، ويُبنى مبلغ القيد كمجموع البنود
      // — فيمر تحقق «مجموع البنود = المبلغ» دائماً.
      const payloadItems: InvoiceItemPayload[] = validItems.map((item) => {
        const procedure = item.procedure.trim();
        const tooth = item.tooth.trim();
        // السن الاختياري: إن كان رقم FDI دائم صالحاً يُرسل مرجعياً مع أسطحه —
        // وغير ذلك يبقى نصاً في الوصف كما في السلوك السابق، بلا سطح.
        const toothNum = Number(tooth);
        const hasValidTooth = isValidToothFdi(toothNum);
        const surface = hasValidTooth && item.surface ? item.surface : undefined;
        return {
          description: invoiceItemDescription(
            procedure,
            tooth || undefined,
            surface ? formatSurfaceAr(surface) : undefined,
          ),
          // التصنيف نص حر أساس تجميع الإيراد حسب نوع العلاج — للفاتورة
          // اليدوية بلا حقل تصنيف، فالإجراء نفسه هو التصنيف.
          category: procedure,
          amountUsd: roundUsd2(Number(item.priceUsd)),
          ...(hasValidTooth ? { toothFdi: toothNum } : {}),
          ...(surface ? { surface } : {}),
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
        setError(data.error ?? t("invoices.issueFailed"));
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
              amountUsd: -roundUsd2(discount),
              note: notes.trim()
                ? `خصم على فاتورة — ${notes.trim()}`
                : t("finance.discountOnInvoice"),
              createdAt: dateIso.toISOString(),
            }),
          },
        );
        if (!res.ok) {
          setError(t("invoices.issuedDiscountFailed"));
          return;
        }
      }
      toast(t("invoices.issuedRecorded"));
      emitLedgerChanged();
      onIssued();
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
      title={t("invoices.newInvoice")}
      className="max-w-2xl"
      footer={
        <>
          <Button loading={saving} onClick={() => void submit()}>
            {t("invoices.issue")}
          </Button>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("common.patientRequired")} htmlFor="inv-patient">
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
            label={t("common.date")}
            htmlFor="inv-date"
            error={futureDate ? t("invoices.issueNoFutureDate") : undefined}
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
          <legend className="text-sm font-medium text-ink-900">{t("invoices.itemsRequired")}</legend>
          {items.map((item, index) => {
            const toothNum = Number(item.tooth.trim());
            const surfaceOptions = isValidToothFdi(toothNum)
              ? (toothAnatomy(toothNum)?.surfaces ?? [])
              : [];
            const chosenSurfaces = surfaceCodesOf(item.surface);
            return (
              <div key={index} className="flex flex-col gap-1.5">
                <div className="flex items-start gap-2">
                  <Input
                    aria-label={t("common.procedure")}
                    placeholder={t("invoices.exampleDeepClean")}
                    value={item.procedure}
                    onChange={(e) =>
                      setItem(index, { procedure: e.target.value })
                    }
                  />
                  <Input
                    aria-label={t("common.tooth")}
                    placeholder={t("common.tooth")}
                    value={item.tooth}
                    onChange={(e) =>
                      setItem(index, {
                        tooth: e.target.value,
                        // السن تغيّر — أسطح السن القديم قد لا تكون تشريحية للجديد
                        surface: "",
                      })
                    }
                    className="numeric w-24 shrink-0"
                  />
                  <div className="relative w-28 shrink-0">
                    <span className="text-steel-500 pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm">
                      $
                    </span>
                    <Input
                      aria-label={t("common.amountUsd")}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      value={item.priceUsd}
                      onChange={(e) =>
                        setItem(index, { priceUsd: e.target.value })
                      }
                      className="numeric pe-7"
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={t("plans.deleteItem")}
                    disabled={items.length === 1}
                    onClick={() =>
                      setItems((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                    className="text-steel-500 hover:text-danger-600 disabled:opacity-40"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
                {/* قائمة الأسطح المرجعية — تظهر عند إدخال سن دائم 11–48، وخياراتها من تشريح السن حصراً */}
                {surfaceOptions.length > 0 && (
                  <div
                    className="flex flex-wrap items-center gap-1.5 ps-1"
                    role="group"
                    aria-label={t("dental.itemSurface")}
                  >
                    {surfaceOptions.map((surface) => {
                      const active = chosenSurfaces.includes(surface);
                      return (
                        <button
                          key={surface}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            const next = active
                              ? chosenSurfaces.filter((s) => s !== surface)
                              : [...chosenSurfaces, surface];
                            setItem(index, { surface: next.join("+") });
                          }}
                          className={cn(
                            "rounded-field border px-2 py-1 text-[11px] font-medium transition-colors",
                            "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
                            active
                              ? "border-primary-600 bg-primary-600 text-white"
                              : "border-warm-300 bg-surface text-warm-600 hover:bg-surface-hover",
                          )}
                        >
                          {surface}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setItems((current) => [...current, { ...EMPTY_ITEM }])}
            className="text-primary-700 inline-flex w-fit items-center gap-1 text-sm font-medium hover:underline"
          >
            <Plus size={15} aria-hidden />
            {t("plans.addItem")}
          </button>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("finance.discountUsd")}
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
          <Field label={t("common.notes")} htmlFor="inv-notes">
            <Textarea
              id="inv-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("common.noteOptionalPlaceholder")}
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

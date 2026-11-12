"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatSyp } from "@/lib/utils";
import type {
  PlanItemDto,
  PlanItemStatus,
} from "@/lib/services/treatment-plan";
import { toothStatusMeta } from "@/lib/odontogram/statuses";
import { planBoardColumns, planTotals, chartToothHref } from "@/lib/treatment-plan-view";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { cn } from "@/components/ui/cn";

// لوحة خطط العلاج على مستوى العيادة (صفحة /plans) — منظور عرض عبر منتقي
// المريض، بغير تبويب الخطة داخل ملف المريض الذي يخدم مريضاً واحداً.
// نفس خدمات الخطة ومساراتها حصراً: الإضافة POST، القبول/الإرجاع PATCH،
// وبدء التنفيذ ينشئ قيد TREATMENT_DONE إلحاقياً على السن. الإجماليات
// دائم الظهور — قرار الطبيب والمريض يعتمد عليها حتى مع خطة فارغة.

const RESULT_STATUSES = [
  "FILLED",
  "ROOT_CANAL",
  "EXTRACTED",
  "CROWN",
  "IMPLANT",
] as const;

const COLUMN_META: Record<
  PlanItemStatus,
  { labelAr: string; hintAr: string; headClass: string; cardClass: string }
> = {
  PROPOSED: {
    labelAr: "مخطط",
    hintAr: "بانتظار موافقة المريض",
    headClass: "text-warm-700",
    cardClass: "border-warm-300 bg-warm-100",
  },
  ACCEPTED: {
    labelAr: "مقبول",
    hintAr: "جاهز للتنفيذ",
    headClass: "text-ink-800",
    cardClass: "border-ink-200 bg-ink-50",
  },
  DONE: {
    labelAr: "منفَّذ",
    hintAr: "مقفل — لا يُعدَّل",
    headClass: "text-primary-800",
    cardClass: "border-primary-200 bg-primary-50",
  },
};

const COLUMN_ORDER = ["PROPOSED", "ACCEPTED", "DONE"] as const;

const inputClass =
  "rounded-field border-warm-300 bg-surface-raised text-ink-900 placeholder:text-warm-400 focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 w-full";

// شارة رقم السن — رابط إلى مخطط المريض المستقل مع فتح لوحة السن.
function ToothChip({ patientId, fdi }: { patientId: string; fdi: number }) {
  return (
    <Link
      href={chartToothHref(patientId, fdi)}
      title="عرض السن على مخطط الأسنان"
      className="border-ink-200 bg-ink-50 text-ink-800 numeric hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800 rounded-field border px-2 py-0.5 text-xs font-bold transition-colors focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {fdi}
    </Link>
  );
}

type Props = {
  patientId: string;
  initialItems: PlanItemDto[];
};

export default function PlansBoard({ patientId, initialItems }: Props) {
  const [items, setItems] = useState<PlanItemDto[]>(initialItems);
  const [tooth, setTooth] = useState("");
  const [procedure, setProcedure] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  const base = `/api/patients/${encodeURIComponent(patientId)}/treatment-plan`;
  const totals = useMemo(() => planTotals(items), [items]);
  const columns = useMemo(() => planBoardColumns(items), [items]);

  async function addItem() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          toothFdi: Number(tooth),
          procedure,
          priceSyp: Number(price),
        }),
      });
      const data = (await res.json()) as { item?: PlanItemDto; error?: string };
      if (!res.ok || !data.item) {
        setError(data.error ?? "تعذر إضافة بند الخطة");
        return;
      }
      setItems((prev) => [...prev, data.item as PlanItemDto]);
      setProcedure("");
      setPrice("");
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: "ACCEPTED" | "PROPOSED") {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json()) as { item?: PlanItemDto; error?: string };
      if (!res.ok || !data.item) {
        setError(data.error ?? "تعذر تحديث حالة البند");
        return;
      }
      setItems((prev) =>
        prev.map((it) => (it.id === id ? (data.item as PlanItemDto) : it)),
      );
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  }

  async function startItem(id: string, resultStatus: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resultStatus }),
      });
      const data = (await res.json()) as { item?: PlanItemDto; error?: string };
      if (!res.ok || !data.item) {
        setError(data.error ?? "تعذر بدء تنفيذ البند");
        return;
      }
      setItems((prev) =>
        prev.map((it) => (it.id === id ? (data.item as PlanItemDto) : it)),
      );
      setStartingId(null);
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  }

  const toothNum = Number(tooth);
  const canAdd =
    Number.isInteger(toothNum) && procedure.trim().length >= 2 && price !== "";

  return (
    <section className="space-y-4">
      {/* شريط الإجماليات — دائم الظهور حتى مع خطة فارغة */}
      <div className="border-warm-200 bg-surface-raised grid grid-cols-2 gap-3 rounded-panel border p-4 sm:grid-cols-4">
        {(["PROPOSED", "ACCEPTED", "DONE"] as const).map((status) => {
          const meta = COLUMN_META[status];
          const summary = totals.byStatus[status];
          return (
            <div key={status}>
              <p className="text-warm-500 text-[11px]">{meta.labelAr}</p>
              <p className="text-ink-900 numeric text-sm font-semibold">
                <span className="numeric">{summary.count}</span> بند ·{" "}
                {formatSyp(summary.total)}
              </p>
            </div>
          );
        })}
        <div className="border-warm-200 border-r pr-3">
          <p className="text-ink-700 text-[11px] font-semibold">
            الإجمالي الكلي
          </p>
          <p className="text-ink-900 numeric text-sm font-bold">
            {formatSyp(totals.grandTotal)}
          </p>
        </div>
      </div>

      {/* إضافة بند — نفس مسار الإضافة في تبويب الخطة داخل الملف */}
      <div className="border-warm-200 bg-surface-raised grid gap-2 rounded-panel border p-4 sm:grid-cols-[5rem_1fr_8rem_auto]">
        <label className="sr-only" htmlFor="board-tooth">
          رقم السن (FDI)
        </label>
        <Input
          id="board-tooth"
          type="number"
          inputMode="numeric"
          min={11}
          max={48}
          value={tooth}
          onChange={(e) => setTooth(e.target.value)}
          placeholder="سن"
          className={cn(inputClass, "numeric")}
        />
        <label className="sr-only" htmlFor="board-procedure">
          الإجراء
        </label>
        <Input
          id="board-procedure"
          value={procedure}
          onChange={(e) => setProcedure(e.target.value)}
          placeholder="الإجراء — حشو، خلع…"
          className={inputClass}
        />
        <label className="sr-only" htmlFor="board-price">
          السعر بالليرة السورية
        </label>
        <Input
          id="board-price"
          type="number"
          inputMode="numeric"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="السعر ل.س"
          className={cn(inputClass, "numeric")}
        />
        <Button onClick={addItem} loading={busy} disabled={busy || !canAdd}>
          إضافة بند
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="border-danger-300 bg-danger-50 text-danger-700 rounded-field border px-3 py-2 text-xs"
        >
          {error}
        </p>
      )}

      {/* الأعمدة الثلاثة — كانبان بحسب الحالة */}
      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMN_ORDER.map((status) => {
          const meta = COLUMN_META[status];
          const summary = totals.byStatus[status];
          return (
            <div
              key={status}
              className="border-warm-200 bg-surface-sunken/60 flex min-h-40 flex-col rounded-panel border"
            >
              <div className="border-warm-200 border-b px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn("text-sm font-semibold", meta.headClass)}>
                    {meta.labelAr}
                  </p>
                  <p className="text-warm-500 numeric text-xs">
                    <span className="numeric">{summary.count}</span> بنود ·{" "}
                    {formatSyp(summary.total)}
                  </p>
                </div>
                <p className="text-warm-400 mt-0.5 text-[11px]">{meta.hintAr}</p>
              </div>

              {columns[status].length === 0 ? (
                <p className="text-warm-400 place-self-center px-3 py-6 text-xs">
                  لا بنود في هذه الحالة
                </p>
              ) : (
                <ul className="space-y-2 p-3">
                  {columns[status].map((item) => (
                    <li
                      key={item.id}
                      className={cn("rounded-field border p-3", meta.cardClass)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <ToothChip patientId={patientId} fdi={item.toothFdi} />
                        <span className="text-ink-900 text-sm font-semibold">
                          {item.procedure}
                        </span>
                        <span className="text-warm-700 numeric text-xs font-semibold">
                          {formatSyp(item.priceSyp)}
                        </span>
                      </div>

                      {item.status !== "DONE" && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.status === "PROPOSED" && (
                            <Button
                              variant="secondary"
                              onClick={() => setStatus(item.id, "ACCEPTED")}
                              disabled={busy}
                              size="sm"
                            >
                              قبول
                            </Button>
                          )}
                          {item.status === "ACCEPTED" && (
                            <Button
                              variant="ghost"
                              onClick={() => setStatus(item.id, "PROPOSED")}
                              disabled={busy}
                              size="sm"
                            >
                              إرجاع إلى مخطط
                            </Button>
                          )}
                          <Button
                            onClick={() =>
                              setStartingId(
                                startingId === item.id ? null : item.id,
                              )
                            }
                            disabled={busy}
                            size="sm"
                          >
                            بدء التنفيذ
                          </Button>
                        </div>
                      )}

                      {startingId === item.id && (
                        <div className="border-primary-200 bg-primary-50 mt-2 rounded-field border p-2">
                          <p className="text-primary-800 mb-1 text-xs font-semibold">
                            الحالة الناتجة على السن {item.toothFdi}:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {RESULT_STATUSES.map((key) => {
                              const statusMeta = toothStatusMeta(key);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => startItem(item.id, key)}
                                  disabled={busy}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-field border px-2 py-1 text-xs font-semibold",
                                    "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
                                    "hover:opacity-90 disabled:opacity-50",
                                    statusMeta?.chipClass,
                                  )}
                                >
                                  <span className="font-bold">
                                    {statusMeta?.icon}
                                  </span>
                                  {statusMeta?.labelAr}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-warm-500 mt-1 text-[11px]">
                            سيُضاف قيد «علاج منفذ» لسجل السن — القيود السابقة
                            تبقى محفوظة.
                          </p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

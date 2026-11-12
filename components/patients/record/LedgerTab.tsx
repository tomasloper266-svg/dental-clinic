"use client";

import { Plus, ReceiptText } from "lucide-react";
import type { LedgerEntryDto } from "@/lib/services/ledger";
import type { PlanItemDto } from "@/lib/services/treatment-plan";
import {
  LEDGER_ENTRY_TYPE_META,
  ledgerEntriesWithPlan,
} from "@/lib/ledger-view";
import { formatSyp } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { cn } from "@/components/ui/cn";

// تبويب «الحسابات» في ملف المريض — رصيد المريض وقيوده من دفتر العيادة.
// الرصيد يُحسب من مجموع القيود الموقّعة (لا يُخزَّن أبداً) ويف arrives جاهزاً
// من الخدمة، والقيود المرتبطة بعلاج تُربط ببنود الخطة عبر treatmentItemId
// والرقم السني زر ينقل إلى تبويب مخطط الأسنان.

type Props = {
  entries: LedgerEntryDto[];
  balance: number;
  planItems: PlanItemDto[];
  onNewEntry: () => void;
  onFocusTooth: (fdi: number) => void;
};

const dateFmt = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  dateStyle: "medium",
});

export default function LedgerTab({
  entries,
  balance,
  planItems,
  onNewEntry,
  onFocusTooth,
}: Props) {
  const rows = ledgerEntriesWithPlan(entries, planItems);

  return (
    <div className="space-y-4">
      {/* ─── بطاقة الرصيد — دائمًا أعلى التبويب ─────────────────────── */}
      <div className="border-warm-200 bg-surface-raised flex flex-wrap items-center justify-between gap-3 rounded-panel border px-5 py-4">
        <div className="min-w-0">
          <p className="text-warm-500 text-xs font-medium">الرصيد الحالي</p>
          <p className="text-ink-900 numeric mt-0.5 text-2xl font-bold">
            {formatSyp(balance)}
          </p>
          <p className="text-warm-400 mt-0.5 text-[11px]">
            مجموع القيود الموقّعة — الرسوم موجبة والدفعات سالبة، والرصيد يُحسب
            ولا يُخزَّن.
          </p>
        </div>
        <Button onClick={onNewEntry}>
          <Plus size={16} aria-hidden />
          قيد جديد
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText size={16} aria-hidden className="text-warm-400" />
            قيود الدفتر
            <span className="text-warm-400 numeric text-xs font-normal">
              ({entries.length})
            </span>
          </CardTitle>
        </CardHeader>
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="لا قيود مالية بعد"
              description="سجّل أول قيد — رسوم علاج، دفعة، تسوية أو استرداد. القيود غير قابلة للتعديل أو الحذف؛ التصحيح بقيد عكسي."
              action={
                <Button onClick={onNewEntry} className="h-8 px-3 text-xs">
                  <Plus size={14} aria-hidden />
                  قيد جديد
                </Button>
              }
              className="border-0 bg-transparent py-6"
            />
          </div>
        ) : (
          <div className="overflow-x-auto p-5 pt-4">
            <Table>
              <THead>
                <TRow>
                  <TH>التاريخ</TH>
                  <TH>النوع</TH>
                  <TH>المبلغ</TH>
                  <TH>العلاج المرتبط</TH>
                  <TH>ملاحظة</TH>
                </TRow>
              </THead>
              <tbody>
                {rows.map((row) => {
                  const meta = LEDGER_ENTRY_TYPE_META[row.type];
                  const item = row.planItem;
                  return (
                    <TRow key={row.id}>
                      <TD className="text-warm-600 whitespace-nowrap">
                        {dateFmt.format(new Date(row.createdAt))}
                      </TD>
                      <TD>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            meta.chipClass,
                          )}
                        >
                          {meta.labelAr}
                        </span>
                      </TD>
                      <TD
                        className={cn(
                          "numeric font-semibold whitespace-nowrap",
                          row.amountSyp > 0
                            ? "text-danger-700"
                            : row.amountSyp < 0
                              ? "text-primary-700"
                              : "text-warm-500",
                        )}
                      >
                        {formatSyp(row.amountSyp)}
                      </TD>
                      <TD className="min-w-0">
                        {item ? (
                          <button
                            type="button"
                            onClick={() => onFocusTooth(item.toothFdi)}
                            title="عرض السن على الأودوغرام"
                            className="inline-flex max-w-56 items-center gap-1.5 text-xs transition-colors focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            <span className="border-ink-200 bg-ink-50 text-ink-800 numeric rounded border px-1.5 py-0.5 text-[11px] font-bold">
                              {item.toothFdi}
                            </span>
                            <span className="text-warm-700 truncate hover:text-primary-700 hover:underline">
                              {item.procedure}
                            </span>
                          </button>
                        ) : (
                          <span className="text-warm-400 text-xs">—</span>
                        )}
                      </TD>
                      <TD className="max-w-64 truncate text-warm-600">
                        {row.note ?? "—"}
                      </TD>
                    </TRow>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

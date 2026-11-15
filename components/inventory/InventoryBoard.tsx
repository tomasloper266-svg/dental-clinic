"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  History,
  Package,
  Pencil,
  Plus,
  RotateCw,
  Settings,
  Trash2,
} from "lucide-react";
import type {
  MaterialDto,
  MaterialMovementDto,
} from "@/lib/services/inventory";
import {
  MATERIAL_STATUS_LABELS,
  belowMinCount,
  materialStockStatus,
  materialsToCsv,
  stockLevelRatio,
  type MaterialStockStatus,
} from "@/lib/inventory-view";
import { formatDateCell, formatWeekdayDateCell, toDateInputValue } from "@/lib/dates";
import { DualAmount } from "@/components/ui/DualAmount";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ExportButton, PanelToolbar, SearchInput, FilterPills } from "@/components/ui/Toolbar";
import { StatCard } from "@/components/ui/StatCard";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/Badge";
import { IconAction, PillAction } from "@/components/ui/TableActions";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/appointments/ConfirmDialog";
import { Field, Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";

// لوحة المخزون على شكل المرجع — ثلاث بطاقات إحصاء، جدول مواد بأعمدته الستة،
// ونوافذ التوريد والسجل والتعديل. كل الكميات والحالات مشتقة من بيانات المخزون
// حصراً: التوريد يزيد الرصيد ويسجل حركة، والاستعمال والتعديل اليدوي يسجلان
// حركة سالبة أو تسوية في الدفتر.

type EditSubmit = (body: Record<string, unknown>) => Promise<string | null>;

export default function InventoryBoard({ usdRate }: { usdRate: number }) {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<MaterialDto[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  // النوافذ: إضافة/تعديل (نفس النافذة) وتوريد وسجل وحذف
  const [formTarget, setFormTarget] = useState<
    { mode: "create" } | { mode: "edit"; material: MaterialDto } | null
  >(null);
  const [supplying, setSupplying] = useState<MaterialDto | null>(null);
  const [historyFor, setHistoryFor] = useState<MaterialDto | null>(null);
  const [deleting, setDeleting] = useState<MaterialDto | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch("/api/materials");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { materials: MaterialDto[] };
      setMaterials(data.materials);
    } catch {
      setMaterials(null);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function apply(
    materialId: string | "new",
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: Record<string, unknown>,
    successNote?: string,
  ): Promise<string | null> {
    setBusyId(materialId);
    try {
      const res = await fetch(`/api/materials${path}`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const failure = data.error ?? "تعذر تنفيذ العملية، أعد المحاولة";
        toast(failure, "danger");
        return failure;
      }
      if (successNote) toast(successNote);
      await refresh();
      return null;
    } catch {
      toast("تعذر الاتصال بالخادم، حاول مرة أخرى", "danger");
      return "تعذر الاتصال بالخادم، حاول مرة أخرى";
    } finally {
      setBusyId(null);
    }
  }

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (materials ?? []).filter(
      (m) =>
        (!lowOnly || m.isLow) &&
        (!needle || m.name.toLowerCase().includes(needle)),
    );
  }, [materials, search, lowOnly]);

  const needSupplyCount = materials?.filter((m) => m.isLow).length ?? 0;
  const belowMin = materials ? belowMinCount(materials) : 0;

  /** تنزيل CSV على جهاز المستخدم — من بيانات المخزون المحمّلة حصراً */
  function exportCsv() {
    if (!materials?.length) return;
    const blob = new Blob([materialsToCsv(materials)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "materials.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="المخزون"
        description={formatWeekdayDateCell(new Date())}
        actions={
          <>
            <ExportButton onClick={exportCsv} disabled={!materials?.length} />
            <Button variant="gold" onClick={() => setFormTarget({ mode: "create" })}>
              <Plus size={16} aria-hidden />
              مادة جديدة
            </Button>
          </>
        }
      />

      {/* ملخص — ثلاث بطاقات إحصاء يميناً يساراً على شكل المرجع */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          value={materials ? String(materials.length) : "—"}
          label="إجمالي المواد"
          icon={Package}
        />
        <StatCard
          value={materials ? String(needSupplyCount) : "—"}
          label="بحاجة تزويد"
          icon={BarChart3}
          iconClassName="bg-primary-500/10 text-primary-600"
        />
        <StatCard
          value={materials ? String(belowMin) : "—"}
          label="تحت الحد الأدنى"
          icon={AlertTriangle}
          tone="danger"
        />
      </div>

      {loadError ? (
        <div
          role="alert"
          className="mt-4 flex flex-col items-start gap-2 rounded-panel border border-danger-300 bg-danger-50 px-4 py-4"
        >
          <p className="text-xs font-medium text-danger-700">
            تعذر تحميل المخزون — تحقق من الاتصال ثم أعد المحاولة.
          </p>
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            <RotateCw size={14} aria-hidden />
            إعادة المحاولة
          </Button>
        </div>
      ) : materials === null ? (
        <div aria-busy="true" className="mt-4 flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-field bg-surface-sunken"
            />
          ))}
        </div>
      ) : materials.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Package}
            title="لا مواد في المخزون بعد"
            description="أضف أول مادة باسمها ووحدتها وحد التنبيه، ثم زوّدها بكمية لتبدأ."
            action={
              <Button
                size="sm"
                variant="gold"
                onClick={() => setFormTarget({ mode: "create" })}
              >
                <Plus size={14} aria-hidden />
                مادة جديدة
              </Button>
            }
          />
        </div>
      ) : (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings size={16} className="text-warning-600" aria-hidden />
              مخزون العيادة
            </CardTitle>
          </CardHeader>
          <PanelToolbar className="border-b border-warm-200">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="ابحث باسم المادة…"
              aria-label="بحث باسم المادة"
            />
            <FilterPills
              ariaLabel="تصفية المواد"
              value={lowOnly ? "low" : "all"}
              onChange={(value) => setLowOnly(value === "low")}
              options={[
                { value: "all", label: "الكل" },
                {
                  value: "low",
                  label: "تحت الحد الأدنى",
                  count: needSupplyCount,
                },
              ]}
            />
          </PanelToolbar>
          <CardBody className="pt-0">
            {visible.length === 0 ? (
              <EmptyState
                icon={Package}
                title="لا مواد مطابقة"
                description="عدّل البحث أو أزل فلتر «تحت الحد الأدنى» لتوسيع القائمة."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setLowOnly(false);
                    }}
                  >
                    مسح التصفية
                  </Button>
                }
              />
            ) : (
              <>
                {/* جدول الشاشات المتوسطة فأعلى */}
                <Table className="hidden md:table" wrapperClassName="border-0">
                  <THead>
                    <TRow>
                      <TH>المادة</TH>
                      <TH>الكمية</TH>
                      <TH>الحالة</TH>
                      <TH>المورد</TH>
                      <TH className="text-end">سعر الوحدة</TH>
                      <TH>إجراءات</TH>
                    </TRow>
                  </THead>
                  <tbody>
                    {visible.map((m) => (
                      <TRow key={m.id}>
                        <TD>
                          <p className="font-semibold text-ink-900">{m.name}</p>
                          <p className="text-xs text-warm-500">
                            {m.category ?? m.unit}
                          </p>
                        </TD>
                        <TD className="min-w-36">
                          <QuantityCell
                            quantityOnHand={m.quantityOnHand}
                            minQuantity={m.minQuantity}
                            unit={m.unit}
                          />
                        </TD>
                        <TD>
                          <MaterialStatusPill
                            quantityOnHand={m.quantityOnHand}
                            minQuantity={m.minQuantity}
                          />
                        </TD>
                        <TD>
                          {m.supplier ? (
                            <span className="text-sm text-warm-700">
                              {m.supplier}
                            </span>
                          ) : (
                            <span className="text-warm-300">—</span>
                          )}
                        </TD>
                        <TD>
                          {m.costUsd !== null ? (
                            <DualAmount usd={m.costUsd} usdRate={usdRate} precise />
                          ) : (
                            <span className="text-warm-300">—</span>
                          )}
                        </TD>
                        <TD>
                          <MaterialActions
                            busy={busyId === m.id}
                            onSupply={() => setSupplying(m)}
                            onEdit={() =>
                              setFormTarget({ mode: "edit", material: m })
                            }
                            onHistory={() => setHistoryFor(m)}
                            onDelete={() => setDeleting(m)}
                          />
                        </TD>
                      </TRow>
                    ))}
                  </tbody>
                </Table>

                {/* بطاقات الموبايل */}
                <ul className="flex flex-col gap-2 md:hidden">
                  {visible.map((m) => (
                    <li key={m.id}>
                      <Card className="border-warm-200">
                        <CardBody className="flex flex-col gap-2 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-ink-900">
                                {m.name}
                              </p>
                              <p className="text-xs text-warm-500">
                                {m.category ?? m.unit}
                              </p>
                            </div>
                            <MaterialStatusPill
                              quantityOnHand={m.quantityOnHand}
                              minQuantity={m.minQuantity}
                            />
                          </div>
                          <QuantityCell
                            quantityOnHand={m.quantityOnHand}
                            minQuantity={m.minQuantity}
                            unit={m.unit}
                          />
                          <div className="text-xs text-warm-600">
                            {m.supplier ?? "—"}
                          </div>
                          <MaterialActions
                            busy={busyId === m.id}
                            onSupply={() => setSupplying(m)}
                            onEdit={() =>
                              setFormTarget({ mode: "edit", material: m })
                            }
                            onHistory={() => setHistoryFor(m)}
                            onDelete={() => setDeleting(m)}
                          />
                        </CardBody>
                      </Card>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* نافذة إضافة/تعديل — نفس الحقول فارغة للإضافة ومملوءة للتعديل */}
      {formTarget && (
        <MaterialFormModal
          key={
            formTarget.mode === "edit"
              ? `edit-${formTarget.material.id}`
              : "create"
          }
          material={formTarget.mode === "edit" ? formTarget.material : null}
          busy={busyId === (formTarget.mode === "edit" ? formTarget.material.id : "new")}
          onClose={() => setFormTarget(null)}
          onSubmit={async (body) => {
            if (formTarget.mode === "edit") {
              const failure = await apply(
                formTarget.material.id,
                `/${formTarget.material.id}`,
                "PATCH",
                body,
                "حُفظت التعديلات",
              );
              if (!failure) setFormTarget(null);
              return failure;
            }
            const failure = await apply("new", "", "POST", body, "أُضيفت المادة إلى المخزون");
            if (!failure) setFormTarget(null);
            return failure;
          }}
        />
      )}

      {supplying && (
        <SupplyModal
          key={`supply-${supplying.id}`}
          material={supplying}
          busy={busyId === supplying.id}
          onClose={() => setSupplying(null)}
          onSubmit={async (body) => {
            const failure = await apply(
              supplying.id,
              `/${supplying.id}/supply`,
              "POST",
              body,
              "سُجل التوريد وأُضيفت الكمية",
            );
            if (!failure) setSupplying(null);
            return failure;
          }}
        />
      )}

      {historyFor && (
        <HistoryModal
          key={`history-${historyFor.id}`}
          material={historyFor}
          onClose={() => setHistoryFor(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="تأكيد حذف المادة"
        description={`ستُحذف «${deleting?.name ?? ""}» نهائياً من المخزون مع سطور استعمالها وحركاتها. لا يمكن التراجع عن الحذف.`}
        confirmLabel="احذف المادة"
        loading={deleting !== null && busyId === deleting.id}
        onConfirm={async () => {
          if (!deleting) return;
          const failure = await apply(
            deleting.id,
            `/${deleting.id}`,
            "DELETE",
            undefined,
            "حُذفت المادة من المخزون",
          );
          if (!failure) setDeleting(null);
        }}
      />
    </>
  );
}

function MaterialActions({
  busy,
  onSupply,
  onEdit,
  onHistory,
  onDelete,
}: {
  busy: boolean;
  onSupply: () => void;
  onEdit: () => void;
  onHistory: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <PillAction variant="gold" onClick={onSupply} disabled={busy}>
        توريد
      </PillAction>
      <IconAction icon={Pencil} label="تعديل" onClick={onEdit} disabled={busy} />
      <PillAction variant="outline" onClick={onHistory} disabled={busy}>
        <History size={13} aria-hidden />
        السجل
      </PillAction>
      <IconAction
        icon={Trash2}
        label="حذف"
        tone="danger"
        onClick={onDelete}
        disabled={busy}
      />
    </div>
  );
}

/** خلية الكمية — الرقم والوحدة بارزان وشريط تقدم رفيع يتلون بحالة المخزون */
function QuantityCell({
  quantityOnHand,
  minQuantity,
  unit,
}: {
  quantityOnHand: number;
  minQuantity: number;
  unit: string;
}) {
  const status = materialStockStatus({ quantityOnHand, minQuantity });
  const ratio = stockLevelRatio({ quantityOnHand, minQuantity });
  return (
    <div className="flex flex-col gap-1.5">
      <p
        className={cn(
          "numeric text-sm font-semibold",
          status === "critical" ? "text-danger-600" : "text-ink-900",
        )}
      >
        {quantityOnHand} {unit}
      </p>
      <div
        role="meter"
        aria-valuenow={ratio * 100}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`نسبة الرصيد من ضعف حد التنبيه — ${MATERIAL_STATUS_LABELS[status]}`}
        className="h-1 w-full max-w-28 overflow-hidden rounded-full bg-surface-sunken"
      >
        <div
          className={cn("h-full rounded-full", statusBarClasses[status])}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

const statusBarClasses: Record<MaterialStockStatus, string> = {
  available: "bg-primary-500",
  low: "bg-warning-500",
  critical: "bg-danger-500",
};

/** شارة حالة المادة — متوفر / منخفض / نفذ بنقطة لونية ثابتة */
function MaterialStatusPill({
  quantityOnHand,
  minQuantity,
}: {
  quantityOnHand: number;
  minQuantity: number;
}) {
  const status = materialStockStatus({ quantityOnHand, minQuantity });
  const tone =
    status === "available" ? "success" : status === "low" ? "warning" : "danger";
  return (
    <StatusPill tone={tone}>{MATERIAL_STATUS_LABELS[status]}</StatusPill>
  );
}

/** نافذة التوريد — كمية وتاريخ وملاحظات مع أزرار الكميات السريعة */
function SupplyModal({
  material,
  busy,
  onClose,
  onSubmit,
}: {
  material: MaterialDto;
  busy: boolean;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<string | null>;
}) {
  const [value, setValue] = useState("");
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const quantity = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(quantity) && quantity > 0;
  const afterAdd = valid
    ? Math.round((material.quantityOnHand + quantity) * 100) / 100
    : material.quantityOnHand;

  /** زر كمية سريعة — يجمع على القيمة المدخلة لا يستبدلها */
  function addQuick(amount: number) {
    const current = Number(value);
    const next =
      value.trim() !== "" && Number.isFinite(current)
        ? Math.round((current + amount) * 100) / 100
        : amount;
    setValue(String(next));
    setError(null);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="توريد — أضف كمية"
      footer={
        <>
          <Button
            variant="gold"
            loading={busy}
            onClick={async () => {
              if (!valid) {
                setError("أدخل كمية رقماً موجباً");
                return;
              }
              setError(null);
              const failure = await onSubmit({
                quantity,
                ...(note.trim() ? { note: note.trim() } : {}),
                ...(date ? { movedAt: new Date(`${date}T00:00:00.000Z`) } : {}),
              });
              if (failure) setError(failure);
            }}
          >
            تسجيل
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-warm-500">
          الكمية الحالية:{" "}
          <span className="numeric font-semibold text-ink-900">
            {material.quantityOnHand} {material.unit}
          </span>{" "}
          — بعد الإضافة:{" "}
          <span className="numeric font-semibold text-ink-900">
            {afterAdd} {material.unit}
          </span>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={`الكمية (${material.unit})`}
            htmlFor="supply-quantity"
            error={error ?? undefined}
          >
            <Input
              id="supply-quantity"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="مثال: 10"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
            />
          </Field>
          <Field label="التاريخ" htmlFor="supply-date">
            <Input
              id="supply-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label="ملاحظات" htmlFor="supply-note">
          <Input
            id="supply-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="اسم المورد، رقم الفاتورة…"
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="كميات سريعة">
          {[5, 10, 20, 50].map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => addQuick(amount)}
              className="rounded-full border border-warm-300 bg-surface-raised px-3 py-1 text-xs font-medium text-warm-700 transition-colors hover:bg-surface-hover"
            >
              +{amount}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/** نافذة السجل — الدفتر الإلحاقي لحركات المادة، الأحدث أولاً */
function HistoryModal({
  material,
  onClose,
}: {
  material: MaterialDto;
  onClose: () => void;
}) {
  const [movements, setMovements] = useState<MaterialMovementDto[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/materials/${material.id}/movements`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as {
          movements: MaterialMovementDto[];
        };
        if (!cancelled) setMovements(data.movements);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [material.id]);

  return (
    <Modal
      open
      onClose={onClose}
      title={`السجل — ${material.name}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          إغلاق
        </Button>
      }
    >
      {loadError ? (
        <p role="alert" className="text-xs text-danger-600">
          تعذر تحميل السجل — أعد فتح النافذة للمحاولة من جديد.
        </p>
      ) : movements === null ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded-field bg-surface-sunken"
            />
          ))}
        </div>
      ) : movements.length === 0 ? (
        <p className="text-sm text-warm-500">
          لا حركات مسجلة لهذه المادة بعد — سجّل توريداً لبدء السجل.
        </p>
      ) : (
        <Table wrapperClassName="border border-warm-200 rounded-field">
          <THead>
            <TRow>
              <TH>التاريخ</TH>
              <TH>الكمية</TH>
              <TH>ملاحظات</TH>
            </TRow>
          </THead>
          <tbody>
            {movements.map((mv) => (
              <TRow key={mv.id}>
                <TD className="numeric text-warm-700">
                  {formatDateCell(mv.movedAt)}
                </TD>
                <TD
                  className={cn(
                    "numeric font-semibold",
                    mv.quantityChange >= 0 ? "text-primary-700" : "text-danger-600",
                  )}
                >
                  {mv.quantityChange >= 0 ? "+" : ""}
                  {mv.quantityChange}
                </TD>
                <TD className="text-warm-600">{mv.note ?? "—"}</TD>
              </TRow>
            ))}
          </tbody>
        </Table>
      )}
    </Modal>
  );
}

/**
 * نافذة إضافة/تعديل المادة — نفس الحقول على شكل المرجع: اسم وفئة وكمية ووحدة
 * وحد تنبيه ومورد وسعر وحدة. الكمية في وضع التعديل تُمرّر للخدمة التي تسجّل
 * الفرق سطر حركة تسوية في الدفتر.
 */
function MaterialFormModal({
  material,
  busy,
  onClose,
  onSubmit,
}: {
  material: MaterialDto | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: EditSubmit;
}) {
  const editing = material !== null;
  const [name, setName] = useState(material?.name ?? "");
  const [category, setCategory] = useState(material?.category ?? "");
  const [quantity, setQuantity] = useState(
    material ? String(material.quantityOnHand) : "0",
  );
  const [unit, setUnit] = useState(material?.unit ?? "");
  const [minQuantity, setMinQuantity] = useState(
    material ? String(material.minQuantity) : "",
  );
  const [supplier, setSupplier] = useState(material?.supplier ?? "");
  const [costUsd, setCostUsd] = useState(
    material?.costUsd !== null && material?.costUsd !== undefined
      ? String(material.costUsd)
      : "",
  );
  const [error, setError] = useState<string | null>(null);

  function buildBody(): Record<string, unknown> | null {
    const min = Number(minQuantity);
    const qty = Number(quantity);
    const cost = costUsd.trim() === "" ? null : Number(costUsd);
    if (!name.trim() || !unit.trim()) {
      setError("اسم المادة والوحدة مطلوبان");
      return null;
    }
    if (!Number.isFinite(qty) || qty < 0) {
      setError("الكمية رقم غير سالب");
      return null;
    }
    if (!Number.isFinite(min) || min < 0) {
      setError("حد التنبيه رقم غير سالب");
      return null;
    }
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      setError("السعر رقماً غير سالب بحد منزلتين أو اتركه فارغاً");
      return null;
    }
    setError(null);
    return {
      name: name.trim(),
      unit: unit.trim(),
      ...(category.trim() ? { category: category.trim() } : { category: null }),
      ...(supplier.trim() ? { supplier: supplier.trim() } : { supplier: null }),
      // الرصيد الافتتاحي يُرسل عند الإنشاء أيضاً — يُسجَّل معه سطر حركة توريد أولى
      quantity: qty,
      minQuantity: min,
      // التكلفة بعشريات منذ ترحيل Decimal(12,2) — تُقرَّب لمنزلتين قبل الإرسال
      ...(cost !== null || editing
        ? { costUsd: cost === null ? null : Math.round(cost * 100) / 100 }
        : {}),
    };
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "تعديل" : "مادة جديدة"}
      footer={
        <>
          <Button
            variant="gold"
            loading={busy}
            onClick={async () => {
              const body = buildBody();
              if (!body) return;
              const failure = await onSubmit(body);
              if (failure) setError(failure);
            }}
          >
            {editing ? "حفظ" : "إضافة"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="اسم المادة *" htmlFor="material-name">
          <Input
            id="material-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: قفازات لاتكس"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الفئة" htmlFor="material-category">
            <Input
              id="material-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="مثال: مواد وقاية"
            />
          </Field>
          <Field label="الكمية" htmlFor="material-quantity">
            <Input
              id="material-quantity"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>
          <Field label="الوحدة" htmlFor="material-unit">
            <Input
              id="material-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="مثال: علبة"
            />
          </Field>
          <Field label="الحد الأدنى للتنبيه" htmlFor="material-min">
            <Input
              id="material-min"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
            />
          </Field>
          <Field label="المورد" htmlFor="material-supplier">
            <Input
              id="material-supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="مثال: دنتكال سول"
            />
          </Field>
          <Field label="سعر الوحدة ($)" htmlFor="material-cost">
            <Input
              id="material-cost"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={costUsd}
              onChange={(e) => setCostUsd(e.target.value)}
            />
          </Field>
        </div>
        {editing && (
          <p className="text-xs text-warm-500">
            تعديل الكمية مباشرة يُسجَّل سطر تسوية في سجل المادة.
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-danger-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

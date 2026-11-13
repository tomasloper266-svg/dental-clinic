"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CircleCheck,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  RotateCw,
  Scissors,
} from "lucide-react";
import type { MaterialDto } from "@/lib/services/inventory";
import { usePatientSearch, type PatientOption } from "@/lib/use-patient-search";
import { formatSyp } from "@/lib/utils";
import {
  MATERIAL_STATUS_LABELS,
  healthyCount,
  materialStockStatus,
  materialsToCsv,
  stockLevelRatio,
  type MaterialStockStatus,
} from "@/lib/inventory-view";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  ExportButton,
  FilterPills,
  PanelToolbar,
  SearchInput,
} from "@/components/ui/Toolbar";
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

// لوحة المخزون — مواد العيادة في جدول واحد مع ألوان حالات موحّدة،
// وتوريد واستعمال وتعديل عبر واجهات الخدمة نفسها. منطق الخصم الذري
// الخصم الشرطي داخل المعاملة — لا يُلمس هنا ولا في أي مكان.

type QuantitySubmit = (quantity: number) => Promise<boolean>;
type UsageSubmit = (quantity: number, patientId?: string) => Promise<boolean>;
type EditSubmit = (body: Record<string, unknown>) => Promise<boolean>;

export default function InventoryBoard() {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<MaterialDto[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  // النوافذ: إضافة وتوريد واستعمال وتعديل — كل واحدة على مادة محددة
  const [adding, setAdding] = useState(false);
  const [supplying, setSupplying] = useState<MaterialDto | null>(null);
  const [using, setUsing] = useState<MaterialDto | null>(null);
  const [editing, setEditing] = useState<MaterialDto | null>(null);

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
    materialId: string,
    path: "supply" | "usage" | "edit",
    body: Record<string, unknown>,
    successNote: string,
  ): Promise<boolean> {
    setBusyId(materialId);
    try {
      const res = await fetch(`/api/materials/${materialId}/${path}`, {
        method: path === "edit" ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast(data.error ?? "تعذر تنفيذ العملية، أعد المحاولة", "danger");
        return false;
      }
      toast(successNote);
      await refresh();
      return true;
    } catch {
      toast("تعذر الاتصال بالخادم، حاول مرة أخرى", "danger");
      return false;
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

  const lowCount = materials?.filter((m) => m.isLow).length ?? 0;
  const healthy = healthyCount(materials ?? []);

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
        description="مواد العيادة وكمياتها وحدود تنبيهها — الكمية تتغير بالتوريد والاستعمال حصراً، والخصم ذري لا يمرّ إذا لم يكفِ الرصيد."
        actions={
          <>
            <ExportButton onClick={exportCsv} disabled={!materials?.length} />
            <Button onClick={() => setAdding(true)}>
              <Plus size={16} aria-hidden />
              مادة جديدة
            </Button>
          </>
        }
      />

      {/* ملخص — ثلاث بطاقات إحصاء على شكل المرجع */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          value={materials ? String(materials.length) : "—"}
          label="المواد المسجلة"
          icon={Package}
        />
        <StatCard
          value={materials ? String(healthy) : "—"}
          label="المتوفر"
          icon={CircleCheck}
        />
        <StatCard
          value={materials ? String(lowCount) : "—"}
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
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus size={14} aria-hidden />
                مادة جديدة
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* بطاقة المحتوى — شريط أدوات + جدول على شكل المرجع */}
          <Card>
            <CardHeader>
              <CardTitle>مخزون العيادة</CardTitle>
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
                  { value: "low", label: "تحت الحد الأدنى", count: lowCount },
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
                      <TH className="text-end">سعر الوحدة</TH>
                      <TH>إجراءات</TH>
                    </TRow>
                  </THead>
                  <tbody>
                    {visible.map((m) => (
                      <TRow key={m.id}>
                        <TD>
                          <p className="font-semibold text-ink-900">{m.name}</p>
                          <p className="numeric text-xs text-warm-500">
                            الحد الأدنى: {m.minQuantity} {m.unit}
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
                        <TD className="numeric text-end text-warm-600">
                          {m.costSyp !== null ? formatSyp(m.costSyp) : "—"}
                        </TD>
                        <TD>
                          <MaterialActions
                            busy={busyId === m.id}
                            onSupply={() => setSupplying(m)}
                            onUsage={() => setUsing(m)}
                            onEdit={() => setEditing(m)}
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
                            <p className="text-sm font-semibold text-ink-900">
                              {m.name}
                            </p>
                            <MaterialStatusPill
                              quantityOnHand={m.quantityOnHand}
                              minQuantity={m.minQuantity}
                            />
                          </div>
                          <p className="numeric text-xs text-warm-600">
                            الرصيد {m.quantityOnHand} {m.unit} · حد التنبيه{" "}
                            {m.minQuantity}
                          </p>
                          <QuantityCell
                            quantityOnHand={m.quantityOnHand}
                            minQuantity={m.minQuantity}
                            unit={m.unit}
                          />
                          <MaterialActions
                            busy={busyId === m.id}
                            onSupply={() => setSupplying(m)}
                            onUsage={() => setUsing(m)}
                            onEdit={() => setEditing(m)}
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
        </>
      )}

      <AddMaterialModal
        open={adding}
        busy={busyId === "new"}
        onClose={() => setAdding(false)}
        onSubmit={async (body) => {
          setBusyId("new");
          try {
            const res = await fetch("/api/materials", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
              toast(data.error ?? "تعذر إضافة المادة، أعد المحاولة", "danger");
              return false;
            }
            toast("أُضيفت المادة إلى المخزون");
            await refresh();
            return true;
          } catch {
            toast("تعذر الاتصال بالخادم، حاول مرة أخرى", "danger");
            return false;
          } finally {
            setBusyId(null);
          }
        }}
      />

      {supplying && (
        <QuantityModal
          key={`supply-${supplying.id}`}
          open
          title={`توريد: ${supplying.name}`}
          label="كمية التوريد"
          unit={supplying.unit}
          hint="الكمية تُضاف إلى الرصيد الحالي"
          submitLabel="أضف الكمية"
          busy={busyId === supplying.id}
          onClose={() => setSupplying(null)}
          onSubmit={async (quantity) => {
            const ok = await apply(
              supplying.id,
              "supply",
              { quantity },
              "سُجل التوريد",
            );
            if (ok) setSupplying(null);
            return ok;
          }}
        />
      )}

      {using && (
        <UsageModal
          key={`usage-${using.id}`}
          open
          material={using}
          busy={busyId === using.id}
          onClose={() => setUsing(null)}
          onSubmit={async (quantity, patientId) => {
            const ok = await apply(
              using.id,
              "usage",
              { quantityUsed: quantity, patientId },
              "سُجل الاستعمال وخصمت الكمية",
            );
            if (ok) setUsing(null);
            return ok;
          }}
        />
      )}

      {editing && (
        <EditMaterialModal
          key={`edit-${editing.id}`}
          open
          material={editing}
          busy={busyId === editing.id}
          onClose={() => setEditing(null)}
          onSubmit={async (body) => {
            const ok = await apply(editing.id, "edit", body, "حُررت المادة");
            if (ok) setEditing(null);
            return ok;
          }}
        />
      )}
    </>
  );
}

function MaterialActions({
  busy,
  onSupply,
  onUsage,
  onEdit,
}: {
  busy: boolean;
  onSupply: () => void;
  onUsage: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <PillAction onClick={onSupply} disabled={busy}>
        <PackagePlus size={13} aria-hidden />
        توريد
      </PillAction>
      <PillAction variant="outline" onClick={onUsage} disabled={busy}>
        <Scissors size={13} aria-hidden />
        استعمال
      </PillAction>
      <IconAction icon={Pencil} label="تعديل المادة" onClick={onEdit} />
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
      <p className="numeric text-sm font-semibold text-ink-900">
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

/** شارة حالة المادة — متوفر / منخفض / حرج بنقطة لونية ثابتة */
function MaterialStatusPill({
  quantityOnHand,
  minQuantity,
}: {
  quantityOnHand: number;
  minQuantity: number;
}) {
  const status = materialStockStatus({ quantityOnHand, minQuantity });
  const tone =
    status === "available"
      ? "success"
      : status === "low"
        ? "warning"
        : "danger";
  return (
    <StatusPill tone={tone}>{MATERIAL_STATUS_LABELS[status]}</StatusPill>
  );
}

/** نافذة كمية عامة — للتوريد وغيره من الكميات الموجبة */
function QuantityModal({
  open,
  title,
  label,
  unit,
  hint,
  submitLabel,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label: string;
  unit: string;
  hint?: string;
  submitLabel: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: QuantitySubmit;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const quantity = Number(value);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button
            loading={busy}
            onClick={async () => {
              if (!value.trim() || !Number.isFinite(quantity) || quantity <= 0) {
                setError("أدخل كمية رقماً موجباً");
                return;
              }
              setError(null);
              await onSubmit(quantity);
            }}
          >
            {submitLabel}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
        </>
      }
    >
      <Field
        label={`${label} (${unit})`}
        htmlFor="quantity-value"
        hint={hint}
        error={error ?? undefined}
      >
        <Input
          id="quantity-value"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

/** نافذة استعمال المادة — بربط اختياري بالمريض وتنبيه إن لم يكفِ الرصيد */
function UsageModal({
  open,
  material,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  material: MaterialDto;
  busy: boolean;
  onClose: () => void;
  onSubmit: UsageSubmit;
}) {
  const [value, setValue] = useState("");
  const [search, setSearch] = useState("");
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const options = usePatientSearch(search, open && patient === null);

  const quantity = Number(value);
  const exceedsStock =
    value.trim() !== "" &&
    Number.isFinite(quantity) &&
    quantity > material.quantityOnHand;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`استعمال: ${material.name}`}
      footer={
        <>
          <Button
            loading={busy}
            onClick={async () => {
              if (!value.trim() || !Number.isFinite(quantity) || quantity <= 0) {
                setError("أدخل كمية رقماً موجباً");
                return;
              }
              setError(null);
              await onSubmit(quantity, patient?.id);
            }}
          >
            سجل الاستعمال
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-warm-500">
          الرصيد الحالي: {material.quantityOnHand} {material.unit} — إن لم يكفِ
          الرصيد يُرفض الخصم كلياً دون تسجيل.
        </p>
        <Field
          label={`الكمية المستعملة (${material.unit})`}
          htmlFor="usage-quantity"
          error={exceedsStock ? "الكمية أكبر من الرصيد الحالي — سيُرفض الخصم" : error ?? undefined}
        >
          <Input
            id="usage-quantity"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={exceedsStock || undefined}
          />
        </Field>
        <Field label="المريض (اختياري)" htmlFor="usage-patient">
          {patient ? (
            <span className="flex items-center justify-between rounded-field border border-warm-200 bg-surface-sunken px-3 py-2 text-sm text-ink-900">
              {patient.name}
              <button
                type="button"
                onClick={() => {
                  setPatient(null);
                  setSearch("");
                }}
                aria-label="إزالة المريض"
                className="text-xs text-danger-600"
              >
                إزالة
              </button>
            </span>
          ) : (
            <div className="relative">
              <Input
                id="usage-patient"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو الهاتف…"
                autoComplete="off"
              />
              {options.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-field border border-warm-200 bg-surface-raised shadow-md">
                  {options.slice(0, 4).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPatient(p);
                          setSearch("");
                        }}
                        className="w-full px-3 py-2 text-start text-sm text-ink-900 hover:bg-surface-hover"
                      >
                        {p.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Field>
      </div>
    </Modal>
  );
}

/** نافذة تعديل المادة — التعديل عملية حساسة ويُطلب تأكيد صريح قبل الحفظ */
function EditMaterialModal({
  open,
  material,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  material: MaterialDto;
  busy: boolean;
  onClose: () => void;
  onSubmit: EditSubmit;
}) {
  const [name, setName] = useState(material.name);
  const [unit, setUnit] = useState(material.unit);
  const [minQuantity, setMinQuantity] = useState(String(material.minQuantity));
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const min = Number(minQuantity);

  function buildBody(): Record<string, unknown> | null {
    if (!name.trim() || !unit.trim() || !Number.isFinite(min) || min < 0) {
      setError("تحقق من الاسم والوحدة وحد التنبيه");
      return null;
    }
    setError(null);
    return { name: name.trim(), unit: unit.trim(), minQuantity: min };
  }

  return (
    <>
      <Modal
        open={open && !confirming}
        onClose={onClose}
        title={`تعديل: ${material.name}`}
        footer={
          <>
            <Button
              loading={busy}
              onClick={() => {
                if (buildBody()) setConfirming(true);
              }}
            >
              متابعة الحفظ
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              إلغاء
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="الاسم" htmlFor="material-name">
            <Input
              id="material-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="وحدة القياس" htmlFor="material-unit">
            <Input
              id="material-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </Field>
          <Field
            label="حد التنبيه"
            htmlFor="material-min"
            hint="الكمية عند هذا الحد أو تحته تُعلَّم كنقص"
          >
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
          {error && (
            <p role="alert" className="text-xs text-danger-600">
              {error}
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={open && confirming}
        onClose={() => setConfirming(false)}
        title="تأكيد تعديل المادة"
        description={`ستتغير بيانات «${material.name}» — الاسم والوحدة وحد التنبيه. الكمية لا تتغير بالتعديل، بل بالتوريد والاستعمال حصراً.`}
        confirmLabel="احفظ التعديل"
        loading={busy}
        onConfirm={async () => {
          const body = buildBody();
          if (body) {
            const ok = await onSubmit(body);
            if (ok) setConfirming(false);
          } else {
            setConfirming(false);
          }
        }}
      />
    </>
  );
}

/** نافذة إضافة مادة جديدة — برصيد صفري يبدأ بالتوريد */
function AddMaterialModal({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [costSyp, setCostSyp] = useState("");
  const [error, setError] = useState<string | null>(null);

  function buildBody(): Record<string, unknown> | null {
    const min = Number(minQuantity);
    const cost = costSyp.trim() === "" ? undefined : Number(costSyp);
    if (!name.trim() || !unit.trim() || !Number.isFinite(min) || min < 0) {
      setError("الاسم والوحدة مطلوبان وحد التنبيه رقم غير سالب");
      return null;
    }
    if (cost !== undefined && (!Number.isInteger(cost) || cost < 0)) {
      setError("السعر رقماً صحيحاً غير سالب أو اتركه فارغاً");
      return null;
    }
    setError(null);
    return {
      name: name.trim(),
      unit: unit.trim(),
      minQuantity: min,
      ...(cost !== undefined ? { costSyp: cost } : {}),
    };
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="مادة جديدة"
      footer={
        <>
          <Button
            loading={busy}
            onClick={async () => {
              const body = buildBody();
              if (body && (await onSubmit(body))) {
                setName("");
                setUnit("");
                setMinQuantity("");
                setCostSyp("");
                onClose();
              }
            }}
          >
            أضف المادة
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="الاسم" htmlFor="new-material-name">
          <Input
            id="new-material-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: قفازات لاتكس"
          />
        </Field>
        <Field label="وحدة القياس" htmlFor="new-material-unit">
          <Input
            id="new-material-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="مثال: علبة"
          />
        </Field>
        <Field label="حد التنبيه" htmlFor="new-material-min">
          <Input
            id="new-material-min"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={minQuantity}
            onChange={(e) => setMinQuantity(e.target.value)}
          />
        </Field>
        <Field label="سعر الوحدة (ل.س — اختياري)" htmlFor="new-material-cost">
          <Input
            id="new-material-cost"
            type="number"
            min="0"
            inputMode="numeric"
            value={costSyp}
            onChange={(e) => setCostSyp(e.target.value)}
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

"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mars, Pencil, Plus, Trash2, Users, Venus } from "lucide-react";
import { formatDateCell } from "@/lib/dates";
import { formatDayLabel } from "@/lib/appointment-ui";
import { formatSyp } from "@/lib/utils";
import type { PatientDto } from "@/lib/services/patients";
import {
  PATIENT_FILTERS,
  ageFromBirthYear,
  countGenders,
  filterPatients,
  genderLabel,
  searchPatientRows,
  sortPatientRows,
  type PatientFilterKey,
  type PatientRowView,
  type PatientSortKey,
} from "@/lib/patients-view";
import PatientForm from "@/components/patients/PatientForm";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { PanelToolbar, SearchInput, FilterPills, SortSelect } from "@/components/ui/Toolbar";
import { EntityCell } from "@/components/ui/EntityCell";
import { PillAction, IconAction } from "@/components/ui/TableActions";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

// شاشة المرضى — الهيكل المرجعي: ترويسة كبيرة بحبة «مريض جديد»، ثم بطاقة
// محتوى واحدة تجمع شريط الأدوات (بحث بالعدسة، حبوب تصفية، قائمة ترتيب)
// والجدول بأعمدته: خلية المريض بالأفاتار، العمر، آخر زيارة، موعد قادم،
// الرصيد المستحق (أخضر «مسدد ✓» أو أحمر بالمبلغ)، وإجراءات الملف/تحرير/حذف.
// البيانات كلها من الصفحة الخادمية — التصفية والترتيب هنا زبونية نقية.

const SORT_OPTIONS: ReadonlyArray<{ value: PatientSortKey; label: string }> = [
  { value: "name", label: "ترتيب: الاسم" },
  { value: "newest", label: "ترتيب: الأحدث تسجيلاً" },
  { value: "balance", label: "ترتيب: الرصيد المستحق" },
];

/** أيقونة الجنس — ذكر/أنثى، بلا أيقونة لمن بلا جنس مسجل */
function GenderIcon({ gender }: { gender: PatientDto["gender"] }) {
  if (gender === "MALE")
    return <Mars size={13} aria-hidden className="text-primary-700 shrink-0" />;
  if (gender === "FEMALE")
    return <Venus size={13} aria-hidden className="text-plum-700 shrink-0" />;
  return null;
}

/** خلية المريض — أفاتار بالحرف الأول، الاسم، ثم الجنس والهاتف ورقم الملف */
function PatientCell({ patient }: { patient: PatientDto }) {
  const parts = [
    genderLabel(patient.gender),
    patient.phone,
    patient.fileNo !== null ? `رقم ${patient.fileNo}` : null,
  ].filter(Boolean);
  return (
    <EntityCell
      name={patient.name}
      subtitle={parts.length > 0 ? parts.join(" · ") : undefined}
      icon={<GenderIcon gender={patient.gender} />}
    />
  );
}

function AgeCell({ birthYear }: { birthYear: number | null }) {
  const age = ageFromBirthYear(birthYear);
  if (age === null) return <span className="text-xs text-warm-400">—</span>;
  return (
    <span className="numeric whitespace-nowrap">
      {age} <span className="text-xs text-warm-400">سنة</span>
    </span>
  );
}

function VisitCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-xs text-warm-400">—</span>;
  return (
    <span className="numeric whitespace-nowrap text-warm-700">
      {formatDateCell(value)}
    </span>
  );
}

function BalanceCell({ balanceSyp }: { balanceSyp: number }) {
  if (balanceSyp <= 0) {
    return <Badge tone="success">مسدد ✓</Badge>;
  }
  return (
    <span className="numeric font-semibold text-danger-600" title="رصيد مستحق">
      {formatSyp(balanceSyp)}
    </span>
  );
}

type Props = {
  rows: PatientRowView[];
};

export default function PatientsView({ rows }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PatientFilterKey>("ALL");
  const [sortKey, setSortKey] = useState<PatientSortKey>("name");
  const searchParams = useSearchParams();
  // «+ مريض جديد» من ملف المريض يصل عبر ?create=1 — تُفتح نافذة الإنشاء فوراً
  const [showForm, setShowForm] = useState(
    () => searchParams.get("create") === "1",
  );
  const [editing, setEditing] = useState<PatientDto | null>(null);
  const [deleting, setDeleting] = useState<PatientDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const counts = useMemo(() => countGenders(rows.map((r) => r.patient)), [rows]);

  const visible = useMemo(() => {
    const afterFilter = filterPatients(
      rows.map((r) => r.patient),
      filter,
    );
    const ids = new Set(afterFilter.map((p) => p.id));
    return sortPatientRows(
      searchPatientRows(rows, query).filter((r) => ids.has(r.patient.id)),
      sortKey,
    );
  }, [rows, filter, query, sortKey]);

  const filtered = filter !== "ALL";
  const searching = query.trim().length > 0;

  function onSaved() {
    setShowForm(false);
    setEditing(null);
    router.refresh();
  }

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(patient: PatientDto) {
    setEditing(patient);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/patients/${encodeURIComponent(deleting.id)}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setDeleteError(data.error ?? "تعذر حذف المريض، أعد المحاولة");
        return;
      }
      toast("حُذف المريض");
      setDeleting(null);
      router.refresh();
    } catch {
      setDeleteError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="المرضى"
        description={formatDayLabel(new Date())}
        actions={
          <Button shape="pill" onClick={openCreate}>
            <Plus size={16} aria-hidden />
            مريض جديد
          </Button>
        }
      />

      {showForm && (
        <Modal
          open={showForm}
          onClose={closeForm}
          title={editing ? "تحرير مريض" : "مريض جديد"}
        >
          <PatientForm editing={editing} onSaved={onSaved} onCancel={closeForm} />
        </Modal>
      )}

      <Modal
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
        title="حذف مريض"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-warm-700">
            هل تريد حذف «{deleting?.name}» نهائياً؟ سيُحذف المريض وكل سجلاته
            (المواعيد، القيود المالية، مخطط الأسنان، خطة العلاج) — ولا يمكن
            التراجع.
          </p>
          {deleteError && (
            <p role="alert" className="text-xs text-danger-600">
              {deleteError}
            </p>
          )}
          <div className="flex items-center justify-start gap-2">
            <Button
              variant="danger"
              loading={deleteBusy}
              onClick={() => void confirmDelete()}
            >
              حذف نهائي
            </Button>
            <Button
              variant="secondary"
              disabled={deleteBusy}
              onClick={() => {
                setDeleting(null);
                setDeleteError(null);
              }}
            >
              إلغاء
            </Button>
          </div>
        </div>
      </Modal>

      <Card>
        <PanelToolbar className="border-b border-warm-200">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="ابحث بالاسم أو الهاتف أو البريد أو الرقم الوطني…"
            aria-label="بحث بالاسم أو الهاتف"
          />
          <div className="flex flex-wrap items-center gap-2">
            <FilterPills
              options={PATIENT_FILTERS.map(({ key, label }) => ({
                value: key,
                label,
                count:
                  key === "ALL"
                    ? (rows.length ?? 0)
                    : counts[key],
              }))}
              value={filter}
              onChange={setFilter}
              ariaLabel="تصفية حسب الملاحظات الطبية"
            />
            <SortSelect
              options={SORT_OPTIONS}
              value={sortKey}
              onChange={setSortKey}
              ariaLabel="ترتيب المرضى"
            />
          </div>
        </PanelToolbar>

        {visible.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filtered || searching ? "لا نتائج مطابقة" : "لا مرضى مسجلين بعد"}
            description={
              filtered
                ? "لا يوجد مريض ضمن هذا الفلتر — جرّب فلتراً آخر أو ابحث باسم آخر."
                : searching
                  ? "جرّب اسماً أو رقماً أقصر."
                  : "أضف أول مريض بزر «مريض جديد»."
            }
            action={
              filtered ? (
                <Button variant="secondary" size="sm" onClick={() => setFilter("ALL")}>
                  إلغاء الفلتر
                </Button>
              ) : !searching ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus size={14} aria-hidden />
                  مريض جديد
                </Button>
              ) : undefined
            }
            className="py-10"
          />
        ) : (
          <Table wrapperClassName="border-0 rounded-none">
            <THead>
              <TRow>
                <TH>المريض</TH>
                <TH className="hidden md:table-cell">العمر</TH>
                <TH className="hidden md:table-cell">آخر زيارة</TH>
                <TH className="hidden lg:table-cell">موعد قادم</TH>
                <TH>الرصيد المستحق</TH>
                <TH className="w-[10%]">
                  <span className="sr-only">إجراءات</span>
                </TH>
              </TRow>
            </THead>
            <tbody>
              {visible.map(({ patient, balanceSyp, lastVisit, nextVisit }) => (
                <TRow key={patient.id}>
                  <TD>
                    <PatientCell patient={patient} />
                  </TD>
                  <TD className="hidden md:table-cell">
                    <AgeCell birthYear={patient.birthYear} />
                  </TD>
                  <TD className="hidden md:table-cell">
                    <VisitCell value={lastVisit} />
                  </TD>
                  <TD className="hidden lg:table-cell">
                    <VisitCell value={nextVisit} />
                  </TD>
                  <TD>
                    <BalanceCell balanceSyp={balanceSyp} />
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1.5">
                      <PillAction href={`/patients/${patient.id}`}>
                        الملف
                      </PillAction>
                      <IconAction
                        icon={Pencil}
                        label={`تحرير بيانات ${patient.name}`}
                        onClick={() => openEdit(patient)}
                      />
                      <IconAction
                        icon={Trash2}
                        label={`حذف ${patient.name}`}
                        tone="danger"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleting(patient);
                        }}
                      />
                    </div>
                  </TD>
                </TRow>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {rows.length > 0 && (
        <p className="text-warm-500 mt-3 text-xs">
          <span className="numeric">{visible.length}</span> مريض
          {searching ? " ضمن نتائج البحث" : ""}
          {filtered ? " ضمن الفلتر" : ""} — الحد الأقصى للعرض 100 مريض.
        </p>
      )}
    </div>
  );
}

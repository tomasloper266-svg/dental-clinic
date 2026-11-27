"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mars, Pencil, Plus, Trash2, Users, Venus } from "lucide-react";
import { formatDateCell } from "@/lib/dates";
import { formatDate } from "@/lib/i18n/format";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/core";
import { useMoney } from "@/components/ui/CurrencyContext";
import type { PatientDto } from "@/lib/services/patients";
import {
  PATIENT_FILTERS,
  ageFromBirthYear,
  countGenders,
  filterPatients,
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
import {
  PanelToolbar,
  SearchInput,
  FilterPills,
  SortSelect,
} from "@/components/ui/Toolbar";
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

const SORT_OPTIONS: ReadonlyArray<{
  value: PatientSortKey;
  labelKey:
    "patients.sort.name" | "patients.sort.newest" | "patients.sort.balance";
}> = [
  { value: "name", labelKey: "patients.sort.name" },
  { value: "newest", labelKey: "patients.sort.newest" },
  { value: "balance", labelKey: "patients.sort.balance" },
];

/** تسمية فلتر الجنس حسب اللغة — مفتاح القاموس من مفتاح الفلتر */
function filterLabel(
  key: PatientFilterKey,
  t: (k: TranslationKey) => string,
): string {
  if (key === "ALL") return t("patients.filterAll");
  return t(key === "MALE" ? "gender.male" : "gender.female");
}

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
  const { t } = useI18n();
  const gender =
    patient.gender === "MALE"
      ? t("gender.male")
      : patient.gender === "FEMALE"
        ? t("gender.female")
        : null;
  const parts = [
    gender,
    patient.phone,
    patient.fileNo !== null
      ? t("patients.fileNo", { no: patient.fileNo })
      : null,
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
  const { t } = useI18n();
  const age = ageFromBirthYear(birthYear);
  if (age === null) return <span className="text-warm-400 text-xs">—</span>;
  return (
    <span className="numeric whitespace-nowrap">
      {age}{" "}
      <span className="text-warm-400 text-xs">{t("patients.yearsShort")}</span>
    </span>
  );
}

function VisitCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-warm-400 text-xs">—</span>;
  return (
    <span className="numeric text-warm-700 whitespace-nowrap">
      {formatDateCell(value)}
    </span>
  );
}

function BalanceCell({ balanceUsd }: { balanceUsd: number }) {
  const money = useMoney();
  const { t } = useI18n();
  if (balanceUsd <= 0) {
    return <Badge tone="success">{t("patients.paid")}</Badge>;
  }
  return (
    <span
      className="numeric text-danger-600 font-semibold"
      title={t("patients.balanceDueTitle")}
    >
      {money(balanceUsd)}
    </span>
  );
}

type Props = {
  rows: PatientRowView[];
};

export default function PatientsView({ rows }: Props) {
  const router = useRouter();
  const { t, locale } = useI18n();
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

  const counts = useMemo(
    () => countGenders(rows.map((r) => r.patient)),
    [rows],
  );

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
        setDeleteError(data.error ?? t("patients.error.delete"));
        return;
      }
      toast(t("patients.deletedToast"));
      setDeleting(null);
      router.refresh();
    } catch {
      setDeleteError(t("common.error.network"));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title={t("patients.title")}
        description={formatDate(new Date(), locale, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        actions={
          <Button shape="pill" onClick={openCreate}>
            <Plus size={16} aria-hidden />
            {t("patients.newPatient")}
          </Button>
        }
      />

      {showForm && (
        <Modal
          open={showForm}
          onClose={closeForm}
          title={editing ? t("patients.editTitle") : t("patients.newPatient")}
        >
          <PatientForm
            editing={editing}
            onSaved={onSaved}
            onCancel={closeForm}
          />
        </Modal>
      )}

      <Modal
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
        title={t("patients.deleteTitle")}
      >
        <div className="flex flex-col gap-4">
          <p className="text-warm-700 text-sm">
            {t("patients.deleteBody", { name: deleting?.name ?? "" })}
          </p>
          {deleteError && (
            <p role="alert" className="text-danger-600 text-xs">
              {deleteError}
            </p>
          )}
          <div className="flex items-center justify-start gap-2">
            <Button
              variant="danger"
              loading={deleteBusy}
              onClick={() => void confirmDelete()}
            >
              {t("patients.deleteForever")}
            </Button>
            <Button
              variant="secondary"
              disabled={deleteBusy}
              onClick={() => {
                setDeleting(null);
                setDeleteError(null);
              }}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      </Modal>

      <Card>
        <PanelToolbar className="border-warm-200 border-b">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={t("patients.searchPlaceholder")}
            aria-label={t("patients.searchAria")}
          />
          <div className="flex flex-wrap items-center gap-2">
            <FilterPills
              options={PATIENT_FILTERS.map(({ key }) => ({
                value: key,
                label: filterLabel(key, t),
                count: key === "ALL" ? (rows.length ?? 0) : counts[key],
              }))}
              value={filter}
              onChange={setFilter}
              ariaLabel={t("patients.filterAria")}
            />
            <SortSelect
              options={SORT_OPTIONS.map(({ value, labelKey }) => ({
                value,
                label: t(labelKey),
              }))}
              value={sortKey}
              onChange={setSortKey}
              ariaLabel={t("patients.sortAria")}
            />
          </div>
        </PanelToolbar>

        {visible.length === 0 ? (
          <EmptyState
            icon={Users}
            title={
              filtered || searching
                ? t("patients.empty.filteredTitle")
                : t("patients.empty.title")
            }
            description={
              filtered
                ? t("patients.empty.filteredDesc")
                : searching
                  ? t("patients.empty.searchDesc")
                  : t("patients.empty.desc")
            }
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setFilter("ALL")}
                >
                  {t("patients.clearFilter")}
                </Button>
              ) : !searching ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus size={14} aria-hidden />
                  {t("patients.newPatient")}
                </Button>
              ) : undefined
            }
            className="py-10"
          />
        ) : (
          <Table wrapperClassName="border-0 rounded-none">
            <THead>
              <TRow>
                <TH>{t("patients.col.patient")}</TH>
                <TH className="hidden md:table-cell">
                  {t("patients.col.age")}
                </TH>
                <TH className="hidden md:table-cell">
                  {t("patients.col.lastVisit")}
                </TH>
                <TH className="hidden lg:table-cell">
                  {t("patients.col.nextVisit")}
                </TH>
                <TH>{t("patients.col.balance")}</TH>
                <TH className="w-[10%]">
                  <span className="sr-only">{t("patients.col.actions")}</span>
                </TH>
              </TRow>
            </THead>
            <tbody>
              {visible.map(({ patient, balanceUsd, lastVisit, nextVisit }) => (
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
                    <BalanceCell balanceUsd={balanceUsd} />
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1.5">
                      <PillAction href={`/patients/${patient.id}`}>
                        {t("patients.record")}
                      </PillAction>
                      <IconAction
                        icon={Pencil}
                        label={t("patients.editAria", { name: patient.name })}
                        onClick={() => openEdit(patient)}
                      />
                      <IconAction
                        icon={Trash2}
                        label={t("patients.deleteAria", { name: patient.name })}
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
          <span className="numeric">
            {t("patients.countLine", {
              count: visible.length,
              search: searching ? t("patients.countSearched") : "",
              filter: filtered ? t("patients.countFiltered") : "",
            })}
          </span>
        </p>
      )}
    </div>
  );
}
